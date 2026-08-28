# Pavilion reservation slot picker UX

Date: 2026-08-28  
Status: draft (awaiting review)  
Surface: `/reserve` (`PavilionReservationWizard`)

## Problem

1. **Start → end does not advance.** Editing (and some date picks) open phase `all`, which shows start and end grids together. Choosing a start does not switch the panel to end times, unlike cal.com.
2. **Selection shows twice.** A selected space appears in **Selected options & time slots** and again as a catalog card with **Edit time** / **Remove option**, so the same actions appear twice with different labels.
3. **Step 2 layout fights the viewport.** Wide pricing table and dense actions can clip or force awkward scroll on narrow screens.
4. **Review duplicates the booking.** **Reservation details** lists each space + date/time, then **Pricing summary** repeats the same rows with cost.
5. **Submit strip is not usable.** On step 2, users see a validation error above a checkout-style line (“1 options selected · 1 time slots $1,280”), then **Submit** stacked above **Back** (`flex-col-reverse`). Price and selection count repeat what the pricing card already showed; grammar is wrong for singular counts; the error is not next to the empty fields.

## Goals

- One clear sequence: **date → start → end**, then a compact completed summary.
- One place to manage a selected space’s times and removal.
- Step 2 reads as a normal form: fill contact → review once → Back / Submit in a sensible order, with errors at the fields.
- Narrow viewports: nothing clipped; pricing readable without page-level horizontal scroll.

## Non-goals

- Duration-chip booking (cal.com meeting style) instead of clock end times.
- Changing flat-fee vs hourly pricing rules.
- Redesigning every contact field’s labels/order (only validation placement + required clarity as needed for usability).
- Reintroducing a viewport-fixed floating bar.

## Design

### 1. Time phases (sequential only)

Phases: `date` | `start` | `end` only. **Remove** phase `all` and `SlotAllSelection`.

| Moment | Behavior |
| --- | --- |
| New slot | Calendar first (`date`). After date → `start`. After start → `end` (clear any prior end). After end → collapse to completed summary. |
| Edit | Open on `start` with current start highlighted. **Same start** → go to `end`, keep previous end if still available. **Different start** → clear end → `end`. |
| Date change while editing | Always go to `start`. Preserve start/end only when still valid for the new date; otherwise clear times. |
| End step chrome | Show selected start; single **Change start** (prefer header, not duplicated in body). **Change date** always available. |
| Cancel | When editing a previously complete slot: restore the snapshot taken on Edit and return to summary. |
| Done editing | Remove; completion happens by picking an end (or Cancel). |

Prompts must name only the current step (`Select start time` / `Select end time`), not “change date, start, or end.”

**Motion / a11y:** After start selection, scroll the time panel to top, move focus to the end-step heading/prompt, and update an `aria-live` prompt so assistive tech hears the phase change.

**End options:** Keep absolute end clock times. Prefer a short duration subtitle under each end (e.g. “2 hours”) for hourly decision support. Do not require price-per-option on the grid in this slice.

### 2. Selection surfaces (no double UI)

- **Catalog cards:** Browse + select only. Selected state = border + short **Selected** label (or equivalent). **No** Edit time / Remove option on the card.
- **Selected options & time slots:** Sole place for date/time editor, slot Edit / Remove, space Remove option, and Add another date/time.
- **Select this option:** Still adds a slot and scrolls to **Selected options & time slots**.

### 3. Step 2: review, form, and actions

**Content**

- Contact card first (unchanged fields).
- **One booking block:** drop the separate **Reservation details** echo. Keep a single **Pricing summary** / **Your request** with item + date/time + cost rows and one **Estimated total**.
- Staff-approval note stays once, under that block.

**Actions (replace checkout strip)**

- On step 2, **do not** show “N options selected · N time slots $X” — that belongs on step 1 only (or not at all once pricing summary exists).
- Button order: **Back** then **Submit** (DOM and visual). No `flex-col-reverse`. On small screens: stacked with Back first (outline), Submit second (primary). On `sm+`: same row, Back left, Submit right.
- Submit may stay clickable for HTML/required validation, but on failed contact validation: show field-level / section error **at the contact card**, scroll/focus the first invalid field, and **do not** rely on a footer-only banner as the primary cue.

**Layout**

- No negative full-bleed margins on the actions row; stay inside `SiteSectionMain`.
- Narrow viewports: stacked pricing rows (item → date/time → cost) instead of `min-w-[560px]` forcing page scroll. Desktop may keep a table with overflow inside the card only.
- Pluralization: “1 option” / “1 time slot” if any selection summary remains on step 1.

## Acceptance criteria

- [ ] Choosing a start always replaces the time panel with end times only (create and edit).
- [ ] Edit never opens a combined start+end grid.
- [ ] Same start on edit keeps a still-valid end; different start clears end.
- [ ] Cancel restores the pre-edit complete slot.
- [ ] Catalog selected cards have no Edit time / Remove option controls.
- [ ] Removing or editing times is only possible from Selected options & time slots.
- [ ] Step 2 has a single booking/pricing block (no duplicate space + time list).
- [ ] Step 2 actions: Back then Submit; no selection-count/$ checkout line under the form.
- [ ] Failed submit focuses/scrolls to the first incomplete contact field; error is visible in the contact section.
- [ ] At ~375px width on step 2: no horizontal page scroll from the wizard; actions fully visible.
- [ ] Wizard unit tests updated for sequential edit + step 2 actions; no regressions on first-book path.

## Verification

- Unit/component: `PavilionReservationWizard.test.tsx` (create, edit same start, edit new start, cancel, catalog actions, step 2 Back/Submit order, contact validation focus).
- Manual: `/reserve` at ~375px and desktop — select space, book slot, edit times, incomplete submit, complete submit.
- Optional e2e only if an existing reserve flow already covers slot picking.

## Out of scope follow-ups

- Morning/afternoon/evening grouping of time grids (i18n keys already exist).
- Flat-fee items (e.g. grill) using a simpler time model than start/end.
- Showing per-end estimated cost on each end button.
