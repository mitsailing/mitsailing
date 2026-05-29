---
name: source-faithful-implementation
description: Use when the user provides exact source code, Tailwind Plus/UI blocks, screenshots, Figma specs, local vendor examples, or documentation and asks Cursor agents to use that source. Prevents substituting a different design or implementation without approval.
---

# Source-Faithful Implementation

Use the supplied source as the controlling reference.

- Preserve the source structure, hierarchy, and interaction model.
- Adapt only imports, project tokens, shared components, i18n, accessibility, TypeScript, and breakpoints needed to make the source work in this repo.
- Do not add extra sections, headings, badges, pricing groupings, explanations, or CTA concepts unless the user asks.
- Do not replace the supplied design with a different design because it seems cleaner or more conventional.
- If a deviation is needed, state it and wait for user approval before editing.

Before finishing, verify desktop and mobile output against the source and report intentional differences.

Related rule: `.cursor/rules/source-faithful-implementation.mdc`.
