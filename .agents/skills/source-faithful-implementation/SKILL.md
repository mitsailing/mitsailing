---
name: source-faithful-implementation
description: Use when the user provides exact source code, Tailwind Plus/UI blocks, screenshots, Figma specs, local vendor examples, or documentation and asks Codex to use that source. Prevents substituting a different design or implementation without approval.
---

# Source-Faithful Implementation

Use the user's supplied source as the controlling reference. Do not reinterpret it into a different design, page structure, or workflow.

## Non-Negotiables

- Explicit user source wins over agent preference.
- Preserve the source's structure, hierarchy, and interaction model.
- Make only required repo adaptations: imports, shared components, tokens, i18n, accessibility, responsive fixes, and TypeScript.
- Do not add headings, sections, cards, badges, explanations, or CTA concepts that are not in the source unless the user asks.
- Do not replace the supplied pattern with another pattern because it seems better.
- If a deviation seems necessary, stop and ask for approval before editing.

## Workflow

1. Name the controlling source: pasted snippet, screenshot, local file path, URL, or spec.
2. Identify the source elements that must be preserved.
3. List the repo-only adaptations needed.
4. Patch only those adaptations.
5. Verify rendered desktop and mobile output against the source.
6. Report intentional differences explicitly.

## Common Allowed Adaptations

- Replace unavailable icon packages with the repo's installed icon library.
- Swap raw vendor colors for project tokens.
- Move visible text into i18n keys.
- Use project `Button`, `Link`, and modal primitives where semantics remain the same.
- Adjust breakpoints to avoid overflow while keeping the same pattern.

## Stop Conditions

Stop and ask when:

- The supplied source conflicts with product requirements.
- The source uses a package or primitive the repo does not have and substitution would alter behavior.
- A responsive fix would require changing the layout pattern.
- The user reacts that the implementation is drifting from the source.
