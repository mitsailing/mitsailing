# MIT Sailing Design Context

## System

Use the existing Next.js, Tailwind v4, shadcn-style primitives, and MIT Sailing token vocabulary. Prefer shared UI components from `src/components/ui` and MIT Sailing helpers from `src/lib/mit-sailing/tokens.ts`.

## Color

- Primary accent: MIT red via `mit-red`, `mit-red-hover`, `mit-red-highlight`, and `primary-ink`.
- Text: `mit-text`, `foreground`, and `muted-foreground`.
- Borders and surfaces: `border`, `mit-line`, `card`, `background`, `muted`, and `mit-surface`.
- Semantic state: use existing destructive, success, disabled, selected, hover, and focus token patterns.
- Do not introduce raw colors in components. Add tokens only when an existing token cannot express a real system need.

## Typography

- Product UI uses system/shadcn text scale by default.
- Public editorial pages may use `font-mit-serif` for page titles when existing neighboring pages do.
- Keep form labels compact and help text at `text-xs` or `text-sm` with readable line height.
- Do not use fluid type inside product controls or forms.

## Layout

- Use `SiteSectionShell` and `SiteSectionMain` for public section chrome.
- Use constrained widths for detail flows, usually `max-w-2xl` to `max-w-3xl` for forms.
- Use two-column desktop grids for short independent inputs. Keep decision cards and long copy in a single column unless the cards remain easy to compare and tap.
- Mobile is a single-column task flow.
- Avoid nested cards. Use sections, dividers, and spacing before adding more containers.

## Components

- Buttons: use `Button`, with `variant="mit"` for primary MIT red actions.
- Inputs: use `Input`, `Label`, and native selects styled with `adminNativeSelectClassName`.
- Links: use MIT red text links with underline and visible focus rings.
- Radio and checkbox groups need visible labels, selected states, disabled states, focus states, and server error states.
- Cards are for real choices, repeated items, or framed tools. Do not use cards as decoration.

## Forms

- Labels are always visible. Place format examples in placeholders only when labels already name the field.
- Help text must answer why the field matters or what happens next.
- Required fields should use native `required` where browser and assistive tech behavior is expected.
- Validation errors should be short and attached with `aria-describedby`.
- Keep copy out of option cards unless it helps the choice. Put shared context above or below the group.

## Onboarding

- The onboarding goal is eligibility completion, not education.
- Reveal steps progressively: affiliation, identity, contact, membership/card request, agreement.
- Membership and payment guidance should be concise and action-oriented.
- External signup links should be explicit. Do not assume third-party forms can be prefilled without verification.

## Motion

Use restrained transitions for hover, selected, focus, and disabled states. Avoid page-load choreography and decorative motion in task flows.
