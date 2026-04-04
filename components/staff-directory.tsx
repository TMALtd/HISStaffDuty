"use client";

import { useMemo, useState } from "react";
import type { StaffDirectoryRecord } from "@/lib/types";

type StaffDirectoryProps = {
  staff: StaffDirectoryRecord[];
};

function normalized(value: string | null | undefined) {
  return (value ?? "").trim();
}

function uniqueValues(items: Array<string | null | undefined>) {
  return Array.from(new Set(items.map(normalized).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true })
  );
}

export function StaffDirectory({ staff }: StaffDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [timetableFilter, setTimetableFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");

  const departmentOptions = useMemo(
    () => uniqueValues(staff.map((person) => person.department)),
    [staff]
  );
  const timetableOptions = useMemo(
    () => uniqueValues(staff.map((person) => person.timetable)),
    [staff]
  );
  const designationOptions = useMemo(
    () => uniqueValues(staff.map((person) => person.designation)),
    [staff]
  );

  const filteredStaff = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return staff.filter((person) => {
      const matchesSearch =
        !search ||
        [
          person.name,
          person.first_name,
          person.email,
          person.department,
          person.timetable,
          person.class
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      const matchesDepartment =
        !departmentFilter || normalized(person.department) === departmentFilter;
      const matchesTimetable = !timetableFilter || normalized(person.timetable) === timetableFilter;
      const matchesDesignation =
        !designationFilter || normalized(person.designation) === designationFilter;

      return matchesSearch && matchesDepartment && matchesTimetable && matchesDesignation;
    });
  }, [departmentFilter, designationFilter, searchTerm, staff, timetableFilter]);

  const shownDutyCount = filteredStaff.reduce(
    (total, person) => total + person.assigned_duties.length,
    0
  );

  function clearFilters() {
    setSearchTerm("");
    setDepartmentFilter("");
    setTimetableFilter("");
    setDesignationFilter("");
  }

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Duty module</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">Staff directory</h1>
            <p className="hero-copy">
              Search the team, filter by department or timetable, and review each staff
              member&apos;s current duty footprint in one place.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Search and filter staff</h2>
        <div className="filters-grid directory-filters">
          <div className="field directory-search">
            <label htmlFor="staffSearch">Search</label>
            <input
              id="staffSearch"
              type="text"
              placeholder="Search by name, email, department, class..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="departmentFilter">Department</label>
            <select
              id="departmentFilter"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value="">All departments</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="timetableFilter">Timetable</label>
            <select
              id="timetableFilter"
              value={timetableFilter}
              onChange={(event) => setTimetableFilter(event.target.value)}
            >
              <option value="">All timetables</option>
              {timetableOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="designationFilter">Designation</label>
            <select
              id="designationFilter"
              value={designationFilter}
              onChange={(event) => setDesignationFilter(event.target.value)}
            >
              <option value="">All designations</option>
              {designationOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="actions">
          <button className="button secondary" type="button" onClick={clearFilters}>
            Clear filters
          </button>
          <span className="hint">
            {filteredStaff.length} staff shown | {shownDutyCount} active duties in view
          </span>
        </div>
      </section>

      <section className="directory-grid">
        {filteredStaff.map((person) => (
          <article className="directory-card" key={person.id}>
            <div className="directory-card-header">
              <div className="directory-avatar">
                {person.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.photo_url} alt={person.name} className="directory-avatar-image" />
                ) : (
                  <span>{person.first_name?.[0] ?? person.name[0] ?? "?"}</span>
                )}
              </div>
              <div className="directory-card-copy">
                <h2 className="directory-name">{person.name}</h2>
                <p className="directory-role">{person.role ?? "Staff"}</p>
                <p className="directory-meta-line">
                  {person.department ?? "Department pending"} | {person.timetable ?? "No timetable"}
                </p>
              </div>
            </div>

            <div className="directory-info-grid">
              <div className="identity-chip">
                <span>Designation</span>
                <strong>{person.designation ?? "—"}</strong>
              </div>
              <div className="identity-chip">
                <span>Class</span>
                <strong>{person.class ?? "—"}</strong>
              </div>
              <div className="identity-chip">
                <span>Status</span>
                <strong>{person.status ?? "—"}</strong>
              </div>
              <div className="identity-chip">
                <span>Max Duties</span>
                <strong>{person.max_duties ?? 0}</strong>
              </div>
            </div>

            <div className="directory-contact">
              <p className="directory-contact-line">
                <strong>Email:</strong> {person.email ?? "Not set"}
              </p>
              {person.extension ? (
                <p className="directory-contact-line">
                  <strong>Extension:</strong> {person.extension}
                </p>
              ) : null}
            </div>

            <div className="directory-duty-section">
              <div className="panel-heading compact">
                <div>
                  <p className="eyebrow">Assigned duties</p>
                  <h3 className="mi-title">Current load</h3>
                </div>
                <p className="hint">{person.assigned_duties.length} duties</p>
              </div>

              {person.assigned_duties.length ? (
                <div className="duty-list compact">
                  {person.assigned_duties.map((duty) => (
                    <article className="duty-card compact" key={duty.id}>
                      <div className="duty-card-top">
                        <div>
                          <p className="duty-card-time">{duty.timeLabel}</p>
                          <h4 className="duty-card-title">{duty.name}</h4>
                        </div>
                        <span className="duty-card-day">{duty.dayLabel}</span>
                      </div>
                      <p className="duty-card-location">{duty.location || "Location to be confirmed"}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  No active duties are currently assigned to this staff member.
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
