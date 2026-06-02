import { BadgeCheck, Mail, Phone, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ProfileSectionHref =
  | '#change-email-section'
  | '#contact-section'
  | '#member-information-section'
  | '#sailing-card-section';

function ProfileFact(props: {
  readonly label: string;
  readonly value: string;
  readonly muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {props.label}
      </dt>
      <dd
        className={
          props.muted
            ? 'mt-1 truncate text-sm text-muted-foreground'
            : 'mt-1 truncate text-sm font-medium text-foreground'
        }
      >
        {props.value}
      </dd>
    </div>
  );
}

function ProfileSectionLink(props: {
  readonly href: ProfileSectionHref;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly summary: string;
}) {
  const Icon = props.icon;
  return (
    // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- profile section hrefs are restricted to literal in-page fragment IDs.
    <a
      className="group flex min-h-14 items-center gap-3 rounded-lg border border-mit-line bg-background px-3 py-2 text-left no-underline transition-colors hover:border-mit-red/40 hover:bg-mit-red-highlight focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      href={props.href}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-mit-line bg-card text-primary-ink transition-colors group-hover:border-mit-red/40">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">
          {props.label}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {props.summary}
        </span>
      </span>
    </a>
  );
}

function ProfileOverviewHeader(props: {
  readonly currentEmail: string;
  readonly initials: string;
  readonly note: string;
  readonly overline: string;
  readonly title: string;
}) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-mit-red text-lg font-semibold text-primary-foreground"
        >
          {props.initials}
        </div>
        <div className="min-w-0">
          <p className="m-0 text-sm font-medium text-muted-foreground">
            {props.overline}
          </p>
          <h1
            className="mt-1 truncate text-2xl font-semibold text-foreground"
            id="profile-overview-heading"
          >
            {props.title}
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {props.currentEmail}
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-mit-line bg-muted/50 px-3 py-2 text-sm text-mit-readable-ink md:max-w-60">
        {props.note}
      </div>
    </div>
  );
}

function ProfileOverviewFacts(props: {
  readonly emailLabel: string;
  readonly emailStatus: string;
  readonly emergencyLabel: string;
  readonly emergencyMuted: boolean;
  readonly emergencySummary: string;
  readonly phoneLabel: string;
  readonly phoneSummary: string;
  readonly sailingCardLabel: string;
  readonly sailingCardSummary: string;
}) {
  return (
    <dl className="mt-5 grid gap-4 border-t border-mit-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
      <ProfileFact
        label={props.sailingCardLabel}
        value={props.sailingCardSummary}
      />
      <ProfileFact label={props.emailLabel} value={props.emailStatus} />
      <ProfileFact label={props.phoneLabel} value={props.phoneSummary} />
      <ProfileFact
        label={props.emergencyLabel}
        muted={props.emergencyMuted}
        value={props.emergencySummary}
      />
    </dl>
  );
}

function ProfileOverviewNav(props: {
  readonly affiliationSummary: string;
  readonly contactLabel: string;
  readonly contactSummary: string;
  readonly emailLabel: string;
  readonly emailStatus: string;
  readonly memberLabel: string;
  readonly sailingCardLabel: string;
  readonly sailingCardSummary: string;
  readonly sectionsLabel: string;
}) {
  return (
    <nav
      aria-label={props.sectionsLabel}
      className="mt-5 grid gap-2 border-t border-mit-line pt-5 sm:grid-cols-2"
    >
      <ProfileSectionLink
        href="#sailing-card-section"
        icon={BadgeCheck}
        label={props.sailingCardLabel}
        summary={props.sailingCardSummary}
      />
      <ProfileSectionLink
        href="#member-information-section"
        icon={UserRound}
        label={props.memberLabel}
        summary={props.affiliationSummary}
      />
      <ProfileSectionLink
        href="#contact-section"
        icon={Phone}
        label={props.contactLabel}
        summary={props.contactSummary}
      />
      <ProfileSectionLink
        href="#change-email-section"
        icon={Mail}
        label={props.emailLabel}
        summary={props.emailStatus}
      />
    </nav>
  );
}

export function ProfileOverview(props: {
  readonly affiliationSummary: string;
  readonly contactLabel: string;
  readonly contactSummary: string;
  readonly currentEmail: string;
  readonly emailLabel: string;
  readonly emailStatus: string;
  readonly emergencyLabel: string;
  readonly emergencyMuted: boolean;
  readonly emergencySummary: string;
  readonly initials: string;
  readonly memberLabel: string;
  readonly note: string;
  readonly overline: string;
  readonly phoneLabel: string;
  readonly phoneSummary: string;
  readonly sailingCardLabel: string;
  readonly sailingCardSummary: string;
  readonly sectionsLabel: string;
  readonly title: string;
}) {
  return (
    <section
      aria-labelledby="profile-overview-heading"
      className="rounded-lg border border-mit-line bg-card p-5 shadow-sm md:p-6"
    >
      <ProfileOverviewHeader
        currentEmail={props.currentEmail}
        initials={props.initials}
        note={props.note}
        overline={props.overline}
        title={props.title}
      />
      <ProfileOverviewFacts
        emailLabel={props.emailLabel}
        emailStatus={props.emailStatus}
        emergencyLabel={props.emergencyLabel}
        emergencyMuted={props.emergencyMuted}
        emergencySummary={props.emergencySummary}
        phoneLabel={props.phoneLabel}
        phoneSummary={props.phoneSummary}
        sailingCardLabel={props.sailingCardLabel}
        sailingCardSummary={props.sailingCardSummary}
      />
      <ProfileOverviewNav
        affiliationSummary={props.affiliationSummary}
        contactLabel={props.contactLabel}
        contactSummary={props.contactSummary}
        emailLabel={props.emailLabel}
        emailStatus={props.emailStatus}
        memberLabel={props.memberLabel}
        sailingCardLabel={props.sailingCardLabel}
        sailingCardSummary={props.sailingCardSummary}
        sectionsLabel={props.sectionsLabel}
      />
    </section>
  );
}
