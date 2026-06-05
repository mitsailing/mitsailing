import type { getTranslations } from 'next-intl/server';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import { eventUsesLearnToSailWaitlist } from '@/libs/mit-sailing/learnToSailEvents';

type LearnToSailWaitlistNoteTranslations = Awaited<
  ReturnType<typeof getTranslations<'MitSailingEvents'>>
>;

function learnToSailClassRequestsLabel(props: {
  readonly count: number;
  readonly t: LearnToSailWaitlistNoteTranslations;
}): string {
  return props.t(
    props.count === 1
      ? 'learn_to_sail_class_request_one'
      : 'learn_to_sail_class_requests_many',
    { count: props.count }
  );
}

function learnToSailSpotsLabel(props: {
  readonly count: number;
  readonly t: LearnToSailWaitlistNoteTranslations;
}): string {
  return props.t(
    props.count === 1 ? 'learn_to_sail_spot_one' : 'learn_to_sail_spots_many',
    { count: props.count }
  );
}

export function LearnToSailWaitlistNote(props: {
  readonly event: PublicEventDetail;
  readonly t: LearnToSailWaitlistNoteTranslations;
}) {
  if (!eventUsesLearnToSailWaitlist(props.event)) {
    return null;
  }
  const requestCount =
    props.event.pendingRegistrationCount +
    props.event.approvedRegistrationCount;
  return (
    <div className="rounded-lg border border-mit-red/30 bg-mit-red-highlight p-3 text-sm text-mit-readable-ink">
      <div className="mb-2 flex flex-wrap gap-2">
        <span className="rounded-full bg-mit-red px-2 py-1 text-xs font-semibold text-white">
          {props.t('learn_to_sail_waitlist_badge')}
        </span>
        <span className="rounded-full bg-mit-red px-2 py-1 text-xs font-semibold text-white">
          {props.t('learn_to_sail_not_first_come')}
        </span>
        {requestCount > 0 ? (
          <span className="rounded-full border border-mit-line bg-background px-2 py-1 text-xs font-semibold text-mit-readable-ink">
            {learnToSailClassRequestsLabel({
              count: requestCount,
              t: props.t,
            })}
          </span>
        ) : null}
        {props.event.maxParticipants === null ? null : (
          <span className="rounded-full border border-mit-line bg-background px-2 py-1 text-xs font-semibold text-mit-readable-ink">
            {learnToSailSpotsLabel({
              count: props.event.maxParticipants,
              t: props.t,
            })}
          </span>
        )}
      </div>
      <p className="m-0 leading-relaxed font-medium">
        {props.t('learn_to_sail_request_rule')}
      </p>
    </div>
  );
}
