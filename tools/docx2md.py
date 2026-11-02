"""Konwersja notatki .docx -> .md (nagłówki, listy, tabele).

Użycie:  python tools/docx2md.py "notatki/plik.docx" notatki/plik.md
"""
import html
import re
import sys
import zipfile


def text_of(fragment: str) -> str:
    return html.unescape("".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", fragment))).strip()


def convert(src: str) -> str:
    xml = zipfile.ZipFile(src).read("word/document.xml").decode("utf-8")
    out = []
    for m in re.finditer(r"<w:tbl>.*?</w:tbl>|<w:p[ >].*?</w:p>", xml, re.S):
        block = m.group(0)
        if block.startswith("<w:tbl>"):
            rows = []
            for row in re.findall(r"<w:tr[ >].*?</w:tr>", block, re.S):
                cells = [text_of(c).replace("|", "\\|") for c in re.findall(r"<w:tc>.*?</w:tc>", row, re.S)]
                rows.append("| " + " | ".join(cells) + " |")
            if rows:
                ncols = rows[0].count("|") - 1
                rows.insert(1, "|" + " --- |" * ncols)
            out.append("\n".join(rows))
            continue
        t = text_of(block)
        if not t:
            continue
        style = re.search(r'w:pStyle w:val="([^"]+)"', block)
        style = style.group(1) if style else ""
        h = re.match(r"Heading(\d)", style)
        if h:
            out.append("#" * int(h.group(1)) + " " + t)
        elif "<w:numPr>" in block:
            out.append("- " + t)
        else:
            out.append(t)
    # sklej elementy list bez pustych linii
    md = ""
    for i, line in enumerate(out):
        if i and not (line.startswith("- ") and out[i - 1].startswith("- ")):
            md += "\n"
        md += line + "\n"
    return md


if __name__ == "__main__":
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        f.write(convert(sys.argv[1]))
    print("OK ->", sys.argv[2])
