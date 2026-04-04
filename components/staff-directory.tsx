"use client";

import { useMemo, useState } from "react";
import type { StaffDirectoryRecord } from "@/lib/types";

type StaffDirectoryProps = {
  staff: StaffDirectoryRecord[];
};

function uniqueValues(items: Array<string | null | undefined>) {
  return Array.from(new Set(items.map((item) => (item ?? "").trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true })
  );
}

function formatDutyLabel(duty: StaffDirectoryRecord["assigned_duties"][number]) {
  return `${duty.dayLabel} / ${duty.name} (${duty.timeLabel})`;
}

export function StaffDirectory({ staff }: StaffDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const departmentOptions = useMemo(
    () => uniqueValues(staff.map((person) => person.department)),
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
          person.role,
          person.email,
          person.class,
          person.staff_id
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      const matchesDepartment =
        !departmentFilter || (person.department ?? "").trim() === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [departmentFilter, searchTerm, staff]);

  const selectedStaff =
    filteredStaff.find((person) => person.id === selectedStaffId) ??
    staff.find((person) => person.id === selectedStaffId) ??
    null;

  return (
    <div className="dashboard-grid">
      <section className="directory-hero">
        <div>
          <h1 className="directory-page-title">Staff Management</h1>
          <p className="directory-page-copy">Manage teaching staff profiles and information</p>
        </div>
        <button className="directory-add-button" type="button" disabled>
          + Add Staff Member
        </button>
      </section>

      <section className="directory-search-panel">
        <div className="directory-search-grid">
          <div className="field directory-search-field">
            <label htmlFor="staffSearch">Search Staff</label>
            <input
              id="staffSearch"
              type="text"
              placeholder="Search by name, role, class, ID..."
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
              <option value="">All Departments</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="directory-card-grid">
        {filteredStaff.map((person, index) => (
          <article className="staff-management-card" key={person.id}>
            <span className="staff-card-badge">#{person.staff_id ?? index + 1}</span>

            <div className="staff-management-header">
              <div className="directory-avatar management-avatar">
                {person.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.photo_url} alt={person.name} className="directory-avatar-image" />
                ) : (
                  <span>{person.first_name?.[0] ?? person.name[0] ?? "?"}</span>
                )}
              </div>
              <div className="staff-management-copy">
                <h2 className="directory-name">{person.first_name ?? person.name}</h2>
                <p className="staff-management-line primary">{person.department ?? "Department pending"}</p>
                <p className="staff-management-line accent">
                  {person.class || person.timetable || person.designation || "Staff profile"}
                </p>
              </div>
            </div>

            <div className="staff-card-actions">
              <button className="directory-action edit" type="button" disabled>
                Edit
              </button>
              <button
                className="directory-action view"
                type="button"
                onClick={() => setSelectedStaffId(person.id)}
              >
                View
              </button>
              <button className="directory-action icon" type="button" disabled>
                ⋮
              </button>
            </div>
          </article>
        ))}
      </section>

      {!filteredStaff.length ? (
        <section className="panel">
          <div className="empty-state">No staff match the current search.</div>
        </section>
      ) : null}

      {selectedStaff ? (
        <div className="directory-modal-backdrop" role="presentation" onClick={() => setSelectedStaffId(null)}>
          <section
            className="directory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-directory-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="directory-modal-close"
              type="button"
              onClick={() => setSelectedStaffId(null)}
            >
              ×
            </button>

            <div className="directory-modal-header">
              <div className="directory-avatar management-avatar large">
                {selectedStaff.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedStaff.photo_url}
                    alt={selectedStaff.name}
                    className="directory-avatar-image"
                  />
                ) : (
                  <span>{selectedStaff.first_name?.[0] ?? selectedStaff.name[0] ?? "?"}</span>
                )}
              </div>
              <div>
                <h2 id="staff-directory-modal-title" className="directory-modal-title">
                  {selectedStaff.name}
                </h2>
                <p className="staff-management-line primary">{selectedStaff.role ?? "Staff"}</p>
                <p className="staff-management-line accent">
                  {selectedStaff.department ?? "Department pending"}
                </p>
              </div>
            </div>

            <div className="directory-modal-grid">
              <div className="directory-modal-section">
                <h3 className="directory-modal-heading">Personal Information</h3>
                <div className="directory-modal-list">
                  <div className="directory-modal-row">
                    <span>First Name</span>
                    <strong>{selectedStaff.first_name ?? "—"}</strong>
                  </div>
                  <div className="directory-modal-row">
                    <span>Email</span>
                    <strong>{selectedStaff.email ?? "—"}</strong>
                  </div>
                  <div className="directory-modal-row">
                    <span>Department</span>
                    <strong>{selectedStaff.department ?? "—"}</strong>
                  </div>
                  <div className="directory-modal-row">
                    <span>Team</span>
                    <strong>{selectedStaff.class ?? selectedStaff.timetable ?? "—"}</strong>
                  </div>
                  <div className="directory-modal-row">
                    <span>Role</span>
                    <strong>{selectedStaff.role ?? "—"}</strong>
                  </div>
                  <div className="directory-modal-row">
                    <span>Status</span>
                    <strong>{selectedStaff.status ?? "—"}</strong>
                  </div>
                </div>
              </div>

              <div className="directory-modal-section">
                <h3 className="directory-modal-heading">Work Details</h3>
                <div className="directory-modal-summary">
                  <span>Assigned Duties</span>
                  <strong>{selectedStaff.assigned_duties.length}</strong>
                </div>
                <div className="directory-duty-stack">
                  {selectedStaff.assigned_duties.length ? (
                    selectedStaff.assigned_duties.map((duty) => (
                      <div className="directory-duty-pill" key={duty.id}>
                        {formatDutyLabel(duty)}
                      </div>
                    ))
                  ) : (
                    <div className="directory-duty-pill empty">No assigned duties</div>
                  )}
                </div>
              </div>
            </div>

            <div className="directory-modal-footer-card">
              <h3 className="directory-modal-heading">Timetable Visibility</h3>
              <p className="directory-page-copy compact">
                Control which timetables this staff member can view. This action will be added in
                the next admin phase.
              </p>
              <button className="directory-add-button full-width" type="button" disabled>
                + Grant Timetable Access
              </button>
            </div>

            <div className="directory-modal-actions">
              <button className="directory-action edit" type="button" disabled>
                Edit
              </button>
              <button className="directory-action view" type="button" disabled>
                Photo
              </button>
              <button className="directory-action view" type="button" disabled>
                Password
              </button>
              <button className="directory-action close" type="button" onClick={() => setSelectedStaffId(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
