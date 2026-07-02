# stredio-translations

UI translation strings for [STREDIO](https://github.com/Shon1a/Stredio) — one JSON file per language, loaded by the site at runtime. English ships inline as an offline fallback; other languages load on demand.

## Structure

```
index.json     manifest — lists every available language (drives the in-app picker)
en.json        English — the source of truth; every key lives here first
ka.json        Georgian (ქართული)
xx.json        add a language by copying en.json and translating the values
```

Keys are flat, dotted strings (`nav.home`, `player.skip_intro`). A `{placeholder}` token inside a value is filled in by the app — leave it unchanged and translate only the surrounding words.

## Add a language

1. Copy `en.json` to `<code>.json` using the short [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) code (e.g. `de.json`).
2. Translate the **values only** — never change a key or a `{placeholder}` token.
3. Add an entry to `index.json`:
   ```json
   { "code": "de", "name": "German", "nativeName": "Deutsch", "short": "DE", "file": "de.json" }
   ```
4. Open a pull request. The in-app picker updates automatically.

## Update a language

Edit the matching `<code>.json`. Keep **every** key that `en.json` has — missing keys fall back to English, which leaves gaps in the UI. `validate.js` checks each file against `en.json`.

## License

Translation strings are released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
