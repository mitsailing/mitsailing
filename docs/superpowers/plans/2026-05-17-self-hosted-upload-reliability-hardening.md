# Self-Hosted Upload Reliability Hardening Implementation Plan

> **Superseded.** This historical implementation plan was replaced before the
> MIT Sailing app went live. It is intentionally reduced to this notice so
> agents do not restore deleted deploy files, alternate media hostnames, or
> host-level storage assumptions from the retired design.

Current source of truth:

- [`../../deploy.md`](../../deploy.md)
- [`../../devops_plan.md`](../../devops_plan.md)

Current production decisions:

- One Docker Compose stack runs on `ak@sailing-dock.mit.edu`.
- The production stack uses the `tusd` service in `compose.prod.yaml`.
- App releases do not restart upload or media-serving services.
- Upload and media maintenance are explicit night-deploy operations.
- WordPress remains separate and untouched at `wp.mitsailing.com`.
