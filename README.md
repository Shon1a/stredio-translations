# Stredio Translations

UI translation strings for [Stredio](https://stredio.com). Inspired by
[`Stremio/stremio-translations`](https://github.com/Stremio/stremio-translations):
one JSON file per language, loaded by the site at runtime over a CDN.

## Structure

```
index.json     # manifest — lists every available language (drives the in-app picker)
en.json        # English — the source of truth. Every key lives here first.
ka.json        # Georgian (ქართული)
xx.json        # add more languages by copying en.json and translating the values
```

Keys are flat, dotted strings (`nav.home`, `ui.filters_t`, `player.skip_intro`).
`{placeholder}` tokens inside a value are filled in by the app — **keep them
unchanged** and only translate the surrounding words.

## How the site loads these

Stredio bundles `en.json` inline as an offline fallback, then fetches the
selected language from jsDelivr:

```
https://cdn.jsdelivr.net/gh/Shon1a/stredio-translations@main/<code>.json
```

The language picker in the app is built from `index.json`, so a new language
appears automatically once it is added there.

> jsDelivr caches `@main` for up to 12h. To force-refresh after an edit, either
> tag a release and point the app at the tag, or purge:
> `https://purge.jsdelivr.net/gh/Shon1a/stredio-translations@main/<code>.json`

## Add a new language

1. Copy `en.json` to `<code>.json` (e.g. `de.json` for German). Use the short
   [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes) code.
2. Translate **only the values**. Never change a key, and never touch
   `{placeholder}` tokens.
3. Add an entry to `index.json`:
   ```json
   { "code": "de", "name": "German", "nativeName": "Deutsch", "short": "DE", "file": "de.json" }
   ```
4. Open a pull request.

## Update an existing language

Edit the matching `<code>.json`. Make sure it has **every** key that `en.json`
has — missing keys fall back to English at runtime, which is fine but leaves
gaps in the UI.

## License

Translation strings are released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
