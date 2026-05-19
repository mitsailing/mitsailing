# Task Queue

The conductor updates this file after each worker. Workers should not reorder the
queue.

- [x] 00 - Rules and context cleanup
  - Completed in this planning/control-plane pass.
- [ ] 01 - Dependency and ZModel foundation
  - Packet: `tasks/01-zmodel-foundation.md`
  - Reasoning: high
- [ ] 02 - AppRole permission context
  - Packet: `tasks/02-app-role-context.md`
  - Reasoning: high
- [ ] 03 - ZenStack client and Better Auth adapter
  - Packet: `tasks/03-zenstack-better-auth.md`
  - Reasoning: xhigh
- [ ] 04 - Admin access, users, and role assignment
  - Packet: `tasks/04-admin-access-users.md`
  - Reasoning: high
- [ ] 05 - Event authorization policies
  - Packet: `tasks/05-event-policies.md`
  - Reasoning: xhigh
- [ ] 06 - Restricted generated CRUD and EventCategory admin UX
  - Packet: `tasks/06-generated-crud-event-category.md`
  - Reasoning: high
- [ ] 07 - Event workflow data access
  - Packet: `tasks/07-event-workflow.md`
  - Reasoning: high
- [ ] 08 - Remove stale auth stack and squash prelaunch migrations
  - Packet: `tasks/08-removal-migrations.md`
  - Reasoning: high
- [ ] 09 - Full verification and review-bot preflight
  - Packet: `tasks/09-verification.md`
  - Reasoning: xhigh

