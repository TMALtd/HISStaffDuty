"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  EMPTY_FILTERS,
  FILTER_FIELDS,
  type PortalPageAccessSetting,
  type StaffDirectoryClassOption,
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

function getStudentYearLabel(student: StudentRow) {
  const explicitYearCode = String(student.year_code ?? "").trim();
  if (explicitYearCode) {
    return explicitYearCode;
  }

  const candidates = [
    String(student.year_group ?? "").trim(),
    String(student.form ?? "").trim(),
    String(student.class_name ?? "").trim()
  ].filter(Boolean);

  for (const candidate of candidates) {
    const preschoolMatch = candidate.match(/preschool\s*(\d+)/i);
    if (preschoolMatch) {
      return `PS${preschoolMatch[1]}`;
    }

    const yearGroupMatch = candidate.match(/year\s*(\d+)/i);
    if (yearGroupMatch) {
      return yearGroupMatch[1];
    }

    const classLeadingNumberMatch = candidate.match(/^(\d{1,2})\b/);
    if (classLeadingNumberMatch) {
      return classLeadingNumberMatch[1];
    }
  }

  return "Unknown";
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

function getPieChartColor(index: number) {
  const palette = [
    "#9f1724",
    "#2f7d32",
    "#b45309",
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#0f766e",
    "#c2410c"
  ];

  return palette[index % palette.length];
}

type BreakdownItem = {
  label: string;
  count: number;
};

function BreakdownPie({
  items,
  total,
  emptyLabel = "No data"
}: {
  items: BreakdownItem[];
  total: number;
  emptyLabel?: string;
}) {
  if (!total || items.length === 0) {
    return (
      <div className="breakdown-pie-empty">
        <span>{emptyLabel}</span>
      </div>
    );
  }

  let cumulative = 0;
  const circumference = 2 * Math.PI * 15.9155;

  return (
    <div className="breakdown-pie-shell">
      <svg className="breakdown-pie" viewBox="0 0 36 36" aria-hidden="true">
        <circle className="breakdown-pie-track" cx="18" cy="18" r="15.9155" />
        {items.map((item, index) => {
          const slice = (item.count / total) * 100;
          const dashArray = `${(slice / 100) * circumference} ${circumference}`;
          const dashOffset = -((cumulative / 100) * circumference);
          cumulative += slice;

          return (
            <circle
              key={item.label}
              className="breakdown-pie-slice"
              cx="18"
              cy="18"
              r="15.9155"
              stroke={getPieChartColor(index)}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="breakdown-pie-total">
        <strong>{total}</strong>
        <span>students</span>
      </div>
    </div>
  );
}

type StaffDashboardProps = {
  canManageRosterYears?: boolean;
  academicYears?: StudentAcademicYear[];
  classOptions?: StaffDirectoryClassOption[];
  pageAccessSettings?: PortalPageAccessSetting[];
  previewEmail?: string | null;
};

type StudentEditorDraft = {
  school: string;
  designation: string;
  year_group: string;
  milepost: string;
  level: string;
  class_name: string;
  full_name: string;
  surname: string;
  first_name: string;
  preferred_name: string;
  gender: string;
  nationality: string;
  form: string;
  year_code: string;
  tutor: string;
  academic_house: string;
};

function normalizeStudentGender(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "M" || normalized === "MALE" || normalized === "BOY") {
    return "M";
  }

  if (normalized === "F" || normalized === "FEMALE" || normalized === "GIRL") {
    return "F";
  }

  return "";
}

export function StaffDashboard({
  canManageRosterYears = false,
  academicYears = [],
  classOptions = [],
  pageAccessSettings = [],
  previewEmail = null
}: StaffDashboardProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [options, setOptions] = useState<FilterOptions>(createEmptyOptions());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [academicYear, setAcademicYear] = useState(
    canManageRosterYears ? academicYears.find((year) => year.is_active)?.label ?? "" : ""
  );
  const [editingStudentId, setEditingStudentId] = useState("");
  const [editorDraft, setEditorDraft] = useState<StudentEditorDraft | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);

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
  }, [filters, academicYear, canManageRosterYears, previewEmail, refreshToken]);

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

  function openStudentEditor(student: StudentRow) {
    setEditingStudentId(student.school_id);
    setEditorDraft({
      school: student.school,
      designation: student.designation,
      year_group: student.year_group,
      milepost: student.milepost,
      level: student.level,
      class_name: student.class_name,
      full_name: student.full_name,
      surname: student.surname ?? "",
      first_name: student.first_name ?? "",
      preferred_name: student.preferred_name ?? "",
      gender: normalizeStudentGender(student.gender),
      nationality: student.nationality ?? "",
      form: student.form,
      year_code: student.year_code ?? "",
      tutor: student.tutor ?? "",
      academic_house: student.academic_house ?? ""
    });
    setError("");
    setStatus("");
  }

  function closeStudentEditor() {
    setEditingStudentId("");
    setEditorDraft(null);
    setIsSavingStudent(false);
  }

  async function saveStudentEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStudentId || !editorDraft) {
      return;
    }

    const selectedClassOption =
      classOptions.find((option) => option.className === editorDraft.class_name) ?? null;

    setIsSavingStudent(true);
    setError("");

    try {
      const response = await fetch("/api/students/admin", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "update-student",
          academicYearLabel: canManageRosterYears ? academicYear || null : null,
          studentSchoolId: editingStudentId,
          className: editorDraft.class_name,
          classCode: selectedClassOption?.classCode ?? null,
          school: editorDraft.school,
          designation: editorDraft.designation,
          yearGroup: editorDraft.year_group,
          milepost: editorDraft.milepost,
          level: editorDraft.level,
          fullName: editorDraft.full_name,
          surname: editorDraft.surname,
          firstName: editorDraft.first_name,
          preferredName: editorDraft.preferred_name,
          gender: normalizeStudentGender(editorDraft.gender),
          nationality: editorDraft.nationality,
          form: editorDraft.form,
          yearCode: editorDraft.year_code,
          tutor: editorDraft.tutor,
          academicHouse: editorDraft.academic_house
        })
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Could not update student details.");
      }

      setStatus("Student details updated.");
      closeStudentEditor();
      setRefreshToken((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update student details.");
    } finally {
      setIsSavingStudent(false);
    }
  }

  const selectedCount = Object.values(filters).filter(Boolean).length;
  const classCount = new Set(students.map((student) => student.class_name)).size;
  const genderBreakdown = buildCounts(students, (student) => getInitial(student.gender));
  const houseBreakdown = buildCounts(students, (student) => student.academic_house || "Unknown");
  const yearBreakdown = buildCounts(students, (student) => getStudentYearLabel(student));
  const nationalityBreakdown = buildCounts(students, (student) => student.nationality || "Unknown");
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
  const pageAccessLookup = new Map(pageAccessSettings.map((setting) => [setting.pageKey, setting.isEnabled]));
  const showDirectoryLink = pageAccessLookup.get("student-link-directory") ?? false;
  const showDutyLink = pageAccessLookup.get("student-link-duty") ?? false;
  const showGradebookLink = pageAccessLookup.get("student-link-gradebook") ?? false;

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
          {showDirectoryLink ? (
            <Link className="button secondary" href="/directory">
              Open Directory
            </Link>
          ) : null}
          {showDutyLink ? (
            <Link className="button secondary" href="/duties">
              Open Duty
            </Link>
          ) : null}
          {showGradebookLink ? (
            <Link className="button" href={gradebookHref}>
              Enter Markbook
            </Link>
          ) : null}
          {canManageRosterYears ? (
            <Link className="button secondary" href="/admin/gradebook">
              Markbook Setup
            </Link>
          ) : null}
          <span className="hint">{isLoading ? "Refreshing results..." : "Filters update live."}</span>
          {canManageRosterYears && academicYear ? (
            <span className="hint">Previewing {academicYear}</span>
          ) : null}
        </div>
        {status ? <div className="status-banner success">{status}</div> : null}
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
            <BreakdownPie items={genderBreakdown} total={students.length} />
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
            <BreakdownPie items={houseBreakdown.slice(0, 6)} total={students.length} />
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
            <BreakdownPie items={yearBreakdown} total={students.length} />
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
            <h3 className="mi-title">Nationality mix</h3>
            <BreakdownPie items={nationalityBreakdown.slice(0, 6)} total={students.length} />
            <div className="breakdown-list">
              {nationalityBreakdown.slice(0, 8).map((item) => (
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
                <th>Nationality</th>
                <th>Class</th>
                <th>Year Code</th>
                <th>Homeroom Teacher</th>
                <th>House</th>
                {canManageRosterYears ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.school_id}>
                  <td>{student.full_name}</td>
                  <td>{student.preferred_name || "—"}</td>
                  <td>{student.school_id}</td>
                  <td>{student.gender || "—"}</td>
                  <td>{student.nationality || "—"}</td>
                  <td>{student.class_name}</td>
                  <td>{getStudentYearLabel(student)}</td>
                  <td>{student.assigned_teacher_name || student.tutor || "—"}</td>
                  <td>{student.academic_house || "—"}</td>
                  {canManageRosterYears ? (
                    <td>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => openStudentEditor(student)}
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
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

      {canManageRosterYears && editorDraft && editingStudentId ? (
        <div className="directory-modal-backdrop" role="presentation" onClick={closeStudentEditor}>
          <div className="directory-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="directory-modal-close" type="button" onClick={closeStudentEditor} aria-label="Close">
              ×
            </button>
            <div className="directory-modal-header">
              <div>
                <p className="eyebrow">Student editor</p>
                <h2 className="directory-modal-title">{editorDraft.full_name || editingStudentId}</h2>
                <p className="meta">School ID: {editingStudentId}</p>
              </div>
            </div>
            <form onSubmit={saveStudentEditor}>
              {error ? <div className="status-banner error compact-banner">{error}</div> : null}
              <div className="directory-modal-grid">
                <section className="directory-modal-section">
                  <h3 className="directory-modal-heading">Identity</h3>
                  <div className="directory-form-grid">
                    <label className="field field-span-2">
                      <span>Full Name</span>
                      <input value={editorDraft.full_name} onChange={(event) => setEditorDraft((current) => current ? { ...current, full_name: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>First Name</span>
                      <input value={editorDraft.first_name} onChange={(event) => setEditorDraft((current) => current ? { ...current, first_name: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>Surname</span>
                      <input value={editorDraft.surname} onChange={(event) => setEditorDraft((current) => current ? { ...current, surname: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>Preferred Name</span>
                      <input value={editorDraft.preferred_name} onChange={(event) => setEditorDraft((current) => current ? { ...current, preferred_name: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>Gender</span>
                      <select value={editorDraft.gender} onChange={(event) => setEditorDraft((current) => current ? { ...current, gender: event.target.value } : current)}>
                        <option value="">Not set</option>
                        <option value="M">M</option>
                        <option value="F">F</option>
                      </select>
                    </label>
                    <label className="field field-span-2">
                      <span>Nationality</span>
                      <input value={editorDraft.nationality} onChange={(event) => setEditorDraft((current) => current ? { ...current, nationality: event.target.value } : current)} />
                    </label>
                  </div>
                </section>

                <section className="directory-modal-section">
                  <h3 className="directory-modal-heading">Placement</h3>
                  <div className="directory-form-grid">
                    <label className="field">
                      <span>School</span>
                      <input value={editorDraft.school} onChange={(event) => setEditorDraft((current) => current ? { ...current, school: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>Designation</span>
                      <input value={editorDraft.designation} onChange={(event) => setEditorDraft((current) => current ? { ...current, designation: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>Year Group</span>
                      <input value={editorDraft.year_group} onChange={(event) => setEditorDraft((current) => current ? { ...current, year_group: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>Milepost</span>
                      <input value={editorDraft.milepost} onChange={(event) => setEditorDraft((current) => current ? { ...current, milepost: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>Level</span>
                      <input value={editorDraft.level} onChange={(event) => setEditorDraft((current) => current ? { ...current, level: event.target.value } : current)} />
                    </label>
                    <label className="field field-span-2">
                      <span>Class</span>
                      <input list="student-class-options" value={editorDraft.class_name} onChange={(event) => setEditorDraft((current) => current ? { ...current, class_name: event.target.value } : current)} />
                      <datalist id="student-class-options">
                        {classOptions.map((option) => (
                          <option key={`${option.classCode}-${option.className}`} value={option.className} />
                        ))}
                      </datalist>
                    </label>
                    <label className="field">
                      <span>Form</span>
                      <input value={editorDraft.form} onChange={(event) => setEditorDraft((current) => current ? { ...current, form: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>Year Code</span>
                      <input value={editorDraft.year_code} onChange={(event) => setEditorDraft((current) => current ? { ...current, year_code: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>Tutor / Homeroom Teacher</span>
                      <input value={editorDraft.tutor} onChange={(event) => setEditorDraft((current) => current ? { ...current, tutor: event.target.value } : current)} />
                    </label>
                    <label className="field">
                      <span>House</span>
                      <input value={editorDraft.academic_house} onChange={(event) => setEditorDraft((current) => current ? { ...current, academic_house: event.target.value } : current)} />
                    </label>
                  </div>
                </section>
              </div>
              <div className="directory-modal-actions">
                <button className="button secondary" type="button" onClick={closeStudentEditor}>
                  Cancel
                </button>
                <button className="button" type="submit" disabled={isSavingStudent}>
                  {isSavingStudent ? "Saving..." : "Save Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
