# Słówka DE

Prosta PWA do nauki słówek niemieckich: fiszki i test (wybór z 3, wpisywanie albo mix),
kierunek PL→DE, DE→PL lub mieszany. Bez serwera i bez kont, wszystko w przeglądarce (`localStorage`).

- Przy wpisywaniu brak umlautu nie jest błędem (`kase` = `kaese` = `Käse`), aplikacja pokazuje poprawną pisownię.
  Na ekranie są klawisze ä ö ü ß.
- Rodzajnik der/die/das jest opcjonalny, chyba że w ustawieniach włączysz „Wymagaj rodzajnika”.
- Własne listy dodajesz w zakładce **Listy** w formacie `der Hund = pies`, po jednym słówku w linii.
  Kilka znaczeń rozdzielasz ukośnikiem.
- Słówka z błędami trafiają do „Trudne słówka” na ekranie głównym, a w sesji błędne słówko wraca 3 pytania później.
- **Plan „Dzisiaj”**: słówka dzielone na dni od daty startu do dnia przed testem (Ustawienia), ostatnie 2 dni to powtórka
  i próbny test. Codziennie: powtórka z poprzednich dni → fiszki z nowymi → test z nowymi. Seria dni 🔥, gwiazdka za dzień,
  licznik „umiesz X/78” (słówko umiesz po 2 dobrych odpowiedziach z rzędu). Datę do testów podmienisz przez `?dzis=2026-11-05`.
- Tryby dodatkowe: „Posłuchaj i wybierz” oraz „Rodzajniki” (der niebieski, die czerwony, das zielony).

## Uruchomienie lokalne

```sh
python3 -m http.server 8765
```

## Instalacja na iPhonie

Aplikacja musi stać pod adresem HTTPS (np. GitHub Pages). Potem w Safari otwierasz adres →
**Udostępnij → Do ekranu początkowego**. Działa offline. Po zmianie plików podbij `CACHE` w `sw.js`.
