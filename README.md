# MCE Admin – nauka w stylu Duolingo

Apka do nauki do egzaminu **Salesforce Certified Marketing Cloud Engagement Administrator**.
Czysty HTML + CSS + vanilla JS (ES modules), bez frameworków i bez budowania.

## Uruchomienie

W folderze projektu (PowerShell albo cmd):

```powershell
cd D:\certapp\mce-study-app
python serve.py
```

Serwer wypisze adres dla telefonu, np. `http://192.168.0.92:8000`. Telefon musi być w tej samej sieci Wi-Fi. Zatrzymanie serwera: `Ctrl+C`.

> **Dlaczego `serve.py`, a nie `python -m http.server 8000 --bind 0.0.0.0`?**
> Na tym Windowsie rejestr przypisuje plikom `.js` typ `text/plain`. Wtedy `http.server` serwuje je źle, a przeglądarka odrzuca moduły ES i apka pokazuje pusty ekran.
> `serve.py` robi to samo (nasłuch na `0.0.0.0:8000`), ale wymusza poprawne typy MIME i wyłącza cache, więc zmiany w JSON-ach widać od razu.
> Zwykły `http.server` zadziała dopiero po naprawie rejestru: `HKEY_CLASSES_ROOT\.js` → `Content Type` = `text/javascript`.

Adres IP komputera sprawdzisz poleceniem `ipconfig` (pole „Adres IPv4” karty Wi-Fi). IP z routera może się zmienić po restarcie, ale `serve.py` zawsze wypisuje aktualny adres.

### Zapora Windows

Jeśli telefon nie może się połączyć (strona ładuje się w nieskończoność), uruchom **PowerShell jako administrator** i dodaj regułę dla portu 8000:

```powershell
New-NetFirewallRule -DisplayName "MCE study app (TCP 8000)" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private,Public
```

Usunięcie reguły: `Remove-NetFirewallRule -DisplayName "MCE study app (TCP 8000)"`.

Lepiej ustawić domową sieć Wi-Fi jako **prywatną**: Ustawienia → Sieć i Internet → Wi-Fi → (Twoja sieć) → Typ profilu sieci: Prywatna. Wtedy w regule wystarczy `-Profile Private`.

### Dodanie do ekranu głównego

- **iPhone (Safari):** Udostępnij → „Do ekranu początkowego”.
- **Android (Chrome):** ⋮ → „Dodaj do ekranu głównego”.

Postęp jest w `localStorage` przeglądarki telefonu, pod kluczem `mce-study:v1`. Jest związany z adresem: jeśli IP komputera się zmieni, przeglądarka potraktuje apkę jak inną stronę. Przed zmianą sieci lub IP zrób eksport w Profil → „Eksportuj postęp”, a potem import.

## Online (GitHub Pages)

Pierwsza publikacja:
1. Na github.com utwórz **puste** repozytorium `mce-study-app`, bez README i bez .gitignore.
2. W folderze projektu:
   ```powershell
   git remote add origin https://github.com/TWOJ-LOGIN/mce-study-app.git
   git push -u origin main
   ```
3. Na GitHubie: Settings → Pages → Source: „Deploy from a branch” → Branch `main`, folder `/ (root)` → Save.
   Po około minucie apka działa pod adresem `https://TWOJ-LOGIN.github.io/mce-study-app/`.

Kolejne zmiany publikujesz tak:
```powershell
python tools/validate.py
git add -A
git commit -m "Nowe lekcje"
git push
```
Strona aktualizuje się po około minucie.

## Struktura

```
index.html            szkielet + dolna nawigacja
manifest.json         PWA (ikona, nazwa, tryb standalone)
css/style.css         ciemny motyw, mobile-first
js/app.js             router, ekrany: Lekcje | Quiz | Powtórki | Profil
js/quiz.js            silnik pytań (5 typów), feedback, podsumowanie
js/srs.js             Leitner – 5 pudełek (0 / 1 / 3 / 7 / 14 dni)
js/game.js            XP, serduszka (5, +1 co 30 min), streak
js/storage.js         localStorage (try/catch), eksport/import/reset
js/ui.js              helpery (mini-markdown, toast)
data/sections.json    działy egzaminu i wagi + ustawienia egzaminu próbnego
data/lessons.json     podtematy i lekcje (karty + pytania sprawdzające)
data/questions.json   bank pytań
notatki/              źródła treści (.md)
tools/validate.py     walidator treści – uruchamiaj po każdej zmianie
tools/docx2md.py      konwersja notatki .docx → .md
serve.py              serwer deweloperski
```

Treść jest **wyłącznie w JSON-ach**. Każdy element ma pole `"source"` z nazwą pliku z `notatki/`.

## Jak dodać nową notatkę

1. Wrzuć plik do `notatki/`, np. `notatki/business-units.md`. Notatkę w Wordzie najpierw przekonwertuj:
   ```powershell
   python tools/docx2md.py "notatki/Moja notatka.docx" notatki/moja-notatka.md
   ```
2. W `data/lessons.json` dodaj podtemat, jeśli jest nowy:
   ```json
   { "id": "setup-bu", "section": "setup", "name": "Business Units", "source": "business-units.md" }
   ```
   `section` to jedno z id w `data/sections.json`: `setup`, `data-management`, `channel-management`, `maintenance`, `digital-marketing-proficiency`. Dział z pierwszą lekcją przestaje być wyszarzony jako „Wkrótce”.
3. Dodaj lekcję do tablicy `lessons`. Kolejność w tablicy wyznacza kolejność odblokowywania w obrębie działu.
   ```json
   {
     "id": "business-units",
     "section": "setup",
     "subtopic": "setup-bu",
     "title": "Business Units",
     "icon": "🏢",
     "source": "business-units.md",
     "cards": [
       { "type": "explain",  "title": "Co to jest?", "body": "Tekst. **Pogrubienie**.\n\n- punkt listy\n- drugi punkt", "source": "business-units.md" },
       { "type": "steps",    "title": "Krok po kroku", "items": ["Pierwszy", "Drugi"], "source": "business-units.md" },
       { "type": "table",    "title": "Porównanie", "headers": ["", "A", "B"], "rows": [["Cecha", "x", "y"]], "source": "business-units.md" },
       { "type": "trap",     "body": "„Hasło z pytania” → **odpowiedź**.", "source": "business-units.md" },
       { "type": "mnemonic", "body": "Rymowanka.", "source": "business-units.md" },
       { "type": "warning",  "body": "Coś oznaczonego w notatce ⚠️ – do sprawdzenia.", "source": "business-units.md" },
       { "type": "scenario", "title": "Tytuł", "problem": "…", "cause": "…", "solution": "…", "source": "business-units.md" }
     ],
     "checks": ["q-bu-01", "q-bu-02", "q-bu-03"]
   }
   ```
   - `checks` to 3–5 id pytań z `questions.json`. Zaliczenie od 80% (`lessonPassPercent` w `sections.json`) odblokowuje następną lekcję.
   - Znak ⚠️ w tekście karty wyświetla się jako znacznik „⚠️ do sprawdzenia”. Rzeczy z ⚠️ nie mogą być pytaniami z jednoznaczną odpowiedzią, a walidator to wyłapie.
4. Dopisz pytania (niżej) i uruchom walidator:
   ```powershell
   python tools/validate.py
   ```
5. Odśwież stronę w telefonie.

## Jak ręcznie dopisać pytanie

Pytania dopisujesz do tablicy `questions` w `data/questions.json`. Pola wspólne:

| pole | opis |
|---|---|
| `id` | unikalne, np. `q-bu-01` |
| `section` | id działu z `sections.json` |
| `topic` | id lekcji (wtedy pytanie jest w Szybkim quizie dla tego tematu) |
| `type` | `single` · `multi` · `truefalse` · `match` · `scenario` |
| `question` | treść po angielsku, w stylu egzaminu |
| `options` | odpowiedzi (format zależy od typu) |
| `correct` | poprawna odpowiedź (format zależy od typu) |
| `explanation` | 1–2 zdania po polsku: DLACZEGO |
| `source` | plik w `notatki/` |

Opcje są w UI tasowane (oprócz True/False), a litery A–D nadawane są na nowo. Dlatego **w `explanation` nie odwołuj się do liter**, tylko do treści.

### `single` – jednokrotny wybór

```json
{
  "id": "q-bu-01", "section": "setup", "topic": "business-units", "type": "single",
  "question": "Which ... ?",
  "options": [
    { "id": "A", "text": "..." }, { "id": "B", "text": "..." },
    { "id": "C", "text": "..." }, { "id": "D", "text": "..." }
  ],
  "correct": "B",
  "explanation": "B, bo ...",
  "source": "business-units.md"
}
```

### `scenario` – scenariusz „What should the administrator do?”

Format jak `single`, ale `question` zawiera krótką historię:

```json
{
  "id": "q-bu-02", "section": "setup", "topic": "business-units", "type": "scenario",
  "question": "Northern Trails Outfitters has ... . What should the administrator do?",
  "options": [
    { "id": "A", "text": "..." }, { "id": "B", "text": "..." },
    { "id": "C", "text": "..." }, { "id": "D", "text": "..." }
  ],
  "correct": "C",
  "explanation": "...",
  "source": "business-units.md"
}
```

### `multi` – „Choose 2 / Choose 3”

`correct` to lista. W treści musi być `(Choose N)`, gdzie N = liczba poprawnych. Punkt jest tylko za komplet poprawnych odpowiedzi.

```json
{
  "id": "q-bu-03", "section": "setup", "topic": "business-units", "type": "multi",
  "question": "Which TWO ... ? (Choose 2)",
  "options": [
    { "id": "A", "text": "..." }, { "id": "B", "text": "..." },
    { "id": "C", "text": "..." }, { "id": "D", "text": "..." }
  ],
  "correct": ["A", "C"],
  "explanation": "...",
  "source": "business-units.md"
}
```

### `truefalse`

Opcje muszą mieć id `T` i `F`.

```json
{
  "id": "q-bu-04", "section": "setup", "topic": "business-units", "type": "truefalse",
  "question": "Statement to evaluate.",
  "options": [ { "id": "T", "text": "True" }, { "id": "F", "text": "False" } ],
  "correct": "F",
  "explanation": "...",
  "source": "business-units.md"
}
```

### `match` – dopasuj pary

`options` ma kolumny `left` i `right` (tyle samo elementów, najlepiej 3–5). `correct` mapuje id z lewej na id z prawej.

```json
{
  "id": "q-bu-05", "section": "setup", "topic": "business-units", "type": "match",
  "question": "Match each term with its description.",
  "options": {
    "left":  [ { "id": "1", "text": "Termin 1" }, { "id": "2", "text": "Termin 2" }, { "id": "3", "text": "Termin 3" } ],
    "right": [ { "id": "a", "text": "Definicja 1" }, { "id": "b", "text": "Definicja 2" }, { "id": "c", "text": "Definicja 3" } ]
  },
  "correct": { "1": "a", "2": "b", "3": "c" },
  "explanation": "...",
  "source": "business-units.md"
}
```

### Walidator

`python tools/validate.py` sprawdza między innymi:
- unikalność id,
- czy `correct` pasuje do `options`,
- `(Choose N)` w pytaniach `multi`,
- kompletność par w `match`,
- czy plik z pola `source` istnieje,
- czy `checks` w lekcjach wskazują istniejące pytania,
- czy w pytaniach nie ma treści z ⚠️.

Kod wyjścia 1 oznacza błędy, które trzeba poprawić.

## Mechanika

- **XP:** +10 za dobrą odpowiedź, +20 za zaliczoną lekcję, +5 za dobrą odpowiedź w próbnym egzaminie.
- **Serduszka:** 5, tracisz 1 za błąd w lekcji, Szybkim quizie i Moich błędach. Odnawiają się 1 na 30 min. Powtórki i Próbny egzamin nie zużywają serduszek.
- **Streak:** liczba kolejnych dni z co najmniej jedną ukończoną sesją.
- **Leitner:** dobra odpowiedź przesuwa pytanie o pudełko w górę (wraca po 1 → 3 → 7 → 14 dniach), błąd cofa je do pudełka 1 (wraca od razu).
- **Moje błędy:** pytania z ostatnią złą odpowiedzią. Dobra odpowiedź usuwa pytanie z listy.
- **Próbny egzamin:** liczba pytań i czas w `sections.json → mockExam`. Pytania są losowane według wag działów, tylko z działów, które mają pytania. W trakcie nie ma podpowiedzi. Na końcu jest wynik %, rozbicie na działy i przegląd błędów.
