"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  GradebookEntry,
  GradebookFieldDefinition,
  GradebookSubject,
  FilterState,
  StudentRow
} from "@/lib/types";

type GradebookWorkspaceProps = {
  initialFilters: FilterState;
};

type EntriesResponse = {
  students: StudentRow[];
  fields: GradebookFieldDefinition[];
  entries: GradebookEntry[];
  subject: GradebookSubject | null;
};

type SubjectsResponse = {
  subjects: GradebookSubject[];
};

type AssessmentsResponse = {
  assessments: Array<{
    assessment_name: string;
    assessment_date: string;
  }>;
};

type DraftRow = {
  grade: string;
  score: string;
  comment: string;
  fieldValues: Record<string, string>;
  assessmentName: string;
  assessmentDate: string;
};

function buildQueryString(filters: FilterState) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

function makeEmptyDraft(): DraftRow {
  return {
    grade: "",
    score: "",
    comment: "",
    fieldValues: {},
    assessmentName: "",
    assessmentDate: ""
  };
}

const PASTORAL_FIELD_ORDER = [
  "student_gender",
  "behaviour_concerns",
  "social_emotional_concerns",
  "attitude_towards_learning",
  "confidential_parent_issues",
  "personal_character",
  "certificates_given",
  "supporting_notes"
] as const;

export function GradebookWorkspace({ initialFilters }: GradebookWorkspaceProps) {
  const [subjects, setSubjects] = useState<GradebookSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [assessmentName, setAssessmentName] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [assessments, setAssessments] = useState<
    Array<{ assessment_name: string; assessment_date: string }>
  >([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [fields, setFields] = useState<GradebookFieldDefinition[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [subjectMeta, setSubjectMeta] = useState<GradebookSubject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects]
  );
  const isPastoralPage = selectedSubject?.slug === "student-pastoral";

  useEffect(() => {
    let isMounted = true;

    async function loadSubjects() {
      const params = new URLSearchParams();
      if (initialFilters.className) {
        params.set("className", initialFilters.className);
      }

      const response = await fetch(`/api/gradebook/subjects?${params.toString()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Could not load gradebook subjects.");
      }

      const json = (await response.json()) as SubjectsResponse;

      if (!isMounted) {
        return;
      }

      setSubjects(json.subjects);
      if (!selectedSubjectId && json.subjects[0]) {
        setSelectedSubjectId(json.subjects[0].id);
      }
    }

    void loadSubjects().catch((loadError) => {
      if (isMounted) {
        setError(loadError instanceof Error ? loadError.message : "Could not load subjects.");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [initialFilters.className, selectedSubjectId]);

  useEffect(() => {
    let isMounted = true;

    async function loadAssessments() {
      if (!selectedSubjectId || isPastoralPage) {
        setAssessments([]);
        return;
      }

      const params = new URLSearchParams({ subjectId: selectedSubjectId });
      if (initialFilters.className) {
        params.set("className", initialFilters.className);
      }

      const response = await fetch(`/api/gradebook/assessments?${params.toString()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Could not load assessments.");
      }

      const json = (await response.json()) as AssessmentsResponse;

      if (!isMounted) {
        return;
      }

      setAssessments(json.assessments);

      const hasCurrentMatch = json.assessments.some(
        (assessment) =>
          assessment.assessment_name === assessmentName &&
          assessment.assessment_date === assessmentDate
      );

      if ((!assessmentName && !assessmentDate && json.assessments[0]) || (!hasCurrentMatch && json.assessments[0])) {
        setAssessmentName(json.assessments[0].assessment_name);
        setAssessmentDate(json.assessments[0].assessment_date);
      }
    }

    void loadAssessments().catch((loadError) => {
      if (isMounted) {
        setError(loadError instanceof Error ? loadError.message : "Could not load assessments.");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [assessmentDate, assessmentName, initialFilters.className, isPastoralPage, selectedSubjectId]);

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      if (!selectedSubjectId) {
        return;
      }

      setIsLoading(true);
      setStatus("");
      setError("");

      try {
        const params = new URLSearchParams(buildQueryString(initialFilters));
        params.set("subjectId", selectedSubjectId);
        if (assessmentName) {
          params.set("assessmentName", assessmentName);
        }
        if (assessmentDate) {
          params.set("assessmentDate", assessmentDate);
        }

        const response = await fetch(`/api/gradebook/entries?${params.toString()}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Could not load gradebook data.");
        }

        const json = (await response.json()) as EntriesResponse;

        if (!isMounted) {
          return;
        }

        setSubjectMeta(json.subject);

        const nextDrafts: Record<string, DraftRow> = {};
        json.students.forEach((student) => {
          const existing = json.entries.find((entry) => entry.student_school_id === student.school_id);
          nextDrafts[student.school_id] = existing
            ? {
                grade: existing.grade ?? "",
                score: existing.score ?? "",
                comment: existing.comment ?? "",
                fieldValues: existing.field_values ?? {},
                assessmentName: existing.assessment_name ?? "",
                assessmentDate: existing.assessment_date ?? ""
              }
            : makeEmptyDraft();
        });

        setStudents(json.students);
        const orderedFields =
          json.subject?.slug === "student-pastoral"
            ? json.fields
                .filter((field) =>
                  PASTORAL_FIELD_ORDER.includes(
                    field.field_key as (typeof PASTORAL_FIELD_ORDER)[number]
                  )
                )
                .sort(
                  (left, right) =>
                    PASTORAL_FIELD_ORDER.indexOf(
                      left.field_key as (typeof PASTORAL_FIELD_ORDER)[number]
                    ) -
                    PASTORAL_FIELD_ORDER.indexOf(
                      right.field_key as (typeof PASTORAL_FIELD_ORDER)[number]
                    )
                )
            : json.fields;
        setFields(orderedFields);
        setDrafts(nextDrafts);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Could not load gradebook data.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadEntries();

    return () => {
      isMounted = false;
    };
  }, [assessmentDate, assessmentName, initialFilters, selectedSubjectId]);

  function handleAssessmentSelection(value: string) {
    if (!value) {
      setAssessmentName("");
      setAssessmentDate("");
      return;
    }

    const [name, date] = value.split("||");
    setAssessmentName(name ?? "");
    setAssessmentDate(date ?? "");
  }

  function updateDraft(studentId: string, field: keyof DraftRow, value: string) {
    setDrafts((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        [field]: value
      }
    }));
  }

  function updateCustomField(studentId: string, fieldKey: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        fieldValues: {
          ...(current[studentId]?.fieldValues ?? {}),
          [fieldKey]: value
        }
      }
    }));
  }

  async function saveEntry(student: StudentRow) {
    if (!selectedSubjectId || (!isPastoralPage && (!assessmentName || !assessmentDate))) {
      setError("Select a subject and complete the assessment name and date before saving.");
      return;
    }

    const draft = drafts[student.school_id] ?? makeEmptyDraft();
    const effectiveAssessmentName = isPastoralPage
      ? draft.assessmentName || "Student Pastoral Profile"
      : assessmentName;
    const effectiveAssessmentDate = isPastoralPage
      ? draft.assessmentDate || "2000-01-01"
      : assessmentDate;
    const response = await fetch("/api/gradebook/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentSchoolId: student.school_id,
        className: student.class_name,
        subjectId: selectedSubjectId,
        assessmentName: effectiveAssessmentName,
        assessmentDate: effectiveAssessmentDate,
        grade: draft.grade,
        score: draft.score,
        comment: draft.comment,
        fieldValues: draft.fieldValues
      })
    });

    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setError(json.error ?? "Could not save gradebook entry.");
      return;
    }

    setStatus(`Saved ${student.full_name}.`);
    setError("");
  }

  async function deleteEntry(student: StudentRow) {
    if (!selectedSubjectId || (!isPastoralPage && (!assessmentName || !assessmentDate))) {
      setError("Select a subject and complete the assessment name and date before deleting.");
      return;
    }

    const draft = drafts[student.school_id] ?? makeEmptyDraft();
    const response = await fetch("/api/gradebook/entries", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentSchoolId: student.school_id,
        subjectId: selectedSubjectId,
        assessmentName: isPastoralPage
          ? draft.assessmentName || "Student Pastoral Profile"
          : assessmentName,
        assessmentDate: isPastoralPage
          ? draft.assessmentDate || "2000-01-01"
          : assessmentDate
      })
    });

    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setError(json.error ?? "Could not delete gradebook entry.");
      return;
    }

    setDrafts((current) => ({
      ...current,
      [student.school_id]: makeEmptyDraft()
    }));
    setStatus(`Cleared ${student.full_name}.`);
    setError("");
  }

  function renderPastoralCards() {
    return (
      <div className="pastoral-grid">
        {students.map((student) => {
          const draft = drafts[student.school_id] ?? makeEmptyDraft();

          return (
            <article className="pastoral-card" key={student.school_id}>
              <div className="pastoral-card-header">
                <div>
                  <p className="pastoral-name">{student.full_name}</p>
                  <p className="pastoral-subtitle">
                    {student.class_name} | {student.school_id}
                  </p>
                </div>
                <div className="table-actions">
                  <button className="button" type="button" onClick={() => void saveEntry(student)}>
                    Save
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void deleteEntry(student)}
                  >
                    Erase
                  </button>
                </div>
              </div>

              <div className="identity-grid">
                <div className="identity-chip">
                  <span>Full Name</span>
                  <strong>{student.full_name}</strong>
                </div>
                <div className="identity-chip">
                  <span>Surname</span>
                  <strong>{student.surname || "—"}</strong>
                </div>
                <div className="identity-chip">
                  <span>First Name</span>
                  <strong>{student.first_name || "—"}</strong>
                </div>
                <div className="identity-chip">
                  <span>Known As</span>
                  <strong>{student.preferred_name || "—"}</strong>
                </div>
              </div>

              <div className="pastoral-fields-grid">
                {fields.map((field) => (
                  <label className="pastoral-field" key={field.id}>
                    <span>{field.field_label}</span>
                    {field.field_type === "long_text" ? (
                      <textarea
                        className="cell-textarea"
                        value={draft.fieldValues[field.field_key] ?? ""}
                        onChange={(event) =>
                          updateCustomField(student.school_id, field.field_key, event.target.value)
                        }
                      />
                    ) : (
                      <input
                        className="cell-input"
                        type={
                          field.field_type === "number"
                            ? "number"
                            : field.field_type === "date"
                              ? "date"
                              : "text"
                        }
                        value={draft.fieldValues[field.field_key] ?? ""}
                        onChange={(event) =>
                          updateCustomField(student.school_id, field.field_key, event.target.value)
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Gradebook workspace</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">Enter and update gradebook data</h1>
            <p className="hero-copy">
              Core fields stay the same for every subject page: name, assessment name,
              assessment date, grade, score, and comment. Extra fields are controlled from
              gradebook setup.
            </p>
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <Link className="button secondary" href={`/${buildQueryString(initialFilters) ? `?${buildQueryString(initialFilters)}` : ""}`}>
              Back to Filter View
            </Link>
            <Link className="button" href="/admin/gradebook">
              Gradebook Setup
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="filters-grid">
          <div className="field">
            <label htmlFor="subject">Subject page</label>
            <select
              id="subject"
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                  {subject.class_name ? ` (${subject.class_name})` : ""}
                </option>
              ))}
            </select>
          </div>
          {isPastoralPage ? (
            <div className="field">
              <label>Pastoral page</label>
              <div className="hint">
                This is an information page. Assessment name and date are not required.
              </div>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="existingAssessment">Existing assessment</label>
                <select
                  id="existingAssessment"
                  value={
                    assessmentName && assessmentDate ? `${assessmentName}||${assessmentDate}` : ""
                  }
                  onChange={(event) => handleAssessmentSelection(event.target.value)}
                >
                  <option value="">New or custom assessment</option>
                  {assessments.map((assessment) => (
                    <option
                      key={`${assessment.assessment_name}-${assessment.assessment_date}`}
                      value={`${assessment.assessment_name}||${assessment.assessment_date}`}
                    >
                      {assessment.assessment_name} | {assessment.assessment_date}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="assessmentName">Assessment name</label>
                <input
                  id="assessmentName"
                  value={assessmentName}
                  onChange={(event) => setAssessmentName(event.target.value)}
                  placeholder="e.g. Term 3 Reading Checkpoint"
                />
              </div>
              <div className="field">
                <label htmlFor="assessmentDate">Assessment date</label>
                <input
                  id="assessmentDate"
                  type="date"
                  value={assessmentDate}
                  onChange={(event) => setAssessmentDate(event.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <div className="actions">
          <span className="hint">
            Active class filter: {initialFilters.className || "All classes"}{selectedSubject ? ` | Subject: ${selectedSubject.name}` : ""}
          </span>
        </div>
        {status ? <div className="banner">{status}</div> : null}
        {error ? <div className="banner error-banner">{error}</div> : null}
      </section>

      <section className="table-shell">
        {isPastoralPage ? (
          <div className="pastoral-shell">
            {renderPastoralCards()}
            {!students.length && !isLoading ? (
              <div className="empty-state">
                No students match the current filters. Choose a different class or return to the
                filter page first.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{isPastoralPage ? "Full Name" : "Name"}</th>
                {isPastoralPage ? (
                  <>
                    <th>Surname</th>
                    <th>First Name</th>
                    <th>Known As</th>
                  </>
                ) : (
                  <>
                    <th>Assessment Name</th>
                    <th>Assessment Date</th>
                    <th>Grade</th>
                    <th>Score</th>
                    <th>Comment</th>
                  </>
                )}
                {fields.map((field) => (
                  <th key={field.id}>{field.field_label}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const draft = drafts[student.school_id] ?? makeEmptyDraft();

                return (
                  <tr key={student.school_id}>
                    <td>{student.full_name}</td>
                    {isPastoralPage ? (
                      <>
                        <td>{student.surname || "—"}</td>
                        <td>{student.first_name || "—"}</td>
                        <td>{student.preferred_name || "—"}</td>
                      </>
                    ) : (
                      <>
                        <td>{assessmentName || "Set above"}</td>
                        <td>{assessmentDate || "Set above"}</td>
                        <td>
                          <input
                            className="cell-input"
                            value={draft.grade}
                            onChange={(event) =>
                              updateDraft(student.school_id, "grade", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="cell-input"
                            value={draft.score}
                            onChange={(event) =>
                              updateDraft(student.school_id, "score", event.target.value)
                            }
                          />
                        </td>
                        <td>
                          <textarea
                            className="cell-textarea"
                            value={draft.comment}
                            onChange={(event) =>
                              updateDraft(student.school_id, "comment", event.target.value)
                            }
                          />
                        </td>
                      </>
                    )}
                    {fields.map((field) => (
                      <td key={field.id}>
                        {field.field_type === "long_text" ? (
                          <textarea
                            className="cell-textarea"
                            value={draft.fieldValues[field.field_key] ?? ""}
                            onChange={(event) =>
                              updateCustomField(student.school_id, field.field_key, event.target.value)
                            }
                          />
                        ) : (
                          <input
                            className="cell-input"
                            type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                            value={draft.fieldValues[field.field_key] ?? ""}
                            onChange={(event) =>
                              updateCustomField(student.school_id, field.field_key, event.target.value)
                            }
                          />
                        )}
                      </td>
                    ))}
                    <td>
                      <div className="table-actions">
                        <button className="button" type="button" onClick={() => void saveEntry(student)}>
                          Save
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => void deleteEntry(student)}
                        >
                          Erase
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!students.length && !isLoading ? (
            <div className="empty-state">
              No students match the current filters. Choose a different class or return to the
              filter page first.
            </div>
          ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
