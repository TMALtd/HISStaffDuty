import type { DutyDashboardData } from "@/lib/types";

type DutyDashboardProps = {
  data: DutyDashboardData;
};

function DutyList({
  duties,
  emptyMessage
}: {
  duties: DutyDashboardData["myUpcomingDuties"];
  emptyMessage: string;
}) {
  if (!duties.length) {
    return <div className="empty-state compact">{emptyMessage}</div>;
  }

  return (
    <div className="duty-list">
      {duties.map((duty) => (
        <article className="duty-card" key={duty.id}>
          <div className="duty-card-top">
            <div>
              <p className="duty-card-time">{duty.timeLabel}</p>
              <h3 className="duty-card-title">{duty.name}</h3>
            </div>
            <span className="duty-card-day">{duty.dayLabel}</span>
          </div>
          <p className="duty-card-location">{duty.location || "Location to be confirmed"}</p>
        </article>
      ))}
    </div>
  );
}

export function DutyDashboard({ data }: DutyDashboardProps) {
  const upcomingCount = data.myUpcomingDuties.length;
  const todayCount = data.todaysSnapshot.length;

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Duty module</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">Duty dashboard</h1>
            <p className="hero-copy">
              View your assigned duties, monitor today&apos;s live coverage, and use this as the
              bridge into the full roster tools we&apos;ll migrate next.
            </p>
          </div>
        </div>
        <p className="meta">
          {data.staffProfile
            ? `${data.staffProfile.name} | ${data.staffProfile.department ?? "Staff"}`
            : "Signed-in user not yet linked to a staff card."}
        </p>
      </section>

      <section className="stats-row">
        <div className="stat-card">
          <p className="stat-label">My duties</p>
          <p className="stat-value">{upcomingCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Today&apos;s duties</p>
          <p className="stat-value">{todayCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Active duty blocks</p>
          <p className="stat-value">{data.activeDutyCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Unassigned today</p>
          <p className="stat-value">{data.unassignedCount}</p>
        </div>
      </section>

      {!data.staffProfile ? (
        <section className="panel">
          <div className="banner error-banner">
            Your Google login worked, but this email is not yet matched to a row in the{" "}
            <code>staff</code> table. Duty pages will become fully personalized once that link is
            in place.
          </div>
        </section>
      ) : null}

      <section className="mi-grid duty-grid">
        <article className="panel mi-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">My duty view</p>
              <h2 className="panel-title">Upcoming assigned duties</h2>
            </div>
            <p className="hint">Pulled directly from the live duties table.</p>
          </div>
          <DutyList
            duties={data.myUpcomingDuties}
            emptyMessage="No duties are currently assigned to your staff record."
          />
        </article>

        <article className="panel mi-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Today&apos;s coverage</p>
              <h2 className="panel-title">{data.weekdayLabel} snapshot</h2>
            </div>
            <p className="hint">This is the first live duty view inside the portal.</p>
          </div>
          <DutyList
            duties={data.todaysSnapshot}
            emptyMessage="No active duties were found for today."
          />
        </article>
      </section>
    </div>
  );
}
