# Governance, Compliance & Security – notatki MCE Admin

Nov 1, 2026 · @Lukasz

## 📌 Temat i TL;DR

Dział: Digital Marketing Proficiency – 13% egzaminu. Podtematy: Describe governance and compliance in relation to digital marketing oraz Recognize security best practices for data, permissions, and PII.

TL;DR

- Governance to wewnętrzne zasady prowadzenia marketingu, a compliance to przestrzeganie prawa (w USA: CAN-SPAM Act). Razem chronią zaufanie klientów i reputację nadawcy.
- Dobra deliverability opiera się na explicit opt-in (najlepiej double opt-in), czystej liście (list hygiene, brak spam traps) i stopniowym warmingu nowego IP lub domeny.
- Bezpieczeństwo konta to Security Settings (Session Timeout, hasła, lockout, MFA, Login IP Allowlist), Export Email Allowlist, Audit Trail i poprawne role (Deny zawsze wygrywa).
- Dane chronisz szyfrowaniem: Field-Level Encryption, Data at Rest Encryption, AMPscript + klucze z Key Management. Jeśli danych nie wolno trzymać w SFMC, używasz Tokenized Sending.

## 📖 Kluczowe pojęcia

### Governance, compliance, deliverability

| Termin | Co to jest | Kiedy / po co |
| --- | --- | --- |
| CAN-SPAM Act | Amerykańska ustawa o mailach komercyjnych | Każdy commercial email: adres fizyczny, działający opt-out, uczciwy header i temat |
| Opt-out mechanism | Link unsubscribe albo preference center | Ma być łatwy: bez logowania, max 1 strona. Musi działać min. 30 dni po wysyłce. Wypis realizujesz w ciągu 10 dni |
| Transactional email | Potwierdzenie zamówienia, reset hasła | Zwolniony z większości CAN-SPAM. Zostaje tylko accurate sender identification |
| Explicit opt-in | Bezpośrednia, świadoma zgoda klienta, np. formularz | Jedyna prawidłowa podstawa wysyłki marketingowej. Checkbox nie może być pre-checked |
| Confirmed / Double Opt-In (COI) | Zapis + mail „potwierdź” + klik | Weryfikuje właściciela adresu, czyści bazę, podnosi engagement i ROI, blokuje boty |
| Spam trap – honeypot | Adres stworzony tylko po to, by łapać spamerów | Trafienie = kupiona albo zescrapowana lista |
| Spam trap – recycled | Porzucony adres, który po 6–12 mies. nieaktywności stał się pułapką | Trafienie = zła list hygiene, wysyłasz do martwych adresów |
| List hygiene | Regularne czyszczenie listy | Usuwanie hard bounce’ów, nieaktywnych i skarżących się |
| Data View: Complaint (_Complaint) | Tabela systemowa ze skargami na spam | Sprawdzasz, kto oznaczył maila jako spam (SQL w Query Activity) |
| Warming | Stopniowe budowanie reputacji nowego IP lub domeny | Nowa marka, nowe ESP, dedicated IP. Najpierw najbardziej zaangażowani, +20% dziennie |
| Shared IP | IP współdzielone z innymi klientami Salesforce | Mały wolumen. Złe wysyłki szkodzą innym, a Salesforce może zawiesić konto |
| Dedicated IP | Własne IP | Bardzo duży wolumen, pełna kontrola nad reputacją. Zamawiasz przez account executive |
| Einstein Send Time Optimization | AI wybiera najlepszą godzinę wysyłki dla odbiorcy | Poprawa zaangażowania i mniej negatywnych reakcji |

### Security

| Termin | Co to jest | Kiedy / po co |
| --- | --- | --- |
| Session Timeout | Automatyczne wylogowanie po bezczynności (15 min–8 h) | Ochrona porzuconych sesji. Zalecane: 20 min |
| Password Policies | Min. długość, complexity, history, expiration | Silne hasła. Opcje Exclude API / FTP Users From Password Expiration chronią integracje |
| Invalid Logins Before Lockout | Blokada konta po X błędnych hasłach | Ochrona przed brute force |
| Multi-Factor Authentication (MFA) | Drugi składnik logowania | Chroni przed phishing, credential stuffing, account takeover |
| Login IP Allowlist | Logowanie tylko z zakresów IP firmy | Dotyczy UI i API, chroni przed malicious API attacks. Spoza listy: odmowa + wpis w logu |
| Export Email Allowlist | Eksporty tylko na wskazane maile i domeny | Subscriber exports i eksporty z tracking pages nie wyciekną na prywatne skrzynki |
| Audit Trail | Log dostępów i zmian | Logowania, IP, zmiany userów, ról, uprawnień, security settings. Pobierasz przez Automation Studio albo REST API |
| Roles | Zestawy uprawnień | 1 standardowa rola Marketing Cloud + 1 standardowa rola Email Studio na usera |
| Deny permission | Jawny zakaz dostępu do funkcji | Wygrywa z każdym Allow. Rozwiązanie: usuń rolę z Deny |
| Field-Level Encryption | Szyfrowanie at rest wybranych pól w Data Extensions | Polityki prywatności, regulacje, umowy |
| Data at Rest Encryption | Szyfrowanie plików w systemie plików (I/O) | Ochrona całej bazy bez zmian w funkcjach aplikacji |
| AMPscript encryption | EncryptSymmetric() / DecryptSymmetric() + klucze | Szyfrowanie wartości w email sends i file transfer activities |
| Key Management | Setup → Data Management → Key Management | Tworzenie i trzymanie kluczy |
| Tokenized Sending | W SFMC jest tylko token, a prawdziwe dane są pobierane przez API przy wysyłce | PII / PHI, których nie wolno przechowywać w SFMC |

## ⚙️ Jak to działa

### Wymogi CAN-SPAM dla commercial email

- Header (From, Reply-to) uczciwie identyfikuje nadawcę.
- Subject line odpowiada treści maila.
- Mail jest oznaczony jako reklama, chyba że masz opt-in.
- Jest fizyczny adres pocztowy nadawcy (w SFMC stopka i adres są w Delivery Profile).
- Jest działający opt-out: bez logowania, max 1 strona, działa min. 30 dni, wypis zrealizowany w 10 dni (w ustawie: dni robocze).

### Proces opt-in

- Klient sam wypełnia formularz, a checkbox zgody nie jest domyślnie zaznaczony.
- Dostaje maila z prośbą o potwierdzenie (double opt-in / COI).
- Dopiero po kliknięciu trafia na listę wysyłkową.

### Monitoring dostarczalności

- Metryki przeglądaj co 3–6 miesięcy: skargi, unsubscribe, hard bounce.
- Skargi sprawdzasz w _Complaint. Osobę skarżącą się wypisujesz z listy lub ze wszystkich list, oznaczasz Do Not Email albo usuwasz rekord.
- Inne działania: sprawdź jakość treści i aktualność zgód, testuj godziny wysyłki (Einstein STO), personalizuj, co jakiś czas wysyłaj prośbę o aktualizację preferencji.

### Warming krok po kroku

- Wybierz najbardziej zaangażowanych: nowe zapisy i kliknięcia z ostatnich 30 dni.
- Wysyłaj małe paczki tylko do nich.
- Zwiększaj wolumen o ~20% dziennie.
- Przy ~70% bazy dziennie przejdź na pełną bazę.
- Spadek zaangażowania, throttling albo blokady: zatrzymaj się na obecnym wolumenie, wznów po stabilizacji metryk.

### Security Settings (Setup → Security → Security Settings)

- Session Settings: Session Timeout (zalecane 20 min), Require Secure Connections (https).
- Username and Logins: Login Expires After Inactivity, Invalid Logins Before Lockout, Minimum Username Length, Restrict Logins by IP Address (np. Log Violations & Deny Access), IP Allowlisting List Source (np. Defined at Business Unit level), Enable Username and Password for Web Services.
- Password Policies: Minimum Password Length, Password Complexity, Enforce Password History, User Passwords Expire In, Exclude API Users / Exclude FTP Users From Password Expiration, Send Password Change Confirmation Email.
- Osobne strony w menu Security: Multi-Factor Authentication, Login IP Allowlist (zakresy Start IP–End IP, opis, Login Source, przycisk View Access Log; lista automatycznie zawiera IP Salesforce), Export Email Allowlist, Domain Allowlist (⚠️ nie opisany w materiale).

### Typy kluczy (Key Management)

| Typ | Wymaga | Do czego |
| --- | --- | --- |
| Asymmetric | Upload certyfikatu | Szyfrowanie i odszyfrowywanie, cyfrowy podpis maili (np. pliki PGP w File Transfer Activity) |
| Symmetric | Passphrase | Szyfrowanie i odszyfrowywanie, cyfrowy podpis maili (AMPscript) |
| Salt | Wartość hex | JWT dla custom Journey Builder activities |
| SSH | Upload certyfikatu | Uwierzytelnianie SFTP |
| Initialization Vector | Wartość 16-„bitowa” ⚠️ (technicznie raczej bajty) | Field-level encryption |
| SSO Metadata | Metadane dostawcy SSO | Single Sign-On |

### Tokenized Sending

- W SFMC zapisany jest jeden token na send attribute. Wygląda jak zwykły email albo numer telefonu.
- User uruchamia wysyłkę.
- SFMC wywołuje API do hurtowni danych klienta.
- Tokeny są wymieniane na prawdziwe dane (clear data), mail wychodzi, a dane nie są zapisywane w SFMC.

## ⚖️ Porównania: co się myli

### Honeypot vs recycled spam trap

|  | Honeypot | Recycled trap |
| --- | --- | --- |
| Pochodzenie | Nigdy nie należał do człowieka | Prawdziwy adres porzucony na 6–12 mies. |
| Co zdradza | Kupiona lub zescrapowana lista | Brak czyszczenia listy |
| Lekarstwo | Tylko explicit opt-in, nigdy kupionych list | List hygiene, usuwanie nieaktywnych |

### Commercial vs transactional email (CAN-SPAM)

| Wymóg | Commercial | Transactional |
| --- | --- | --- |
| Uczciwy header (sender identification) | Tak | Tak |
| Temat zgodny z treścią | Tak | Nie |
| Adres fizyczny | Tak | Nie |
| Opt-out | Tak | Nie |

### Shared vs dedicated IP

|  | Shared IP | Dedicated IP |
| --- | --- | --- |
| Dla kogo | Mały wolumen | Bardzo duży wolumen |
| Reputacja | Wspólna z innymi | W pełni Twoja |
| Ryzyko | Salesforce może zawiesić konto | Szkodzisz tylko sobie |
| Warming | Wymagany | Wymagany |

### Która metoda ochrony danych?

| Potrzeba w scenariuszu | Odpowiedź |
| --- | --- |
| Dane mają być w SFMC, ale wybrane kolumny DE zaszyfrowane | Field-Level Encryption |
| Zabezpieczenie plików całej bazy, bez zmian w pracy userów | Data at Rest Encryption |
| Danych (PII / PHI) nie wolno trzymać w SFMC | Tokenized Sending |
| Zaszyfrowana wartość w mailu, linku albo przy transferze pliku | AMPscript + klucz |

### Który Allowlist?

| Allowlist | Kontroluje |
| --- | --- |
| Login IP Allowlist | Skąd (z jakiego IP) można się zalogować do UI i API |
| Export Email Allowlist | Dokąd (na jakie maile i domeny) trafiają eksporty danych |

### Które zabezpieczenie logowania?

| Zagrożenie | Ustawienie |
| --- | --- |
| Wykradzione lub wyciekłe hasło (phishing, credential stuffing) | MFA |
| Zgadywanie haseł | Lockout + MFA |
| Logowanie spoza firmy, ataki na API | Login IP Allowlist |
| Otwarta sesja na wspólnym komputerze | Session Timeout |
| Kto zmienił uprawnienia lub ustawienia? | Audit Trail |

## 🔢 Liczby do zapamiętania

| Liczba | Dotyczy |
| --- | --- |
| 10 dni | Realizacja prośby o wypis (CAN-SPAM, w ustawie dni robocze) |
| 30 dni | Minimalny czas działania linku opt-out po wysyłce |
| 6–12 mies. | Nieaktywność, po której adres może stać się recycled spam trap |
| co 3–6 mies. | Przegląd metryk dostarczalności |
| 30 dni | Okno „zaangażowanych” na start warmingu (zapis albo klik) |
| +20% dziennie | Tempo zwiększania wolumenu przy warmingu |
| ~70% bazy | Próg, po którym wysyłasz do całej bazy |
| < 2% | Docelowy bounce rate. Hard bounce usuwasz natychmiast |
| ≤ 0,1% | Docelowy poziom spam complaints |
| 2× w roku | Minimalna częstotliwość usuwania stale data |
| 2 lata + 6 mies. | Definicja stale: rekord starszy niż 2 lata i brak zaangażowania od 6 mies. |
| 20 min | Zalecany Session Timeout (opcje 15 min–8 h) |
| 1 + 1 | Role na usera: jedna Marketing Cloud + jedna Email Studio |

## 🎯 Pułapki egzaminacyjne

- „Kupiliśmy / wynajęliśmy listę od partnera” → to nie jest explicit opt-in. Nie wysyłać, bo rośnie ryzyko honeypotów.
- Checkbox zgody domyślnie zaznaczony → zła praktyka, a nie prawidłowy opt-in.
- „Który wymóg CAN-SPAM dotyczy też maili transakcyjnych?” → tylko accurate sender identification. Nie unsubscribe i nie adres fizyczny.
- Wypis wymaga logowania albo kilku stron → narusza CAN-SPAM.
- Wzrost spam trap hits po wysyłce do starej, uśpionej bazy → recycled traps i zła list hygiene.
- Migracja z innego ESP i od razu 2 mln maili → złe podejście. Najpierw warming od najbardziej zaangażowanych.
- Throttling w trakcie warmingu → zatrzymaj się na obecnym wolumenie. Nie zwiększaj i nie wysyłaj do wszystkich.
- „Gdzie sprawdzić, kto zgłosił spam?” → Data View _Complaint.
- „Nie wolno przechowywać maili / danych medycznych poza naszym systemem” → Tokenized Sending. Field-Level Encryption to pułapka, bo dane nadal leżą w SFMC.
- „Logowanie tylko z biura” → Login IP Allowlist, nie MFA.
- „Eksporty tylko do pracowników firmy” → Export Email Allowlist, nie Login IP Allowlist.
- User dostał rolę z Allow, a dalej nie widzi funkcji → inna jego rola ma Deny. Usuń tę rolę, a nie dokładaj kolejnych.
- „Nadałem wszystkie role, a funkcje zniknęły” → konflikt ról. Zostaw 1 rolę MC + 1 rolę Email Studio.
- Po wymuszeniu wygasania haseł padła integracja → Exclude API Users From Password Expiration.
- Klucze: JWT dla custom activity = Salt, SFTP = SSH, SSO = SSO Metadata, field-level encryption = Initialization Vector. Certyfikat wymagają Asymmetric i SSH, passphrase wymaga Symmetric.

## 🛠️ Mini-scenariusze z życia admina

Scenariusz 1: maile lądują w spamie

- Problem: po kampanii „reaktywacyjnej” do bazy sprzed 3 lat Gmail zaczął odrzucać maile, a spam complaints wzrosły do 0,4%.
- Przyczyna: stare, nieaktywne adresy, wśród nich recycled spam traps. Skargi są 4× powyżej progu 0,1%.
- Rozwiązanie: sprawdź _Complaint i wypisz skarżących się. Usuń stale data (starsze niż 2 lata i bez zaangażowania od 6 mies.). Wróć do wysyłek od najbardziej zaangażowanych, jak przy warmingu.

Scenariusz 2: user nie widzi Automation Studio

- Problem: analityk dostał rolę z dostępem do Automation Studio, ale narzędzie dalej się nie pokazuje.
- Przyczyna: inna przypisana mu rola ma Deny na tej funkcji, a Deny wygrywa z Allow.
- Rozwiązanie: usuń rolę z Deny. Zostaw 1 standardową rolę MC + 1 rolę Email Studio.

Scenariusz 3: szpital chce wysyłać przypomnienia o wizytach

- Problem: regulacje zabraniają przechowywania danych pacjentów (PHI) i ich adresów w zewnętrznym systemie.
- Przyczyna: Field-Level Encryption nie wystarczy, bo dane nadal byłyby w SFMC.
- Rozwiązanie: Tokenized Sending. W SFMC są tylko tokeny, a prawdziwe dane SFMC pobiera przez API z hurtowni szpitala w chwili wysyłki.

## ❓ 5 pytań kontrolnych

1. A healthcare company wants to send appointment reminders from Marketing Cloud Engagement, but its compliance policy prohibits storing patient email addresses outside its own data warehouse. Which feature should the administrator recommend?

- A. Field-Level Encryption
- B. Data at Rest Encryption
- C. Tokenized Sending
- D. Export Email Allowlist

2. A user was assigned a role that grants access to Automation Studio, but the user still cannot access it. What is the most likely cause?

- A. The user's session timed out
- B. Another role assigned to the user has a Deny permission for Automation Studio
- C. The Login IP Allowlist blocks the user
- D. The user needs all available roles assigned

3. During IP warming, the company notices that a major mailbox provider has started throttling its sends. What should the administrator do?

- A. Send to the full audience to finish warming faster
- B. Switch to a purchased list with fresh addresses
- C. Pause at the current volume and resume when metrics stabilize
- D. Double the daily volume to establish history

4. Which TWO requirements of the CAN-SPAM Act apply to commercial emails? (Choose 2)

- A. Include the sender's valid physical mailing address
- B. Require recipients to log in to unsubscribe
- C. Keep the opt-out mechanism working for at least 30 days after the send
- D. Use double opt-in for all subscribers

5. A developer builds a custom Journey Builder activity that requires JWT generation. Which key type should be created in Key Management?

- A. SSH
- B. Salt
- C. SSO Metadata
- D. Asymmetric

Odpowiedzi (przewiń dopiero po rozwiązaniu)

- C – dane nie mogą być przechowywane w SFMC, więc Tokenized Sending. A i B nadal trzymają dane w SFMC.
- B – Deny wygrywa z każdym Allow. D tworzy konflikty.
- C – przy throttlingu zatrzymujesz się na obecnym wolumenie i czekasz na stabilizację.
- A, C – adres fizyczny i opt-out działający min. 30 dni. B narusza CAN-SPAM. D to best practice, nie wymóg ustawy.
- B – Salt służy do generowania JWT dla custom Journey Builder activities.

## 🧠 Mnemotechniki

- Klucze – „Asy Są Silne, Szybkie, I Sprytne”: Asymmetric, Symmetric, Salt, SSH, Initialization Vector, SSO Metadata.
- Do czego klucz: Salt = JWT, SSH = SFTP, SSO Metadata = SSO, IV = field-level, Symmetric = passphrase, Asymmetric = certyfikat.
- Deny = weto: jedno „nie” blokuje wszystkie „tak”.
- Honeypot = miodek dla złodzieja: łapie tych, którzy kradną lub kupują adresy. Recycled = zombie: martwy adres, który wrócił jako pułapka.
- Allowlisty – „skąd i dokąd”: Login IP = skąd się logujesz, Export Email = dokąd idą dane.
- Warming jak siłownia: zaczynasz od małego ciężaru (najbardziej zaangażowani), dokładasz ~20% dziennie, a przy kontuzji (throttling) nie dokładasz, tylko czekasz.
- Liczby „2”: bounce < 2%, czyszczenie 2× w roku, stale = 2 lata (+6 mies. bez zaangażowania).
- Tokenized Sending = szatnia: w SFMC leży numerek (token), a kurtkę (prawdziwe dane) wydaje hurtownia klienta tylko w chwili wysyłki.
