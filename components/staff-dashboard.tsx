"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EMPTY_FILTERS,
  FILTER_FIELDS,
  type FilterOptions,
  type FilterState,
  type StudentAcademicYear,
  type StudentRow
} from "@/lib/types";

type FiltersResponse = {
  options: FilterOptions;
  error?: string;
};

type StudentsResponse = {
  students: StudentRow[];
  error?: string;
};

function buildQueryString(filters: FilterState) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  return params.toString();
}

function createEmptyOptions(): FilterOptions {
  return {
    school: [],
    designation: [],
    yearGroup: [],
    milepost: [],
    level: [],
    className: []
  };
}

function getInitial(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "M") {
    return "Male";
  }
  if (normalized === "F") {
    return "Female";
  }

  return value;
}

function buildCounts(students: StudentRow[], getValue: (student: StudentRow) => string) {
  const counts = new Map<string, number>();

  students.forEach((student) => {
    const key = getValue(student) || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

type StaffDashboardProps = {
  canManageRosterYears?: boolean;
  academicYears?: StudentAcademicYear[];
  previewEmail?: string | null;
};

export function StaffDashboard({
  canManageRosterYears = false,
  academicYears = [],
  previewEmail = null
}: StaffDashboardProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [options, setOptions] = useState<FilterOptions>(createEmptyOptions());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState(
    canManageRosterYears ? academicYears.find((year) => year.is_active)?.label ?? "" : ""
  );

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);

      try {
        const params = new URLSearchParams(buildQueryString(filters));
        if (canManageRosterYears && academicYear) {
          params.set("academicYear", academicYear);
        }
        if (previewEmail) {
          params.set("viewAs", previewEmail);
        }
        const query = params.toString();
        const [filtersResponse, studentsResponse] = await Promise.all([
          fetch(`/api/filters${query ? `?${query}` : ""}`, { cache: "no-store" }),
          fetch(`/api/students${query ? `?${query}` : ""}`, { cache: "no-store" })
        ]);

        if (filtersResponse.status === 401 || studentsResponse.status === 401) {
          window.location.href = "/login";
          return;
        }

        const filtersJson = (await filtersResponse.json()) as FiltersResponse;
        const studentsJson = (await studentsResponse.json()) as StudentsResponse;

        if (!filtersResponse.ok) {
          throw new Error(filtersJson.error || "Could not load filter options.");
        }

        if (!studentsResponse.ok) {
          throw new Error(studentsJson.error || "Could not load students.");
        }

        if (!isMounted) {
          return;
        }

        setOptions(filtersJson.options);
        setStudents(studentsJson.students);
        setError("");
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Something went wrong.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [filters, academicYear, canManageRosterYears, previewEmail]);

  function updateFilter(field: keyof FilterState, value: string) {
    setFilters((current) => {
      const next = { ...current, [field]: value };
      const changedIndex = FILTER_FIELDS.indexOf(field);

      FILTER_FIELDS.slice(changedIndex + 1).forEach((laterField) => {
        next[laterField] = "";
      });

      return next;
    });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const selectedCount = Object.values(filters).filter(Boolean).length;
  const classCount = new Set(students.map((student) => student.class_name)).size;
  const genderBreakdown = buildCounts(students, (student) => getInitial(student.gender));
  const houseBreakdown = buildCounts(students, (student) => student.academic_house || "Unknown");
  const yearBreakdown = buildCounts(students, (student) => student.year_code || "Unknown");
  const classBreakdown = buildCounts(students, (student) => student.class_name);
  const femaleCount = students.filter((student) => (student.gender || "").toUpperCase() === "F").length;
  const maleCount = students.filter((student) => (student.gender || "").toUpperCase() === "M").length;
  const averageClassSize = classCount ? (students.length / classCount).toFixed(1) : "0.0";
  const gradebookParams = new URLSearchParams(buildQueryString(filters));
  if (previewEmail) {
    gradebookParams.set("viewAs", previewEmail);
  }
  const gradebookQuery = gradebookParams.toString();
  const gradebookHref = `/gradebook${gradebookQuery ? `?${gradebookQuery}` : ""}`;

  return (
    <div className="dashboard-grid">
      <section className="panel">
        <h2 className="panel-title">Filter roster</h2>
        <div className="filters-grid">
          {canManageRosterYears ? (
            <div className="field">
              <label htmlFor="academicYear">Roster year</label>
              <select
                id="academicYear"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
              >
                <option value="">Live roster</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.label}>
                    {year.label}
                    {year.is_active ? " | Live" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="school">School</label>
            <select
              id="school"
              value={filters.school}
              onChange={(event) => updateFilter("school", event.target.value)}
            >
              <option value="">All schools</option>
              {options.school.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="designation">Designation</label>
            <select
              id="designation"
              value={filters.designation}
              onChange={(event) => updateFilter("designation", event.target.value)}
            >
              <option value="">All designations</option>
              {options.designation.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="yearGroup">Year Group</label>
            <select
              id="yearGroup"
              value={filters.yearGroup}
              onChange={(event) => updateFilter("yearGroup", event.target.value)}
            >
              <option value="">All year groups</option>
              {options.yearGroup.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="milepost">Milepost</label>
            <select
              id="milepost"
              value={filters.milepost}
              onChange={(event) => updateFilter("milepost", event.target.value)}
            >
              <option value="">All mileposts</option>
              {options.milepost.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="level">Level</label>
            <select
              id="level"
              value={filters.level}
              onChange={(event) => updateFilter("level", event.target.value)}
            >
              <option value="">All levels</option>
              {options.level.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="className">Class</label>
            <select
              id="className"
              value={filters.className}
              onChange={(event) => updateFilter("className", event.target.value)}
            >
              <option value="">All classes</option>
              {options.className.map((option) => (
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
          <Link className="button secondary" href="/directory">
            Open Directory
          </Link>
          <Link className="button secondary" href="/duties">
            Open Duty
          </Link>
          <Link className="button" href={gradebookHref}>
            Enter Markbook
          </Link>
          <Link className="button secondary" href="/admin/gradebook">
            Markbook Setup
          </Link>
          <span className="hint">{isLoading ? "Refreshing results..." : "Filters update live."}</span>
          {canManageRosterYears && academicYear ? (
            <span className="hint">Previewing {academicYear}</span>
          ) : null}
        </div>
        {error ? <div className="banner error-banner">{error}</div> : null}
      </section>

      <section className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Selected filters</p>
          <p className="stat-value">{selectedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Students shown</p>
          <p className="stat-value">{students.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Classes shown</p>
          <p className="stat-value">{classCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Average class size</p>
          <p className="stat-value">{averageClassSize}</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Management information</p>
            <h2 className="panel-title">Live summary of the current cohort</h2>
          </div>
          <p className="hint">These summaries update automatically as you change filters.</p>
        </div>

        <div className="mi-grid">
          <article className="mi-card">
            <h3 className="mi-title">Gender split</h3>
            <div className="mini-stats">
              <div>
                <p className="stat-label">Female</p>
                <p className="mini-value">{femaleCount}</p>
              </div>
              <div>
                <p className="stat-label">Male</p>
                <p className="mini-value">{maleCount}</p>
              </div>
            </div>
            <div className="breakdown-list">
              {genderBreakdown.map((item) => (
                <div className="breakdown-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="mi-card">
            <h3 className="mi-title">House distribution</h3>
            <div className="breakdown-list">
              {houseBreakdown.map((item) => (
                <div className="breakdown-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="bar-wrap">
                    <div
                      className="bar-fill"
                      style={{ width: `${students.length ? (item.count / students.length) * 100 : 0}%` }}
                    />
                    <strong>{item.count}</strong>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="mi-card">
            <h3 className="mi-title">Year-group distribution</h3>
            <div className="breakdown-list">
              {yearBreakdown.map((item) => (
                <div className="breakdown-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="mi-card">
            <h3 className="mi-title">Largest classes in view</h3>
            <div className="breakdown-list">
              {classBreakdown.slice(0, 8).map((item) => (
                <div className="breakdown-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="table-shell">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Preferred Name</th>
                <th>School ID</th>
                <th>Gender</th>
                <th>Form</th>
                <th>Year Code</th>
                <th>Tutor</th>
                <th>House</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.school_id}>
                  <td>{student.full_name}</td>
                  <td>{student.preferred_name || "—"}</td>
                  <td>{student.school_id}</td>
                  <td>{student.gender || "—"}</td>
                  <td>{student.form}</td>
                  <td>{student.year_code || "—"}</td>
                  <td>{student.tutor || "—"}</td>
                  <td>{student.academic_house || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length ? (
            <div className="empty-state">
              No students match the current filter combination. Try clearing one or more
              filters.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
