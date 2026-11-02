# Security deep dive – notatki MCE Admin

Nov 2, 2026 · @Lukasz

## 📌 Temat i TL;DR

Dział: Digital Marketing Proficiency – 13% (security, uprawnienia, PII). Część rzeczy dotyczy też Setup (Security Settings, BU). Źródło: Trailhead Marketing Cloud Engagement Security + dokumentacja (FLE, Tokenized Sending).

TL;DR

- Security Settings mają konkretne zalecane wartości (timeout 20 min, lockout 3 próby, hasło ≥ 8 znaków, history ≥ 8, wygasanie 90 dni). Nowy BU dziedziczy ustawienia od rodzica, ale pierwsza zmiana w BU zrywa dziedziczenie na zawsze.
- Audit Trail basic (30 dni, dla wszystkich) trzeba włączyć checkboxem. Advanced (zmiany treści i danych, session ID, BU) kupujesz przez account executive.
- Data at Rest (AES-256) jest przezroczysty dla aplikacji, ale nie obejmuje Predictive Intelligence i Audience Builder. Field-Level Encryption wymaga Professional Services, DE z Contact Builder i osobnych kluczy per BU.
- CloudPages zabezpieczasz przez SSL, szyfrowanie parametrów (MicrositeURL, nie Base64), walidację po stronie serwera i security headers. Integracje API: least privilege, na serwerze tylko refresh token.
- Tokenized Sending: nowe konto, osobny tenant, Twój resolver po HTTPS 443, a token zamieniany jest na dane w pamięci w chwili wysyłki.
