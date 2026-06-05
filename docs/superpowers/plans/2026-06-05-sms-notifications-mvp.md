# SMS notifications MVP plan

> Status: launch plan for a separate SMS PR on top of PR 170.
> Target: initial production SMS capability for the June 6, 2026 go-live.
> Base branch: `feature/impeccable-event-registration-redesign` / PR 170, not `main`.

## Sources checked

- GitHub issue: https://github.com/mitsailing/mitsailing/issues/175
- PR 170: https://github.com/mitsailing/mitsailing/pull/170
- PR 170 implementation points:
  - `src/libs/mit-sailing/eventRegistrationActions.ts`
  - `src/libs/admin/events/eventAdminActions.ts`
  - `src/libs/mit-sailing/learnToSailEvents.ts`
  - `prisma/schema.prisma`
  - `src/worker/eventPaymentEmailJob.ts`
  - `src/worker/eventPaymentNotificationStore.ts`
- Twilio docs:
  - Messaging Services: https://www.twilio.com/docs/messaging/services
  - Message Scheduling: https://www.twilio.com/docs/messaging/features/message-scheduling
  - A2P 10DLC: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc
  - Compliance Toolkit: https://www.twilio.com/docs/messaging/features/compliance-toolkit
  - Appointment reminders tutorial: https://www.twilio.com/docs/messaging/tutorials/appointment-reminders/node
  - SMS notifications Code Exchange: https://www.twilio.com/code-exchange/sms-notifications
- Production-app references:
  - Cal.com help says SMS/WhatsApp notifications exist and international SMS costs are based on Twilio rates: https://calcomhelp.mintlify.help/help/billing-and-usage/messaging-credits
  - Cal.com issue showing GUI booking SMS but API-created booking SMS gap: https://github.com/calcom/cal.com/issues/16253
  - Chatwoot is a maintained open-source production app with Twilio SMS, Messaging Service support, delivery status callbacks, and tests: https://github.com/chatwoot/chatwoot
  - Twilio appointment reminder sample app: https://github.com/twilio-labs/sample-appointment-reminders-node

## Reference takeaways

- Cal.com is useful product evidence, not the implementation model. It exposes SMS reminders/workflows and ties some SMS pricing to Twilio rates, but public repo search did not surface Twilio implementation files. The Cal.com API-vs-GUI SMS issue is the important warning: notification triggers must live in shared server lifecycle code, not only in one UI submission path.
- Chatwoot is the better production-code reference. It keeps a Twilio channel model, supports either `messaging_service_sid` or `phone_number` with Messaging Service preferred, sends through a service wrapper, attaches status callbacks, and has delivery-status/inbound-service tests.
- Twilio's appointment reminder sample is still useful as a minimal reminder workflow, but it is not the exact production shape for this app. Its package versions are old, and Twilio's current tutorial points future reminders toward Message Scheduling. Use it for concepts only; use current Twilio docs and this repo's BullMQ/idempotency patterns for implementation.

## Issue 175 vs PR 170

Issue 175 originally blocks SMS from PR 170 until product, compliance, consent, provider docs, and tests are explicit. The current product decision changes the launch target: SMS can ship, but only as a focused follow-up PR based on PR 170.

PR 170 already provides the right event lifecycle hooks:

- Public registration creates `pending` when `event.requiresApproval` is true, and `approved` when false.
- Learn-to-Sail managed beginner classes are identified by `learnToSailManagedClassKind` and `eventUsesLearnToSailWaitlist`.
- Admin registration approval happens in `updateAdminEventRegistrationStatusAction`.
- User cancellation happens in `cancelPublicEventRegistrationAction`.
- Registration phone is already captured, normalized to US E.164, saved on `EventRegistration.phone`, and synced to `User.phone`.
- BullMQ default queue, worker dispatch, idempotency marker patterns, and email provider logging already exist.

PR 170 does not yet provide:

- Explicit SMS consent.
- User opt-out state.
- Twilio configuration in `Env.ts`.
- SMS send gateway, delivery callbacks, inbound STOP handling, or send logs.
- A durable whole-event cancellation state. Event deletion currently cascades registrations and is not a safe notification trigger.

## MVP decision

Ship initial SMS as transactional registration lifecycle messages only:

1. Approved registration SMS for approval-required events when an admin changes a registration from non-approved to approved.
2. Approved class-request SMS for the two Learn-to-Sail managed beginner classes, using class-specific copy but the same trigger as approved registration.
3. Registration cancellation SMS when an admin changes a registration to `cancelled`.
4. Whole-event cancellation SMS only if we add a small non-destructive event cancellation state; do not send cancellation SMS from delete or unpublish.

Do not send SMS for auto-approved registrations. Public `createPublicEventRegistrationAction` must not enqueue approval SMS when `requiresApproval=false`.

## Tomorrow go-live scope

### In

- One Twilio Messaging Service for production sends.
- Explicit opt-in before any SMS.
- One user-level SMS consent state tied to the user's current phone number.
- One SMS message table for idempotency, audit, provider IDs, status, and failures.
- Approval/cancellation SMS sent by background jobs after database commit.
- Status callback route to update message delivery state.
- Inbound route for STOP/START-style opt-out updates.
- Event links are normal public event URLs, never generated account-specific links.
- Email remains the primary detailed notification path.

### Out

- Bulk "registration opens tonight" texts.
- Waitlist-wide broadcasts.
- Scheduled reminders.
- "Still pending" or "not accepted yet" SMS.
- Per-event SMS preferences.
- Admin template editor for SMS copy.
- WhatsApp, MMS, RCS, voice, and two-way conversations.
- Custom short links or per-user magic links.

## Consent model

Use user-level consent for MVP. This is enough because PR 170 has one profile phone and registration phone sync.

Add fields to `User`:

- `smsNotificationsOptedInAt DateTime?`
- `smsNotificationsOptedOutAt DateTime?`
- `smsNotificationsPhone String?`
- `smsNotificationsConsentSource String?`
- `smsNotificationsConsentIpAddress String?`
- `smsNotificationsConsentUserAgent String?`

Send eligibility:

- `User.phone` is present.
- `User.phone === User.smsNotificationsPhone`.
- `smsNotificationsOptedInAt` is present.
- `smsNotificationsOptedOutAt` is null or earlier than the opt-in timestamp.
- Destination phone passes current `normalizeUsPhone`.

Consent UX:

- Profile details gets one checkbox near phone: "Text me about class and event registration updates from MIT Sailing. Message and data rates may apply. Reply STOP to opt out."
- Event registration form shows the same checkbox when asking for phone. It updates user consent along with the registration phone.
- Registration must still be allowed when the checkbox is unchecked. The only effect is no SMS.

Phone changes:

- If a user changes phone without checking SMS consent, keep the new phone but clear SMS send eligibility by leaving `smsNotificationsPhone` unmatched.
- If a user changes phone and checks consent, set `smsNotificationsPhone` to the new normalized phone and clear `smsNotificationsOptedOutAt`.

## SMS persistence

Add enums:

- `SmsMessageKind`: `event_registration_approved`, `learn_to_sail_class_approved`, `event_registration_cancelled`, `event_cancelled`
- `SmsMessageStatus`: `queued`, `accepted`, `sent`, `delivered`, `undelivered`, `failed`, `skipped`

Add `SmsMessage`:

- `id`
- `kind`
- `status`
- `idempotencyKey` unique
- `userId`
- `eventId`
- `registrationId`
- `toPhone`
- `body`
- `provider`
- `providerMessageId`
- `lastError`
- `sentAt`
- `deliveredAt`
- `failedAt`
- `createdAt`
- `updatedAt`

Idempotency keys:

- Approval: `event-registration-approved:{registrationId}`
- Learn-to-Sail approval: `learn-to-sail-class-approved:{registrationId}`
- Registration cancellation: `event-registration-cancelled:{registrationId}:{cancelledAtIsoOrUpdatedAt}`
- Whole-event cancellation: `event-cancelled:{eventId}:{cancelledAtIso}`

Use the existing event-payment notification marker pattern as the local model: create or claim a row before sending, store the provider ID only after Twilio accepts the message, and skip duplicate completed sends.

## Twilio setup

Use `twilio` npm package and `client.messages.create`.

Add server env in `Env.ts`:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_STATUS_CALLBACK_BASE_URL` or derive from `NEXT_PUBLIC_APP_URL`
- `SMS_TRANSPORT` as `twilio` or `log`, default `log`

Production preflight:

- Use a Messaging Service SID, not a raw `from` number.
- Complete toll-free verification or A2P 10DLC registration before real US traffic.
- Enable Twilio opt-out handling and inbound webhook on the Messaging Service.
- Enable delivery status callback on the Messaging Service.
- Enable Compliance Toolkit and SMS Pumping Protection if available for the account.
- Keep messages short, transactional, and branded as MIT Sailing.

The Twilio appointment tutorial now recommends Message Scheduling for future reminders. For this MVP, approvals and cancellations are immediate action-triggered notifications, so BullMQ jobs are simpler. Use Twilio scheduling later for registration-open reminders, because scheduled messages require `MessagingServiceSid`, `ScheduleType`, and `SendAt`, and Twilio requires scheduling 15 minutes to 35 days ahead.

## Code shape

Add small modules:

- `src/libs/sms/sendSms.ts`
  - selects `SMS_TRANSPORT`
  - validates Twilio config
  - sends through `messagingServiceSid`
  - returns provider message ID and accepted status
- `src/libs/sms/smsConsent.ts`
  - evaluates user opt-in and phone match
  - updates opt-in/opt-out state
- `src/libs/sms/eventRegistrationSms.ts`
  - builds eligible recipient rows
  - builds message copy and idempotency keys
  - creates/claims `SmsMessage`
- `src/worker/eventRegistrationSmsJob.ts`
  - processes one SMS message ID
  - calls `sendSms`
  - records provider ID/status/error
- `src/app/api/twilio/sms/status/route.ts`
  - validates Twilio signature
  - maps `MessageSid`, `MessageStatus`, and error fields back to `SmsMessage`
- `src/app/api/twilio/sms/inbound/route.ts`
  - validates Twilio signature
  - records STOP/UNSUBSCRIBE/CANCEL/END/QUIT as opt-out on matching `smsNotificationsPhone`
  - records START/YES/UNSTOP as re-opt-in only if product approves that behavior; otherwise leave re-opt-in to profile UI

Wire worker dispatch by adding a new job name to `src/worker/workerDispatch.ts`.

## Trigger points

### Approval

In `updateAdminEventRegistrationStatusAction`, after the transaction commits and before redirect:

- If parsed status is `approved` and previous status was not `approved`, enqueue SMS.
- If event uses Learn-to-Sail waitlist, use `learn_to_sail_class_approved`; otherwise use `event_registration_approved`.
- Never enqueue from public registration creation.

### Individual registration cancellation

In `updateAdminEventRegistrationStatusAction`:

- If parsed status is `cancelled` and previous status was not `cancelled`, enqueue `event_registration_cancelled`.
- Do not send when the user cancels their own request in `cancelPublicEventRegistrationAction`; they already initiated it.

### Whole-event cancellation

If this is required for tomorrow, add a narrow admin action instead of using delete/unpublish:

- Add `event.cancelledAt`, `event.cancelledByUserId`, and `eventCancellationNote`.
- Admin action: "Cancel event and notify registrants".
- Keep event visible with a cancelled state on public/admin pages.
- Enqueue `event_cancelled` for opted-in approved and pending registrants.
- Keep delete as destructive cleanup only, not a notification workflow.

This is the only product-decision blocker: if "event cancellations" means whole-event cancellation, we need the non-destructive cancellation state. If it means cancelling individual registrations, the existing status flow is enough.

## Message copy

Keep every SMS under one segment when possible and always link to the normal event page.

Generic approval:

`MIT Sailing: Your registration for {eventName} was approved. Details: {eventUrl}. Reply STOP to opt out.`

Learn-to-Sail approval:

`MIT Sailing: Your request for {eventName} was approved. Details: {eventUrl}. Reply STOP to opt out.`

Individual registration cancellation:

`MIT Sailing: Your registration for {eventName} was cancelled. Details: {eventUrl}. Reply STOP to opt out.`

Whole-event cancellation:

`MIT Sailing: {eventName} was cancelled. Details: {eventUrl}. Reply STOP to opt out.`

Do not include private user facts, waitlist number, payment amount, or generated account links in SMS. Put detailed instructions in email and on the normal event page.

## Class notification placement in MVP

For the two waitlist-managed intro classes, initial SMS belongs on the approval transition, not on the waitlist itself.

Reason:

- PR 170 models those classes as approval-required event registrations tied to one annual waitlist.
- Admin approval is the moment the user needs the fast alert.
- Bulk waitlist registration-open SMS needs scheduling, quiet-hours handling, opt-out batching, and stronger operations controls.

Later class notification phases:

1. Registration-open reminder to opted-in active waitlist members.
2. Class request received confirmation.
3. Not-yet-accepted outcome after admin selection.
4. Day-before class reminder.

## Verification

Focused tests:

- Consent helper sends only with opt-in, matching phone, and no later opt-out.
- Profile update records consent and invalidates consent on phone mismatch.
- Event registration form can opt in and still allows no-consent registration.
- Admin approval enqueues SMS for approval-required events.
- Admin approval does not enqueue SMS for auto-approved events.
- Learn-to-Sail managed classes use class-specific approved copy.
- Admin cancellation enqueues cancellation SMS.
- Duplicate approval/cancellation attempts do not create duplicate sends.
- Twilio send gateway uses `messagingServiceSid` and handles Twilio errors.
- Status callback updates `SmsMessage`.
- Inbound STOP updates user opt-out.

Required local gates:

- `npm run test`
- `npm run lint`
- `npm run check:types`
- `npm run check:i18n`
- `npm run check:deps`
- `npm run build-local`

Manual staging proof:

- Set `SMS_TRANSPORT=log`; approve a pending registration; verify one `SmsMessage` row.
- Set Twilio test credentials or a verified staging sender; send to one staff phone.
- Validate Twilio status callback reaches the app and updates the row.
- Reply STOP from the staff phone; verify the user is opted out and future sends are skipped.
- Approve an auto-approved event path; verify no SMS row.
- Approve one Learn-to-Sail managed class request; verify class copy.
- Cancel one registration; verify cancellation copy.

Production proof:

- Confirm deployed SHA includes the SMS PR and PR 170.
- Confirm production env has Twilio variables and `SMS_TRANSPORT=twilio`.
- Confirm Twilio Messaging Service sender registration/verification state.
- Approve one staff-owned pending registration in production and verify:
  - app row created once
  - Twilio message SID stored
  - delivery status updated or visible in Twilio logs
  - user receives text
  - STOP prevents future sends

## Implementation sequence

1. Branch from PR 170 head, not `main`.
2. Add Twilio package.
3. Add env validation and example env docs.
4. Add consent fields and SMS message table migration.
5. Regenerate Prisma/ZenStack outputs.
6. Add consent helpers and tests.
7. Add Twilio send gateway with `log` transport and tests.
8. Add SMS worker job and dispatch wiring.
9. Add admin approval/cancellation enqueue hooks.
10. Add profile and event-registration opt-in UI/copy.
11. Add Twilio status and inbound webhook routes.
12. Add whole-event cancellation state only if product confirms that is in tomorrow scope.
13. Run focused tests, full local gates, and staging proof.

## Launch risk

The riskiest part is not the Twilio API call. It is consent, duplicate sends, and event cancellation semantics.

To keep tomorrow safe:

- Ship approval/cancellation SMS only.
- Do not send bulk waitlist messages.
- Do not send auto-approval texts.
- Keep email as the detailed fallback.
- Use one Message Service and one transport gateway.
- Fail closed when Twilio env is missing.
- Treat whole-event cancellation as blocked until the non-destructive cancellation state is accepted.
