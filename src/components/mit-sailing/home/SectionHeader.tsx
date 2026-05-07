type SectionHeaderProps = {
  action?: React.ReactNode;
  subtitle?: string;
  title: string;
};

/**
 * Consistent title + optional subtitle for home marketing sections.
 *
 * @param props - Section content
 * @param props.title - Main heading
 * @param props.subtitle - Optional supporting line
 * @param props.action - Optional right column (e.g. “View all” link)
 * @returns Section header block
 */
export function SectionHeader(props: SectionHeaderProps) {
  return (
    <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <h2 className="mb-3 font-mit-serif text-[22px] font-semibold text-foreground">
          {props.title}
        </h2>
        {props.subtitle ? (
          <p className="text-base text-muted-foreground">{props.subtitle}</p>
        ) : null}
      </div>
      {props.action ? <div className="shrink-0">{props.action}</div> : null}
    </div>
  );
}
