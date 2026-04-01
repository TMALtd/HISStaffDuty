"use client";

import { useEffect, useState } from "react";
import { EMPTY_FILTERS, FILTER_FIELDS, type FilterOptions, type FilterState, type StudentRow } from "@/lib/types";

type FiltersResponse = {
  options: FilterOptions;
};

type StudentsResponse = {
  students: StudentRow[];
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

export function StaffDashboard() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [options, setOptions] = useState<FilterOptions>(createEmptyOptions());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);

      try {
        const query = buildQueryString(filters);
        const [filtersResponse, studentsResponse] = await Promise.all([
          fetch(`/api/filters${query ? `?${query}` : ""}`, { cache: "no-store" }),
          fetch(`/api/students${query ? `?${query}` : ""}`, { cache: "no-store" })
        ]);

        if (filtersResponse.status === 401 || studentsResponse.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!filtersResponse.ok) {
          throw new Error("Could not load filter options.");
        }

        if (!studentsResponse.ok) {
          throw new Error("Could not load students.");
        }

        const filtersJson = (await filtersResponse.json()) as FiltersResponse;
        const studentsJson = (await studentsResponse.json()) as StudentsResponse;

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
  }, [filters]);

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

  return (
    <div className="dashboard-grid">
      <section className="panel">
        <h2 className="panel-title">Filter roster</h2>
        <div className="filters-grid">
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
          <span className="hint">{isLoading ? "Refreshing results..." : "Filters update live."}</span>
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
