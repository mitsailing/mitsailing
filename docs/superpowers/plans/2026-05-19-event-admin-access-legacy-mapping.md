# Legacy Event Field Mapping

Scope: Task 9 parity note only. This document records old-site field mappings for later schema, action, import, and UI work; it does not expand product scope or add behavior.

Legacy sources:
- `/Users/andrewkelley/GitHub/sailing-wp/old/public_html/event_new.php`
- `/Users/andrewkelley/GitHub/sailing-wp/old/public_html/event_mod.php`
- `/Users/andrewkelley/GitHub/sailing-wp/old/includes/events.php`
- `/Users/andrewkelley/GitHub/sailing-wp/old/public_html/event_reg.php`
- `/Users/andrewkelley/GitHub/sailing-wp/old/public_html/event_regmod.php`

## Ported Fields

| Legacy field(s) | New-site meaning |
| --- | --- |
| `nor_page`, `nor` | Notice of Race visibility and rich-text content. |
| `faq_page`, `faq` | FAQ visibility and rich-text content. |
| `si_page`, `si` | Sailing Instructions visibility and rich-text content. |
| `res_page`, `results` | Results visibility and rich-text content. |
| `reg_page`, `reg_custom`, `reg_urlreg`, `reg_urlentries` | Registration availability, standard/custom registration mode, and custom external registration/entries URLs. |
| `reg_confirm`, `reg_limit` | Manual-confirm registration capacity semantics; capacity is counted against confirmed registrations when manual confirmation is enabled. |
| `phone` | Per-registration phone prompt requirement. |
| `ask_notes`, `reg_notes` | Custom registration question toggle and prompt text. |
| `reg_team`, `team_size`, `boat_size`, `reg_repeatcap`, `event_regs`, `event_boats` | Team/boat registration shape, captain-repeat behavior, registration rows, and per-boat rows. |
| `has_fee`, `event_fees`, `deposit` | Event fee options, with old `deposit` represented as a fee marked by `isDeposit`. |

## Intentionally Dropped

- `gender`
- Print entries
- Attendance
- `internalNotes`

## Notes

- Old create flow names the custom question form fields `custom_ask`/`custom_text`, then persists them as `ask_notes`/`reg_notes`; old edit flow uses `ask_notes`/`reg_notes` directly.
- Old team creation resets `team_size` and `boat_size` to `1` when `reg_team` is off.
- Old fee behavior stores normal fees in `event_fees`; `deposit` is a separate event column and should be imported as a deposit fee, not as a new event-level concept.
