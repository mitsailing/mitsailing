# Site text (retired)

Live database copy overrides were removed in favor of editing
`src/locales/en.json` directly. Deploys pick up locale file changes after
rebuild.

Before the retirement migration, any production overrides could be folded into
the locale file with a one-off export against the `site_text_overrides` table.
That admin UI and runtime merge path no longer exist.
