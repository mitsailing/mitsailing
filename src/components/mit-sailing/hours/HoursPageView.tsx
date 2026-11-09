type HoursScheduleRow = {
  day: string;
  hours: string;
};

type HoursPageViewProps = {
  note: string;
  rows: readonly HoursScheduleRow[];
  scheduleLabel: string;
  season: string;
  title: string;
};

/**
 * Plain pavilion schedule: season line, day rows, and the sunset note.
 *
 * @param props - Resolved HoursPage copy
 * @returns Schedule article
 */
export function HoursPageView(props: HoursPageViewProps) {
  return (
    <article className="max-w-xl text-mit-text">
      <header className="mb-8">
        <h1 className="font-mit-serif text-3xl font-semibold text-mit-text md:text-4xl">
          {props.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed">{props.season}</p>
      </header>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{props.scheduleLabel}</caption>
        <tbody>
          {props.rows.map((row, index) => {
            const isLastRow = index === props.rows.length - 1;
            return (
              <tr
                className={isLastRow ? undefined : 'border-b border-mit-line'}
                key={row.day}
              >
                <th
                  className="py-3 text-left font-semibold text-mit-text"
                  scope="row"
                >
                  {row.day}
                </th>
                <td className="py-3 text-mit-text">{row.hours}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-6 text-sm leading-relaxed">{props.note}</p>
    </article>
  );
}
