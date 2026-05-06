# Site text overrides

The locale file in `src/locales/en.json` is still the canonical list of
translation namespaces and keys. It provides file defaults, next-intl typing,
and `check:i18n` validation.

Admins can edit live copy at `/admin/site_text/`. Those edits write rows to the
`site_text_overrides` table only; they do not edit `src/locales/en.json` or
require a rebuild.

At runtime, `src/libs/I18n.ts` loads messages through the site text loader:

1. Import the deployed `src/locales/en.json` defaults.
2. Load DB overrides for the locale on cache miss.
3. Ignore overrides whose namespace/key no longer exists in the file.
4. Cache the merged messages in the Node process.

Admin saves clear the in-process cache and revalidate the app layout, so the
next request sees the new text. GitHub CI deploys also clear the cache naturally
because Docker recreates the app container.

## Deploys and new defaults

On a new deploy, the deployed `en.json` becomes the new baseline. Existing DB
overrides still win for matching keys. New keys use file defaults until an admin
adds an override. Removed or renamed keys leave stale DB rows that are ignored
and reported on the Site text admin page.

## Exporting DB edits back to the file

When live DB edits should become source-controlled defaults, run:

```bash
dotenv -c -- tsx scripts/export-i18n-overrides.ts en
```

Review and commit the resulting `src/locales/en.json` diff. After deploy, any DB
override that now matches the file default can be reset from `/admin/site_text/`
to keep the override table small.
