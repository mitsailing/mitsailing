# MIT Sailing color strategy (shadcn + brand)

**Source of truth:** CSS variables in [`src/styles/mit-theme.css`](../src/styles/mit-theme.css) (`:root` and `.dark`) and `@theme inline` mappings. TypeScript hex for inline/SVG only: [`src/lib/mit-sailing/tokens.ts`](../src/lib/mit-sailing/tokens.ts). Institute reference: [MIT Brand — Color](https://brand.mit.edu/color).

**Light mode:** Form and surface tokens follow **shadcn / zinc-style neutrals** (`--background`, `--foreground`, `--border`, `--input`, `--ring`, `--muted`, etc.) so `Input`, `Textarea`, and native admin selects match stock shadcn light UI. **Default primary actions in light** still use **MIT web red** (`#750014`) via `--primary` and `Button variant="default"`.

**Dark mode:** Shell and forms follow **shadcn marketing-style dark neutrals** (charcoal surfaces, subtle borders). **`--primary` in dark** is a **high-contrast neutral** (light fill, dark text) for `Button variant="default"`, aligned with [ui.shadcn.com](https://ui.shadcn.com) dark. **Institute red** is **not** removed: it lives on `mit-red-*` tokens, `Button variant="mit"`, and marketing chrome (e.g. header “Sign up”, donate CTAs).

**Scales:** `--mit-red-50` … `--mit-red-950` expose a ramp for accents without overloading shadcn `primary`.

## Where tokens apply

| Area | Tokens / components |
|------|---------------------|
| Auth & profile forms | `Label`, `Input`; submit uses `Button variant="mit"` for consistent MIT CTAs in dark. |
| Marketing header CTAs | `bg-mit-red` / `variant="mit"` where the solid fill must stay on-brand in all themes. |
| Admin catalog | `Input`, `Textarea`, `Label`; native `<select>` uses `adminNativeSelectClassName`; tables use shadcn `Table*`. |
| Body copy | `text-foreground` / `text-muted-foreground`; avoid one-off grays unless contrast-checked. |
| Footer | `bg-mit-footer`, `text-white` utilities on footer-specific markup. |

## Accessibility

Meet **WCAG 2.1 AA**: normal text **≥ 4.5:1** vs background; verify **default, hover, and focus-visible** when reds or opacity change perceived color (see repo ADA rule). After global theme edits, run **`npm run test:e2e:a11y`** for public routes in light and dark.
