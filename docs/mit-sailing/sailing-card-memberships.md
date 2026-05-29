# Sailing Card Memberships

This document is the product-domain source of truth for sailing-card membership labels, access, and pricing rules. Keep it in sync with onboarding copy, the public `/pricing` page, and membership billing changes.

## User-facing card types

| Internal value | User-facing label | Meaning |
|---|---|---|
| `normal` | Normal | General MITNA sailing membership with Pavilion sailing, classes, ratings, Charles River racing, and Mashnee access when the sailor has the required rating or approval. Mashnee is the 48-foot sailboat kept in Boston Harbor for blue-water sailing. Included for MIT students and MIT Recreation members. |
| `racing` | Pavilion racing | Charles River evening racing and race-related classes at the Sailing Pavilion. This does not include Mashnee. |
| `team_racing` | Thursday team racing | Thursday night team racing series only. This does not include Mashnee and is not MIT Sailing Team membership. |

The internal enum names are legacy storage names. Use `Normal` as the primary user-facing label for the `normal` card type.

## Included Normal access

Always present included Normal eligibility in this order:

1. MIT students.
2. MIT Recreation members.

Users who are not MIT students and are not MIT Recreation members can still choose paid Pavilion-racing or Thursday-team-racing cards.

If a user does not have MIT Recreation membership yet, they may still request Normal. Staff should not issue the sailing card number until MIT Recreation membership is active.

Normal includes ordinary Pavilion racing access. Pavilion-racing cards exist for people who do not have Normal and only need Charles River racing or race-related classes at the Sailing Pavilion.

MIT Recreation publishes 12-month memberships as monthly dues and has many eligibility categories, including alumni, employees, postdocs, MIT affiliates, sponsored Friends of MIT, Broad, Draper, Ragon, and corporate partners. When showing yearly individual rates or ranges, multiply the monthly dues by 12 and verify the exact categories against <https://www.mitrecsports.com/join/memberships/> before release.

## Pricing model

Pavilion racing uses the racing-card pricing model:

| Timing | Other student | Non-student under 30 | Non-student 30-plus |
|---|---:|---:|---:|
| Spring, before July 15 | $25 | $70 | $100 |
| Full year, July 15 or later | $40 | $125 | $175 |

Thursday team racing uses the summer-only team-racing pricing model:

| Timing | Other student | Non-student under 30 | Non-student 30-plus |
|---|---:|---:|---:|
| Any date | $25 | $70 | $100 |

MIT students do not pay for sailing cards. MIT Recreation members receive Normal without a paid Pavilion-racing or Thursday-team-racing card.

## Legacy WordPress behavior

The old WordPress site used `Normal`, `Racing`, and `Team Racing` in account forms. `Normal` remains the current user-facing label for the general sailing-card type.

`Team Racing` in legacy WordPress meant summer recreational team racing, not membership on the MIT or Northeastern college sailing team. The old public page described it as Thursday summer team racing and said the team-racing card only allowed racing in that Thursday team racing series.

Relevant legacy files:

- `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old/public_html/racing/team.php`
- `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old/includes/user.php`
- `/Users/andrewkelley/GitHub/mitsailing/sailing-wp/old/public_html/account.php`

## Copy rules

- Onboarding labels must be short and disambiguating, and the general sailing-card type must be labeled `Normal`.
- Onboarding must show a comparison with exact prices once affiliation and date of birth are known.
- If a non-MIT user is not getting MIT Recreation membership, do not leave them at a dead end. Make the Pavilion-racing and Thursday-team-racing options visible as available paid paths.
- Public pages can explain the differences with tables and short paragraphs.
- Admin views may show internal values, but member-facing UI should use the user-facing labels above.
- Do not introduce `college team racing membership` unless the data model changes to represent verified college sailing-team status separately from Thursday team racing.
