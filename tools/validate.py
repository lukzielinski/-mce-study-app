"""Walidator treści apki: data/sections.json, data/lessons.json, data/questions.json.

Użycie:  python tools/validate.py
Kod wyjścia 0 = OK, 1 = są błędy.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
NOTES = ROOT / "notatki"

QTYPES = {"single", "multi", "truefalse", "match", "scenario"}
CARD_FIELDS = {
    "explain": ["title", "body"],
    "steps": ["title", "items"],
    "table": ["title", "headers", "rows"],
    "trap": ["body"],
    "mnemonic": ["body"],
    "warning": ["body"],
    "scenario": ["problem", "cause", "solution"],
}

errors: list[str] = []
warnings: list[str] = []


def err(msg):
    errors.append(msg)


def load(name):
    try:
        with open(DATA / name, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        err(f"{name}: nie da się wczytać JSON: {e}")
        return None


def check_source(where, obj):
    src = obj.get("source")
    if not src or not isinstance(src, str):
        err(f"{where}: brak pola 'source'")
    elif not (NOTES / src).is_file():
        err(f"{where}: source '{src}' nie istnieje w notatki/")


def nonempty_str(v):
    return isinstance(v, str) and v.strip() != ""


def check_options_list(where, opts, min_n=2):
    if not isinstance(opts, list) or len(opts) < min_n:
        err(f"{where}: 'options' musi być listą min. {min_n} elementów")
        return []
    ids = []
    for i, o in enumerate(opts):
        if not isinstance(o, dict) or not nonempty_str(o.get("id")) or not nonempty_str(o.get("text")):
            err(f"{where}: options[{i}] musi mieć niepuste 'id' i 'text'")
            continue
        ids.append(o["id"])
    dup = [k for k, c in Counter(ids).items() if c > 1]
    if dup:
        err(f"{where}: zduplikowane id opcji {dup}")
    texts = [o.get("text") for o in opts if isinstance(o, dict)]
    if len(set(texts)) != len(texts):
        err(f"{where}: zduplikowany tekst opcji")
    return ids


def check_question(q, section_ids, topic_ids):
    qid = q.get("id", "?")
    where = f"question {qid}"
    for f in ["id", "section", "topic", "type", "question", "explanation"]:
        if not nonempty_str(q.get(f)):
            err(f"{where}: brak/pusty '{f}'")
    for f in ["options", "correct"]:
        if f not in q:
            err(f"{where}: brak '{f}'")
    check_source(where, q)
    if q.get("section") not in section_ids:
        err(f"{where}: nieznany section '{q.get('section')}'")
    if q.get("topic") not in topic_ids:
        warnings.append(f"{where}: topic '{q.get('topic')}' nie odpowiada żadnej lekcji (będzie dostępny tylko w quizie)")
    blob = json.dumps({k: q.get(k) for k in ("question", "options", "correct")}, ensure_ascii=False)
    if "⚠️" in blob or "⚠" in blob:
        err(f"{where}: treść oznaczona ⚠️ nie może być pytaniem z jednoznaczną odpowiedzią")

    t = q.get("type")
    if t not in QTYPES:
        err(f"{where}: nieznany type '{t}'")
        return
    opts, corr = q.get("options"), q.get("correct")

    if t in ("single", "scenario"):
        ids = check_options_list(where, opts, 3)
        if not isinstance(corr, str) or corr not in ids:
            err(f"{where}: 'correct' musi być jednym id z options {ids}, jest {corr!r}")
    elif t == "truefalse":
        ids = check_options_list(where, opts, 2)
        if sorted(ids) != ["F", "T"]:
            err(f"{where}: truefalse musi mieć opcje o id 'T' i 'F'")
        if corr not in ("T", "F"):
            err(f"{where}: truefalse 'correct' musi być 'T' albo 'F'")
    elif t == "multi":
        ids = check_options_list(where, opts, 3)
        if not isinstance(corr, list) or len(corr) < 2:
            err(f"{where}: multi 'correct' musi być listą min. 2 id")
        else:
            bad = [c for c in corr if c not in ids]
            if bad:
                err(f"{where}: 'correct' zawiera id spoza options: {bad}")
            if len(set(corr)) != len(corr):
                err(f"{where}: zduplikowane id w 'correct'")
            if len(corr) >= len(ids):
                err(f"{where}: multi musi mieć co najmniej jedną błędną opcję")
            m = re.search(r"Choose (\d)", q.get("question", ""))
            if not m:
                err(f"{where}: pytanie multi powinno zawierać '(Choose N)'")
            elif int(m.group(1)) != len(corr):
                err(f"{where}: '(Choose {m.group(1)})' nie zgadza się z liczbą poprawnych ({len(corr)})")
    elif t == "match":
        if not isinstance(opts, dict) or "left" not in opts or "right" not in opts:
            err(f"{where}: match 'options' musi być obiektem {{left:[...], right:[...]}}")
            return
        lids = check_options_list(where + " (left)", opts["left"], 2)
        rids = check_options_list(where + " (right)", opts["right"], 2)
        if len(lids) != len(rids):
            err(f"{where}: left i right muszą mieć tyle samo elementów")
        if len(lids) > 6:
            warnings.append(f"{where}: ponad 6 par – na telefonie będzie ciasno")
        if not isinstance(corr, dict):
            err(f"{where}: match 'correct' musi być obiektem left_id -> right_id")
            return
        if sorted(corr.keys()) != sorted(lids):
            err(f"{where}: klucze 'correct' muszą odpowiadać wszystkim left id")
        if sorted(corr.values()) != sorted(rids):
            err(f"{where}: wartości 'correct' muszą użyć każdego right id dokładnie raz")


def main():
    sections = load("sections.json")
    lessons = load("lessons.json")
    questions = load("questions.json")
    if errors:
        report()
        return

    sec_list = sections.get("sections", [])
    section_ids = {s.get("id") for s in sec_list}
    if len(section_ids) != len(sec_list):
        err("sections.json: zduplikowane id działów")
    total_w = sum(s.get("weight", 0) for s in sec_list)
    if total_w != 100:
        err(f"sections.json: suma wag = {total_w}, powinna być 100")

    subtopics = lessons.get("subtopics", [])
    sub_ids = set()
    for s in subtopics:
        w = f"subtopic {s.get('id')}"
        if s.get("section") not in section_ids:
            err(f"{w}: nieznany section")
        check_source(w, s)
        sub_ids.add(s.get("id"))

    lesson_ids = []
    qids_all = {q.get("id") for q in questions.get("questions", [])}
    for l in lessons.get("lessons", []):
        lid = l.get("id", "?")
        w = f"lesson {lid}"
        lesson_ids.append(lid)
        for f in ["id", "section", "subtopic", "title"]:
            if not nonempty_str(l.get(f)):
                err(f"{w}: brak '{f}'")
        check_source(w, l)
        if l.get("section") not in section_ids:
            err(f"{w}: nieznany section")
        if l.get("subtopic") not in sub_ids:
            err(f"{w}: nieznany subtopic '{l.get('subtopic')}'")
        cards = l.get("cards", [])
        if not cards:
            err(f"{w}: brak kart")
        for i, c in enumerate(cards):
            cw = f"{w} card[{i}]"
            ct = c.get("type")
            if ct not in CARD_FIELDS:
                err(f"{cw}: nieznany type '{ct}'")
                continue
            for f in CARD_FIELDS[ct]:
                if f not in c or c[f] in ("", [], None):
                    err(f"{cw}: brak '{f}'")
            check_source(cw, c)
            if ct == "table":
                n = len(c.get("headers", []))
                for r, row in enumerate(c.get("rows", [])):
                    if len(row) != n:
                        err(f"{cw}: wiersz {r} ma {len(row)} kolumn zamiast {n}")
        checks = l.get("checks", [])
        if not 3 <= len(checks) <= 5:
            err(f"{w}: 'checks' powinno mieć 3–5 pytań (ma {len(checks)})")
        for c in checks:
            if c not in qids_all:
                err(f"{w}: check '{c}' nie istnieje w questions.json")
    dup = [k for k, c in Counter(lesson_ids).items() if c > 1]
    if dup:
        err(f"lessons.json: zduplikowane id lekcji {dup}")

    qlist = questions.get("questions", [])
    ids = [q.get("id") for q in qlist]
    dup = [k for k, c in Counter(ids).items() if c > 1]
    if dup:
        err(f"questions.json: zduplikowane id pytań {dup}")
    for q in qlist:
        check_question(q, section_ids, set(lesson_ids))

    types = Counter(q.get("type") for q in qlist)
    print(f"Działy: {len(sec_list)} | Podtematy: {len(subtopics)} | Lekcje: {len(lesson_ids)} | Pytania: {len(qlist)}")
    print("Typy pytań:", dict(types))
    per_sec = Counter(q.get("section") for q in qlist)
    print("Pytania per dział:", dict(per_sec))
    report()


def report():
    for w in warnings:
        print("UWAGA:", w)
    for e in errors:
        print("BŁĄD:", e)
    print("OK – brak błędów." if not errors else f"{len(errors)} błędów.")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
