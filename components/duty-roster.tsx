"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DutyRosterAssignment, DutyRosterGroup } from "@/lib/types";

type DutyRosterProps = {
  groups: DutyRosterGroup[];
};

const WEEKDAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" }
] as const;

function badgeClassForColor(color: string | null | undefined) {
  if (!color) {
    return "";
  }

  const normalized = color.toLowerCase();
  if (normalized === "red") {
    return " duty-lead";
  }
  if (normalized === "black") {
    return " duty-dark";
  }
  return "";
}

function assignmentForDay(assignments: DutyRosterAssignment[], dayKey: string) {
  return assignments.find((assignment) => assignment.dayOfWeek?.toLowerCase() === dayKey) ?? null;
}

export function DutyRoster({ groups }: DutyRosterProps) {
  const [dayFilter, setDayFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredGroups = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return groups
      .map((group) => {
        const subGroups = group.subGroups.filter((subGroup) => {
          const visibleAssignments = subGroup.assignments.filter((assignment) => {
            const matchesDay = !dayFilter || assignment.dayOfWeek?.toLowerCase() === dayFilter;
            const matchesStatus =
              statusFilter === "all" ||
              (statusFilter === "assigned" && assignment.isAssigned) ||
              (statusFilter === "unassigned" && !assignment.isAssigned);
            const matchesSearch =
              !search ||
              [
                group.name,
                subGroup.name,
                subGroup.location,
                assignment.assignedStaffName,
                assignment.assignedStaffDepartment
              ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(search));

            return matchesDay && matchesStatus && matchesSearch;
          });

          return visibleAssignments.length > 0;
        });

        return { ...group, subGroups };
      })
      .filter((group) => group.subGroups.length > 0);
  }, [dayFilter, groups, searchTerm, statusFilter]);

  const visibleAssignments = filteredGroups.flatMap((group) =>
    group.subGroups.flatMap((subGroup) =>
      subGroup.assignments.filter((assignment) => !dayFilter || assignment.dayOfWeek?.toLowerCase() === dayFilter)
    )
  );

  const assignedCount = visibleAssignments.filter((assignment) => assignment.isAssigned).length;
  const unassignedCount = visibleAssignments.length - assignedCount;
  const visibleDays = dayFilter ? WEEKDAYS.filter((day) => day.key === dayFilter) : WEEKDAYS;

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Duty module</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">Duty roster</h1>
            <p className="hero-copy">
              Review the full duty structure by parent group, sub-duty, and daily assignment.
              Duty Leads and other special roles are highlighted from the live <code>color</code>{" "}
              field in Supabase.
            </p>
          </div>
          <Link className="button secondary" href="/duties">
            Back to Duty Dashboard
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Filter the live roster</h2>
        <div className="filters-grid directory-filters">
          <div className="field directory-search">
            <label htmlFor="rosterSearch">Search</label>
            <input
              id="rosterSearch"
              type="text"
              placeholder="Search by group, duty, location, or staff name..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="rosterDay">Day</label>
            <select id="rosterDay" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
              <option value="">All weekdays</option>
              {WEEKDAYS.map((day) => (
                <option key={day.key} value={day.key}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rosterStatus">Status</label>
            <select
              id="rosterStatus"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "assigned" | "unassigned")}
            >
              <option value="all">All assignments</option>
              <option value="assigned">Assigned only</option>
              <option value="unassigned">Unassigned only</option>
            </select>
          </div>
        </div>
      </section>

      <section className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Duty groups shown</p>
          <p className="stat-value">{filteredGroups.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Assignments shown</p>
          <p className="stat-value">{visibleAssignments.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Assigned</p>
          <p className="stat-value">{assignedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Unassigned</p>
          <p className="stat-value">{unassignedCount}</p>
        </div>
      </section>

      <section className="duty-group-list">
        {filteredGroups.map((group) => (
          <article className={`duty-group-card${badgeClassForColor(group.color)}`} key={group.id}>
            <header className="duty-group-header">
              <div>
                <h2 className="duty-group-title">{group.name}</h2>
                <p className="duty-group-meta">
                  {group.timeLabel} | Sort Order: {group.sortOrder ?? 0}
                </p>
                <p className="duty-group-days">{group.daysLabel}</p>
              </div>
            </header>

            {group.description ? <p className="duty-group-description">{group.description}</p> : null}

            <div className="duty-subgroup-list">
              {group.subGroups.map((subGroup) => (
                <section className={`duty-subgroup-card${badgeClassForColor(subGroup.color)}`} key={subGroup.id}>
                  <div className="duty-subgroup-header">
                    <div>
                      <h3 className="duty-subgroup-title">{subGroup.name}</h3>
                      <p className="duty-subgroup-meta">{subGroup.id}</p>
                      <p className="duty-subgroup-location">{subGroup.location || "Location to be confirmed"}</p>
                    </div>
                  </div>

                  <p className="eyebrow">Daily assignments</p>
                  <div className={`duty-week-grid columns-${visibleDays.length}`}>
                    {visibleDays.map((day) => {
                      const assignment = assignmentForDay(subGroup.assignments, day.key);
                      return (
                        <div className="duty-day-cell" key={`${subGroup.id}-${day.key}`}>
                          <p className="duty-day-label">{day.label}</p>
                          <p className="duty-day-time">{assignment?.timeLabel ?? group.timeLabel}</p>
                          {assignment ? (
                            <div className={`duty-assignment-chip${assignment.isAssigned ? "" : " unassigned"}`}>
                              <div className="directory-avatar xsmall">
                                {assignment.assignedStaffPhotoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={assignment.assignedStaffPhotoUrl}
                                    alt={assignment.assignedStaffName ?? "Assigned staff"}
                                    className="directory-avatar-image"
                                  />
                                ) : (
                                  <span>{assignment.assignedStaffName?.[0] ?? "?"}</span>
                                )}
                              </div>
                              <div>
                                <p className="duty-assignee-name">
                                  {assignment.assignedStaffName ?? "Unassigned"}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="duty-assignment-chip empty">No day instance</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>

      {!filteredGroups.length ? (
        <section className="panel">
          <div className="empty-state">No duty groups match the current roster filters.</div>
        </section>
      ) : null}
    </div>
  );
}
