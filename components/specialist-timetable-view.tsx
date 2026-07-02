import Link from "next/link";
import type { SpecialistTimetableViewData } from "@/lib/types";

type SpecialistTimetableViewProps = {
  data: SpecialistTimetableViewData;
  backHref: string;
};

export function SpecialistTimetableView({ data, backHref }: SpecialistTimetableViewProps) {
  return (
    <section className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Teaching schedule</p>
        <h1 className="hero-title">Year-group timetable view</h1>
        <p className="hero-copy">
          {data.staffName ?? "This teacher"} can see the year group, class coverage, and lesson blocks they are
          teaching across the week.
        </p>
        <div className="actions">
          <Link className="button secondary" href={backHref}>
            Back to Timetables
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="stats-row">
          <article className="stat-card">
            <p className="stat-label">Teaching blocks</p>
            <p className="stat-value">{data.slotCount}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Year groups</p>
            <p className="stat-value">{data.yearGroups.length}</p>
          </article>
          <article className="stat-card specialist-stat-card">
            <p className="stat-label">Coverage</p>
            <p className="stat-value specialist-stat-copy">
              {data.yearGroups.length > 0 ? data.yearGroups.join(", ") : "No assigned timetable blocks"}
            </p>
          </article>
        </div>
      </section>

      <section className="specialist-schedule-grid">
        {data.daySchedules.map((day) => (
          <article className="panel specialist-day-column" key={day.key}>
            <div className="specialist-day-header">
              <h2 className="panel-title specialist-day-title">{day.label}</h2>
              <p className="meta">{day.slots.length} block{day.slots.length === 1 ? "" : "s"}</p>
            </div>
            {day.slots.length > 0 ? (
              <div className="specialist-slot-list">
                {day.slots.map((slot) => (
                  <article
                    className="specialist-slot-card"
                    key={slot.id}
                    style={slot.color ? { borderTopColor: slot.color } : undefined}
                  >
                    <div className="specialist-slot-topline">
                      <strong>{slot.title}</strong>
                      <span>{slot.startTime}-{slot.endTime}</span>
                    </div>
                    <p className="specialist-slot-meta">{slot.periodLabel}</p>
                    <div className="specialist-coverage-list">
                      {slot.coverages.map((coverage) => (
                        <div className="specialist-coverage-chip" key={`${slot.id}-${coverage.yearGroup}`}>
                          <strong>{coverage.yearGroup}</strong>
                          <span>{coverage.coverageLabel}</span>
                          <p>{coverage.classNames.join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                No teaching blocks assigned on {day.label}.
              </div>
            )}
          </article>
        ))}
      </section>
    </section>
  );
}
