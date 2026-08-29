# Pavilion reserve selection redesign

Date: 2026-08-29  
Status: draft v3.1 — ready for mockup on approval  
Source of truth: [sailing.mit.edu/info/reserve.php](https://sailing.mit.edu/info/reserve.php) + [pavilion FAQ](https://sailing.mit.edu/info/faq.php) (“What spaces…”, “What if I just want to grill?”)  
Surface: HTML mockup first, then `/reserve`

## Rubric verdict on draft v1 (why it was not 95+)

Honest score of the **prior written design** (not the broken mockup): **~82/100**.

| Criterion | Score | Gap |
| --- | --- | --- |
| User job clarity | 14/20 | Four steps split **one** legacy Facilities table across steps 2 and 3; grill-only was a Continue exception after an empty venues step |
| Decision support | 17/20 | Prices/kinds correct on paper; no always-visible request + total during building |
| Task flow efficiency | 10/15 | Extra step boundary forces venue ↔ add-on backtracking; start-time wall only hand-waved |
| State visibility | 12/15 | No spec for incomplete editor vs committed line; Next placement on long pages undefined |
| Hierarchy | 7/10 | Programs/add-ons/venues not given a single scan order matching legacy |
| Mobile | 7/10 | Rejected sticky footer but offered no replacement so Continue can leave the viewport |
| A11y / trust | 8/10 | Missing unique control names, live-region rules, Stew/contact promise on final step |

v2 closes every gap below. Target: **96/100**.

---

## Problem (product + UI)

1. Current `/reserve` and mockups treat **flat facilities as venue cards** → calendar/end-time UI on grill and party boat → empty “Select an end time.”
2. Two-step chrome (“Spaces and dates” / “Contact”) is a **stuffed single page** with a progress bar: persona + mis-grouped catalog (and other contact fields) before the user has built a request — even though **email first** is required for draft recovery / staff follow-up.
3. One request must support **multiple real hourly bookings** (same space, two dates) — product **B**.
4. Legacy + FAQ: **grill is an add-on** and a **first-class solo path**, not a peer of roof deck.

## Legacy truth (compressed)

**Single form, six section jobs:** Contact (incl. group type) → two date/time choices → Academic (conditional) → Event → Size/notes/tent/alcohol → **one Facilities table**.

Facilities are **not** three shop categories. They are line items with two request widgets:

- **Hours** → Casual dock, East roof only  
- **Checkbox** → Grill, party boat, wedding, after-close×2, lab, group lesson  

Wedding + after-close copy say **“in addition to hourly”** and are **omitted for Academic**.  
FAQ: grill-only is valid; groups of 12+ should reserve.

Hourly rates / flat fees by persona stay as on `reserve.php` (student example: dock/roof $200/hr, grill $30, boat $130, wedding $650, after-10 $325, midnight $585, lesson $3500).

---

## Locked interaction rules (v3.1 — mockup-ready)

Resolves final pre-mockup review blockers ([Design readiness](017b8d99-1475-4768-87f1-7ddfa361ad40)).

### Mobile Continue (always reachable)

- Desktop: sticky **right rail** `top` under site header while step 2 scrolls.
- Mobile: **sticky top** “Your request” bar (under step chrome), not in-flow only and **not** a bottom sticky checkout. Collapsed shows line count + total + Continue; expand reveals lines. Continue remains visible while scrolling the catalog.

### After-hours fee bands (non-Academic only)

Timeline matches production: starts/ends on a **30-minute** grid from **7:00 AM** through **2:00 AM next day** (logical 26:00). Regular close for the selected date = **sunset** (mockup may use a fixture sunset per date).

For an hourly line ending at `end`:

| End relative to close | After-hours line | Fee |
| --- | --- | --- |
| `end` ≤ sunset | none | — |
| sunset < `end` ≤ 10:00 PM | “After close through 10:00 PM” | persona flat (student $325) |
| 10:00 PM < `end` ≤ 2:00 AM | “After close through 2:00 AM” | persona flat (student $585); legacy “Midnight” fee, one band for all ends after 10pm |

**Replace, don’t stack:** one after-hours fee per hourly line (the band that covers the end). Never both 10pm and Midnight on the same line. Academic: no after-hours chips or lines.

Ends with no valid options: do not open an empty end grid (disable that start).

### Multi-venue + edit

- One request **may** include Casual dock **and** East roof (and multiple dates each).
- Step 2 committed lines: **Remove** and **Edit** (Edit reopens that venue’s editor with the line’s date/start/end; Save replaces the line; Cancel keeps prior).

### Clock / notice rules

- Morning = 7:00–11:30, Afternoon = 12:00–4:30, Evening = 5:00–1:30 AM (last start that still has an end). Evening accordion **open by default** for venues.
- 48-hour notice: dates earlier than now+48h unavailable; if current month has ≤1 bookable day, default calendar to next month.

### Grill quantity + fee source

- Mockup: grill is **on/off toggle** at the form flat fee (**$30** from `reserve.php`). FAQ $20 is outdated path/copy only — **form fees win**.
- Quantity >1 is out of mockup (staff can adjust); copy may say “per grill.”

### Continue empty copy

“Add a venue booking, grill, party boat dock, or program.”

### Live region (step 2 venue editor)

Announce on change: “Choose a date” → “Choose a start time” → “Choose an end time” → “Added [venue] [date] [start]–[end] to your request.”

### Step 3 field inventory (legacy-aligned)

**Event:** Event name (required); Group name (optional); Group size (required); Description / special requests; Tent yes/no; Alcohol yes/no + legacy policy line.

**Academic** (if Academic): Project title; Faculty advisor; Faculty advisor email; Cost center — all required when Academic.

**Contact:** Name (first/last or single full name — mockup: First + Last); Phone (required); MIT ID (optional); Email read-only from step 1.

**Also show:** MIT Account Number / Personal Account as optional text (legacy Event Information) — stub ok if labeled optional.

Submit stub: show confirmation panel (“Stew will contact you…”) without real POST.

### Fee matrix in mockup

Fixture all four personas from `reserve.php` (not student-only). Form fees win over FAQ.

---

## Design v3 — three steps, email first, one facilities builder

Progress: **1 Email and group type → 2 Your request → 3 Event, contact, and send**

### Step 1 — Email and group type

**One job:** identify the requester and unlock the price list.

Field order (email **first**, always):

1. **Email** — required; used for draft recovery and staff follow-up (aligns with legacy contact-leading and current draft behavior). Short helper: “We’ll use this to save your request and reply.”
2. **Group type** — Academic / Student / Community / Non-MIT. Prices unlock after selection (one-line sample: “Student rates — dock from $200/hr”).

- No catalog on this step.
- Continue disabled until email is valid **and** group type is chosen.
- Primary CTA: **Continue to your request**

### Step 2 — Your request (the 95+ step)

**One job:** assemble the facilities request the way legacy’s table does — **venues and add-ons on the same step**, correct controls per kind.

Layout (desktop): **main column** (builder) + **sticky right rail “Your request”** (lines + estimated total + Continue).  
Layout (mobile): **sticky top** “Your request” bar under step chrome (collapsed: count + total + Continue; expand for lines) — see Locked interaction rules. Not a bottom sticky bar.

#### Scan order (matches FAQ-led add-ons; venues first for the common party path)

1. **Venue spaces** (hourly only)  
   - Casual party space — Shore School / wooden dock (50)  
   - Entire east roof deck (100)  
2. **Add-ons** (flat checkboxes; no date/time)  
   - Barbecue grill — lead with FAQ: “Just need the grill? Add it here. Groups of 12+ should reserve.”  
   - Party boat dock, 15 minutes each way  
   - Wedding / rehearsal / reception (in addition to hourly) — only if ≥1 venue line and not Academic  
3. **Programs**  
   - Lab access / dock experiment ($0, arranged)  
   - Group sailing lesson (summer; 20–40)

After-hours are **not** add-on rows in the catalog. They attach when an hourly line’s **end** is after regular close (sunset for that date). Academic: no after-hours UI. Derived after-hours appear as sub-lines under that booking in “Your request.”

#### Hourly venue interaction (line-item cart)

1. Choose a venue card → editor opens **on that card** (photo stays).  
2. **Date** — labeled month + prev/next; if current month has ≤1 bookable day under 48h notice, open the **next** month by default.  
3. After date → calendar **collapses** to `Sat Aug 30 · Change date`.  
4. **Start** — chips in **Morning / Afternoon / Evening** groups (Evening open by default for venues). No single 40-chip wall.  
5. **End** — only after start; each end shows duration; after-close ends show +$fee on the chip.  
6. **Never** enter end phase with zero options — disable that start or explain (notice window / past last end).  
7. **Add to request** commits a line; editor closes; **same venue stays available** for another date.  
8. Incomplete editor (opened but not added): **Cancel** discards; leaving the card without Add does not create a ghost line.  
9. Committed lines support **Edit** and **Remove** (see Locked interaction rules).

Committed line example:

`East roof deck · Sat Aug 30 · 5:00–10:00 PM`  
`Space (5 hr) $1,000 · After close until 10:00pm $325`  
(If end were 11:00 PM → Midnight band only, not both fees.)

#### Add-on / program interaction

- Toggle on/off. Instant line in “Your request.” **Zero calendars.**  
- Grill alone → Continue enabled (FAQ path).  
- Wedding hidden until a venue line exists (non-Academic).

#### Continue rules (step 2 → 3)

Enabled when **any** of: ≥1 venue line, grill, party boat, lab, or lesson.  
Disabled empty state: “Add a venue booking, grill, party boat dock, or program.”

CTA label: **Continue to event and contact** (outcome, not “Next”).

### Step 3 — Event, contact, and send

**One job:** finish the request staff need, review once, send.

Order:

1. **Your request** (read-only; **Edit request** → step 2) + **Estimated total**  
2. **Event** — fields per Locked inventory (name, group name optional, size, description, tent, alcohol + policy)  
3. **Academic** block if Academic (four legacy fields, required)  
4. **Contact** — name, phone, MIT ID optional; email read-only (**Edit email** → step 1); optional MIT account  
5. Staff note: Stew reviews availability and follows up; public contact link; no public reference code  
6. **Back** then **Submit request** (stub confirmation in mockup)

---

## What this is not

- Not legacy’s single 2016 wall (we step the jobs).  
- Not today’s 2-step stuffed “Spaces and dates.”  
- Not a 4-step that isolates add-ons after venues (v1 mistake).  
- Not sticky bottom checkout (rejected). Continue sits in the **sticky request summary** (rail / sticky top).

---

## Target rubric (design intent)

| Criterion | Target | How v3.1 earns it |
| --- | --- | --- |
| Job clarity | 19/20 | Email first; step titles = jobs; grill-only without empty venue step |
| Decision support | 19/20 | Full persona fees; after-hours bands on end chips; running total |
| Flow efficiency | 14/15 | One facilities step; multi-date + multi-venue; grouped starts |
| State / recovery | 14/15 | Commit vs editor; Edit/Remove lines; Edit request / email |
| Hierarchy | 9/10 | Venues → add-ons → programs |
| Mobile | 9/10 | Sticky top request bar owns Continue |
| A11y / trust | 10/10 | Named selects; phase live region; Stew/contact on submit |

**Projected: 96/100** after mockup verification walkthroughs.

---

## Acceptance criteria

- [ ] Three-step progress; step 1 asks **email first**, then group type; remaining contact on step 3 (email not re-entered).  
- [ ] Step 2 lists exactly two hourly venues; grill + party boat only under Add-ons.  
- [ ] Grill-only can Continue; wedding requires a venue line; Academic omits wedding + after-hours.  
- [ ] Same venue can produce two dated lines; dock + roof can coexist.  
- [ ] After-hours: one band per line (10pm vs Midnight replace); never empty end grid.  
- [ ] Calendar collapses after date; starts grouped; sticky summary Continue always reachable (no bottom bar).  
- [ ] Flat toggles never show date/start/end.  
- [ ] Step 3 includes legacy event/academic/contact fields (submit stub ok).  
- [ ] Independent walkthrough scores ≥95 (task-fit, heuristics, adversarial).

## Locked decisions

- Multi-date = **B** (multiple real bookings).  
- After-hours = end-time fee bands (v3.1 mapping), not catalog cards.  
- Form fees from `reserve.php` win over FAQ dollar amounts.  
- Mockup before production code.

## Expert decisions (2026-08-29 polish lock)

Director calls for remaining critique / copy forks. Ship the mockup against these; escalate only if Stew contradicts.

| Topic | Decision | Why |
| --- | --- | --- |
| Payment reassurance | **“No payment due today.”** under the primary CTA (rail Continue / Submit), not above the total | Short, familiar, sits where checkout anxiety peaks; total stays clean as an estimate |
| Fee literacy on Step 2 | **One-line summary** + collapsed “How fees work”; full table only on expand | Primary job is build a request; policy before Select was the #1 cognitive failure |
| Start times | **Time-of-day first** (Morning / Afternoon / Evening), then chips for that band only | Cuts ~40 simultaneous choices without inventing a different clock model |
| Sunset for the date | **Show clock time with the selected date**, before start/end chips; fixture ~7:00 PM in mockup | Regular close is a money decision; burying it in the top essay fails recognition |
| After-close labels | Always **“through 10:00 PM”** and **“through 2:00 AM”** (never “Midnight” in UI) | One phrase on chips, table, and summary; legacy fee name can stay in staff notes |
| Wedding | Stay an **add-on** requiring ≥1 venue; omit for Academic; tip after first venue | Matches `reserve.php`; a wedding “mode” is a future product change, not this slice |
| Programs (lab / lesson) | Keep on Step 2 **below** venues and add-ons; do not gate or hide | Legacy table includes them; organizers who need them should not hunt another form |
| Grill “12+” FAQ line | **Do not** treat as a hard product rule in UI; grill is flat toggle; fee = form **$30** | FAQ $20 / 12+ is advisory and outdated vs the live form |
| Cancellation | **Link space + honest placeholder** until Stew publishes terms: “Terms come with your confirmation” | Inventing refund windows is a product lie; FAQ link covers other questions |
| Help links | Rail / review: **Pavilion FAQ** + **Pavilion photos** (gallery). Per-space video/photo URLs when assets exist | No space-specific media URLs on legacy reserve form today |
| Space vs date first | Keep **space → date → time** | Capacity/privacy choice (dock vs roof) precedes calendar; matches how people describe the event |
| Academic after sunset | Allow end after sunset (hourly only) + **copy that late hours may still need staff OK** | Form has no Academic after-close fee; Stew can still refuse late use |
| Mobile sticky | Compact: count · total · Details · **Continue**; payment + cancel/FAQ only in Details / desktop rail | Sticky chrome must not eat the first viewport |
| Step 3 name / CTA | **Review and submit** / **Continue to review and submit** | “Event, contact, and send” was opaque |

**Product blocker (do not fake in production):** real cancellation / refund policy text from Stew.

## Self-review (v3.1)

- Corrects v1 add-ons split; keeps unified facilities step; email first.  
- Closes readiness blockers: sticky Continue, two-tier after-hours, step 3 field list, multi-venue, Edit line, grill fee source.  
- Polish lock above aligns mockup with critique P1s without reopening v3.1 product rules.  
- **Ready to generate HTML mockup** after your OK.
