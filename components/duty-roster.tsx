"use client";

import { useMemo, useState } from "react";
import type {
  DutyRosterAssignment,
  DutyRosterGroup,
  DutyRosterViewData
} from "@/lib/types";

type DutyRosterProps = {
  data: DutyRosterViewData;
};

const UNASSIGNED_STAFF_ID = "__UNASSIGNED__";
const WEEKDAYS = [
  { key: "monday", label: "Mon", longLabel: "Monday" },
  { key: "tuesday", label: "Tue", longLabel: "Tuesday" },
  { key: "wednesday", label: "Wed", longLabel: "Wednesday" },
  { key: "thursday", label: "Thu", longLabel: "Thursday" },
  { key: "friday", label: "Fri", longLabel: "Friday" }
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

function displayStaffName(assignment: DutyRosterAssignment) {
  if (assignment.assignedStaffFirstName) {
    return assignment.assignedStaffFirstName;
  }

  if (!assignment.assignedStaffName) {
    return "Unassigned";
  }

  return assignment.assignedStaffName.split(" ")[0] ?? assignment.assignedStaffName;
}

function missingDutyLabel(dayLabel: string) {
  return `No ${dayLabel} Duty`;
}

function assignmentMatchesFilters(params: {
  assignment: DutyRosterAssignment;
  selectedStaffMember: string;
  selectedDepartment: string;
  staffSearchMatch: boolean;
  hasMetaSearchMatch: boolean;
}) {
  const { assignment, selectedStaffMember, selectedDepartment, staffSearchMatch, hasMetaSearchMatch } =
    params;

  const matchesStaffMember =
    !selectedStaffMember ||
    (selectedStaffMember === UNASSIGNED_STAFF_ID
      ? !assignment.isAssigned
      : assignment.assignedStaffId === selectedStaffMember);

  const matchesDepartment =
    !selectedDepartment || assignment.assignedStaffDepartment === selectedDepartment;

  const matchesSearch = hasMetaSearchMatch || staffSearchMatch;

  return matchesStaffMember && matchesDepartment && matchesSearch;
}

export function DutyRoster({ data }: DutyRosterProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDutyGroup, setSelectedDutyGroup] = useState("");
  const [selectedStaffMember, setSelectedStaffMember] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");

  const filteredGroups = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return data.groups
      .filter((group) => !selectedDutyGroup || group.id === selectedDutyGroup)
      .map((group) => {
        const groupSearchMatch =
          !search ||
          [group.name, group.description, group.daysLabel]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search));

        const subGroups = group.subGroups
          .map((subGroup) => {
            const subgroupSearchMatch =
              !search ||
              [subGroup.name, subGroup.location]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(search));

            const visibleAssignments = subGroup.assignments.filter((assignment) => {
              const staffSearchMatch =
                !search ||
                [assignment.assignedStaffName, assignment.assignedStaffFirstName, assignment.assignedStaffDepartment]
                  .filter(Boolean)
                  .some((value) => String(value).toLowerCase().includes(search));

              return assignmentMatchesFilters({
                assignment,
                selectedStaffMember,
                selectedDepartment,
                staffSearchMatch,
                hasMetaSearchMatch: groupSearchMatch || subgroupSearchMatch
              });
            });

            return {
              ...subGroup,
              visibleAssignments
            };
          })
          .filter((subGroup) => subGroup.visibleAssignments.length > 0);

        return { ...group, subGroups };
      })
      .filter((group) => group.subGroups.length > 0);
  }, [data.groups, searchTerm, selectedDepartment, selectedDutyGroup, selectedStaffMember]);

  const visibleAssignments = filteredGroups.flatMap((group) =>
    group.subGroups.flatMap((subGroup) => subGroup.visibleAssignments)
  );

  const assignedCount = visibleAssignments.filter((assignment) => assignment.isAssigned).length;
  const unassignedCount = visibleAssignments.length - assignedCount;

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Duty module</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title roster-hero-title">Term 3 2025-2026 Duty Roster - Primary</h1>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="legacy-filter-bar">
          <span className="legacy-filter-label">Filters:</span>
          <div className="field">
            <label htmlFor="rosterSearch">Search</label>
            <input
              id="rosterSearch"
              type="text"
              placeholder="Search duties or staff..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="dutyGroupFilter">Duty Group</label>
            <select
              id="dutyGroupFilter"
              value={selectedDutyGroup}
              onChange={(event) => setSelectedDutyGroup(event.target.value)}
            >
              <option value="">All Duty Groups</option>
              {data.dutyGroupOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="staffMemberFilter">Staff Member</label>
            <select
              id="staffMemberFilter"
              value={selectedStaffMember}
              onChange={(event) => setSelectedStaffMember(event.target.value)}
            >
              <option value="">All Staff</option>
              <option value={UNASSIGNED_STAFF_ID}>UNASSIGNED</option>
              {data.staffOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="departmentFilter">Department</label>
            <select
              id="departmentFilter"
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
            >
              <option value="">All Departments</option>
              {data.departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
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
                  <div className="duty-week-grid columns-5">
                    {WEEKDAYS.map((day) => {
                      const assignment = assignmentForDay(subGroup.visibleAssignments, day.key);
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
                                  <span>{assignment.assignedStaffFirstName?.[0] ?? "?"}</span>
                                )}
                              </div>
                              <div>
                                <p className="duty-assignee-name">{displayStaffName(assignment)}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="duty-assignment-chip empty">
                              {missingDutyLabel(day.longLabel)}
                            </div>
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
