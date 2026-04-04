"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DutyRosterRecord } from "@/lib/types";

type DutyRosterProps = {
  duties: DutyRosterRecord[];
};

function weekdaySortValue(label: string) {
  const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const first = label.split(",")[0]?.trim() ?? label;
  const index = order.indexOf(first);
  return index === -1 ? 99 : index;
}

export function DutyRoster({ duties }: DutyRosterProps) {
  const [dayFilter, setDayFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const dayOptions = useMemo(
    () =>
      Array.from(new Set(duties.map((duty) => duty.dayLabel))).sort(
        (left, right) => weekdaySortValue(left) - weekdaySortValue(right) || left.localeCompare(right)
      ),
    [duties]
  );

  const filteredDuties = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return duties.filter((duty) => {
      const matchesDay = !dayFilter || duty.dayLabel === dayFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "assigned" && duty.isAssigned) ||
        (statusFilter === "unassigned" && !duty.isAssigned);
      const matchesSearch =
        !search ||
        [duty.name, duty.location, duty.assignedStaffName, duty.assignedStaffDepartment]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      return matchesDay && matchesStatus && matchesSearch;
    });
  }, [dayFilter, duties, searchTerm, statusFilter]);

  const assignedCount = filteredDuties.filter((duty) => duty.isAssigned).length;
  const unassignedCount = filteredDuties.length - assignedCount;

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Duty module</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">Duty roster</h1>
            <p className="hero-copy">
              Review the live duty schedule, scan assigned versus unassigned coverage, and
              filter quickly by day before we add admin reassignment controls in the next pass.
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
              placeholder="Search by duty, location, or staff name..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="rosterDay">Day</label>
            <select id="rosterDay" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
              <option value="">All days</option>
              {dayOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
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
              <option value="all">All duties</option>
              <option value="assigned">Assigned only</option>
              <option value="unassigned">Unassigned only</option>
            </select>
          </div>
        </div>
      </section>

      <section className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Duty blocks shown</p>
          <p className="stat-value">{filteredDuties.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Assigned</p>
          <p className="stat-value">{assignedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Unassigned</p>
          <p className="stat-value">{unassignedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Coverage rate</p>
          <p className="stat-value">
            {filteredDuties.length ? Math.round((assignedCount / filteredDuties.length) * 100) : 0}%
          </p>
        </div>
      </section>

      <section className="duty-roster-grid">
        {filteredDuties.map((duty) => (
          <article className={`duty-roster-card${duty.isAssigned ? "" : " unassigned"}`} key={duty.id}>
            <div className="duty-card-top">
              <div>
                <p className="duty-card-time">{duty.timeLabel}</p>
                <h2 className="duty-card-title">{duty.name}</h2>
              </div>
              <span className="duty-card-day">{duty.dayLabel}</span>
            </div>
            <p className="duty-card-location">{duty.location || "Location to be confirmed"}</p>

            <div className="duty-assignee-block">
              <p className="eyebrow">Assigned staff</p>
              {duty.isAssigned ? (
                <div className="duty-assignee">
                  <div className="directory-avatar small">
                    {duty.assignedStaffPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={duty.assignedStaffPhotoUrl}
                        alt={duty.assignedStaffName ?? "Assigned staff"}
                        className="directory-avatar-image"
                      />
                    ) : (
                      <span>{duty.assignedStaffName?.[0] ?? "?"}</span>
                    )}
                  </div>
                  <div>
                    <p className="duty-assignee-name">{duty.assignedStaffName}</p>
                    <p className="directory-meta-line">{duty.assignedStaffDepartment ?? "Staff"}</p>
                  </div>
                </div>
              ) : (
                <div className="banner error-banner compact-banner">Currently unassigned</div>
              )}
            </div>
          </article>
        ))}
      </section>

      {!filteredDuties.length ? (
        <section className="panel">
          <div className="empty-state">No duties match the current roster filters.</div>
        </section>
      ) : null}
    </div>
  );
}
