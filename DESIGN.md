---
name: "MIT Sailing"
description: "A modern MIT Sailing product system for public discovery, class access, events, fleet paths, membership, and admin operations."
colors:
  mit-red: "#750014"
  mit-red-hover: "#590010"
  mit-red-highlight: "#fef2f2"
  mit-red-deep: "#2e0008"
  silver-gray: "#8b959e"
  ink: "#09090b"
  readable-ink: "#000000"
  white: "#ffffff"
  surface: "#f4f4f5"
  border: "#e4e4e7"
  muted-text: "#52525b"
  success: "#16a34a"
  warning: "#b45309"
  danger: "#ef4444"
typography:
  display:
    fontFamily: "var(--font-mit-serif), Georgia, serif"
    fontSize: "clamp(2.25rem, 5vw, 4.75rem)"
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-mit-serif), Georgia, serif"
    fontSize: "clamp(1.75rem, 3vw, 2.75rem)"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  title:
    fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 650
    lineHeight: 1.25
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "96px"
components:
  button-mit:
    backgroundColor: "{colors.mit-red}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "40px"
  button-mit-hover:
    backgroundColor: "{colors.mit-red-hover}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "40px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
    height: "40px"
  status-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "4px 10px"
---

# Design System: MIT Sailing

## 1. Overview

**Creative North Star: "The Pavilion Event Desk"**

The MIT Sailing interface should feel like a custom 2026 waterfront site built around real event actions: immediate, legible, friendly to first-time students, alive with real schedules, and grounded in MIT red. Public pages can use stronger type, real imagery, and confident section rhythm, but the product always serves the task: class access, registration, membership, ratings, fleet discovery, and staff operations.

The system should move beyond the old table-heavy website without becoming generic SaaS or a synthetic dashboard. Avoid decorative cards as the default composition. Use schedule rails, status strips, compact forms, timeline-like rows, large tap targets, and page sections that make the user's next action obvious at a glance.

**Key Characteristics:**

- MIT red carries primary action and identity.
- White, black, silver gray, and zinc neutrals keep task surfaces readable.
- Public pages can use rich waterfront photography and restrained editorial type.
- Product and admin surfaces use Inter, compact controls, semantic states, and repeated patterns.
- Event pages and registration pages must show status, timing, and action together.
- The event-page registration slice covers standard, approval-required, external, no-registration, and Learn-to-Sail beginner waitlist variants. It does not redesign the home page or invent a standalone waitlist dashboard.

## 2. Colors

The palette is MIT red plus high-contrast neutrals, with semantic green, amber, and red reserved for state.

### Primary

- **MIT Red** (`#750014`): primary CTAs, active navigation, key waitlist/action states, and brand relationship to MIT.
- **MIT Red Hover** (`#590010`): hover and pressed state for MIT-red actions.
- **MIT Red Highlight** (`#fef2f2`): subtle background tint for selected or high-priority MIT-red information.
- **Deep MIT Red** (`#2e0008`): deep brand surfaces, footer accents, or high-contrast red treatments.

### Secondary

- **Silver Gray** (`#8b959e`): MIT secondary color, metadata, dividers, and low-emphasis brand support when contrast allows.

### Neutral

- **Ink** (`#09090b`): primary text on light surfaces.
- **White** (`#ffffff`): main page and card surface.
- **Zinc Surface** (`#f4f4f5`): muted panels, inactive controls, and admin/sidebar surfaces.
- **Zinc Border** (`#e4e4e7`): quiet separation, form borders, and table lines.
- **Muted Text** (`#52525b`): secondary copy with verified contrast.

### Semantic

- **Success Green** (`#16a34a`): accepted, confirmed, complete, open where the action is available.
- **Warning Amber** (`#b45309`): pending, not open yet, selection not announced, or attention without failure.
- **Danger Red** (`#ef4444`): destructive actions and blocking validation errors.

### Named Rules

**The MIT Red Rule.** MIT red is the primary identity and action color. Do not make "Sailing" blue, and do not let blue become the brand wordmark color.

**The MIT Name Rule.** Do not spell out the full Institute name in custom type. Use MIT in plain text, or use official MIT brand assets when a logo or lock-up is required.

**The State Color Rule.** Green, amber, and red carry state only. Pair every state color with text or icon language.

**The No Purple Rule.** Avoid purple and purple-blue gradients. They conflict with the MIT red identity and read as generated UI.

## 3. Typography

**Display Font:** existing public-site display stack, with Georgia fallback.
**Body Font:** existing MIT Sailing sans stack, system-ui fallback.
**Label/Mono Font:** existing MIT Sailing sans stack unless a true code/data context earns mono.

**Character:** public pages can carry a little editorial warmth, but event actions, forms, status labels, and buttons must read as familiar product UI. Do not use custom type as a homemade MIT lock-up.

### Hierarchy

- **Display** (650, `clamp(2.25rem, 5vw, 4.75rem)`, 1.02): public class pages, fleet pages, and approved campaign headings only. Do not use this event-registration slice as a home page redesign or standalone landing page.
- **Headline** (650, `clamp(1.75rem, 3vw, 2.75rem)`, 1.12): public section headings and page titles.
- **Title** (650, `1.125rem`, 1.3): panels, class rows, form sections, and compact module headings.
- **Body** (400, `1rem`, 1.55): prose, requirements, event descriptions. Keep prose to 65-75ch.
- **Label** (650, `0.875rem`, 1.25): form labels, compact metadata, status labels, table headers.

### Named Rules

**The Product Type Rule.** Do not use display typography for form labels, admin labels, buttons, dense data, or status chips.

**The Public Type Rule.** Public pages may use display type, but long sentences cannot be hero-sized. Text must fit on mobile without clipping or awkward wrapping.

## 4. Elevation

MIT Sailing should feel modern without relying on soft "ghost cards." Depth comes from spacing, tonal layers, media, dividers, and state changes. Shadows are allowed for menus, overlays, raised media, and focused interactive surfaces, but they should be defined and purposeful.

### Shadow Vocabulary

- **Media lift** (`0 12px 30px rgba(9, 9, 11, 0.12)`): large photographic media when it needs separation from a page band.
- **Popover lift** (`0 10px 24px rgba(9, 9, 11, 0.18)`): dropdowns, popovers, and mobile nav.
- **Focus ring** (`0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent)`): use the existing ring token pattern for keyboard focus.

### Named Rules

**The One Edge Rule.** Do not pair a thin border with a wide soft shadow on cards or buttons. Choose a clear border, a tonal surface, or a purposeful shadow.

**The No Sharp-Line Default Rule.** Avoid making every section a hard bordered rectangle. Use spacing, bands, schedule rows, and type hierarchy before adding borders.

## 5. Components

### Buttons

- **Shape:** rounded medium corners, usually 10px. Icon buttons may be square or circular when the icon is the label.
- **Primary:** MIT red background, white text, compact height in product surfaces, larger tap height on public CTAs.
- **Hover / Focus:** darker MIT red on hover, visible ring on focus, no glow.
- **Secondary / Outline:** neutral surface with clear border. Use for alternative actions, not for primary registration.
- **Labels:** verb plus object, such as "Join beginner waitlist", "Request this class", "Register for this event", "Save setup", or "Text me updates".
- **Consistency:** local registration, approval requests, external registration, payment recovery, and closed/full recovery actions must use the shared button vocabulary. Do not hand-code one-off event buttons.

### Chips

- **Style:** small, rounded, high-contrast status markers. Use chips for status, not decoration.
- **State:** "Waitlist #184", "Not first-come", "No waitlist", "Opens Apr 1", "Request open", "Accepted".
- **Rule:** chips must not be the only explanation for a critical state.

### Cards / Containers

- **Corner Style:** 10-12px for product cards, up to 16px for public media and large feature panels.
- **Background:** white or zinc surface. Use MIT red highlight only for selected or high-priority state.
- **Shadow Strategy:** flat by default. Lift only when the component floats above the page or media needs depth.
- **Border:** use sparingly. Avoid nested cards and decorative border stripes.
- **Internal Padding:** 16-24px for product cards, 24-40px for public panels.

### Inputs / Fields

- **Style:** visible label, neutral border, white or transparent background, 10px radius.
- **Focus:** border/ring change using existing tokens.
- **Error / Disabled:** error text attached with `aria-describedby`; disabled states retain readable text and a clear reason when action is blocked.
- **Mobile:** use correct input types for email, tel, dates, and numeric fields. Keep single-column forms unless fields are short and independent.

### Navigation

- **Public header:** modern, compact, clear active state, MIT red identity, and mobile-first menu behavior. The MIT Sailing flag/burgee may be faithfully digitized but not redesigned.
- **Footer:** can be redesigned for clarity, contact, location, key paths, and MIT identity. Avoid a dense legacy link dump.
- **Admin navigation:** dense and predictable, with strong active states and keyboard-visible focus.

### Signature Component: Event-Page Registration Panel

The event-page registration panel is the signature product pattern for this slice. It must adapt to the event's registration mode: standard local registration, approval-required request, external registration, no-registration information, opening later, closed, full, pending, accepted, payment due, success, and error states.

The Learn-to-Sail beginner variant adds one shared beginner waitlist, the user's waitlist number when available, the current class request timing, request availability, limited/flexible spots, SMS/email notification state, and the next action without requiring a paragraph.

Mid-Week event pages need separate schedule rows for all three sessions. Sunday and Intro for Experienced Sailors need day/date/start/end rows. Intermediate and fleet paths may appear as next-step context, but must not look like beginner waitlist actions.

Schedule rows should keep the date and time together, such as "Tue Jun 9, 5:30-7:30 PM", with the session purpose as secondary text. Do not split date and time into distant columns when users need to understand the schedule at a glance.

Before April 1, the copy should make setup feel useful without pretending the user has joined the waitlist: "Sign up for Apr 1 alert" and "We will email you when the beginner waitlist is live; SMS is optional." Once the waitlist is live, the copy should make urgency apply to joining the annual waitlist, not class requests: "Join the waitlist as soon as it opens to get the best number" and "Request time does not change your order."

## 6. Do's and Don'ts

### Do:

- **Do** use MIT red (`#750014`) for primary actions and identity moments.
- **Do** use the shared button component for all event actions, including external registration.
- **Do** show waitlist number and class request state close to the class action.
- **Do** show registration windows as structured date/time facts.
- **Do** show limited/flexible spots as separate from waitlist rank.
- **Do** make "not first-come" visible for beginner class requests when requests exceed available spots.
- **Do** separate Apr 1 waitlist urgency from per-class request timing.
- **Do** design every waitlist and registration state for mobile first.
- **Do** include success, error, pending, disabled, empty, loading, and accepted states in feature work.
- **Do** test real user paths in a browser before calling a UI complete.
- **Do** use real, current MIT Sailing imagery or verified source-faithful assets for boats and the Pavilion.

### Don't:

- **Don't** redesign the MIT Sailing flag/burgee or MIT logo.
- **Don't** spell out the full Institute name in custom type or create a homemade MIT lock-up.
- **Don't** make "Sailing" blue in the wordmark.
- **Don't** show separate waitlists for Mid-Week and Sunday beginner classes.
- **Don't** imply class acceptance is first-come for beginner waitlist classes.
- **Don't** replace the existing event page with a standalone waitlist dashboard unless the user explicitly approves a broader product change.
- **Don't** create or mention generated registration links. Use the normal calendar event page.
- **Don't** say "event admin" or "staff" in public event-registration copy when "we" or "MIT Sailing" is clearer.
- **Don't** hand-code one-off public event buttons that do not match the shared button component.
- **Don't** use purple gradients, glass cards, decorative glow, bokeh/orb backgrounds, or generic SaaS card grids.
- **Don't** nest cards or use borders as decoration on every surface.
- **Don't** use long explainer text where a status board, schedule row, or button state can carry the meaning.
- **Don't** use generic boat imagery when current MIT boat design matters.
