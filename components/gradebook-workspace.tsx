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
};

type SubjectsResponse = {
  subjects: GradebookSubject[];
};

type DraftRow = {
  grade: string;
  score: string;
  comment: string;
  fieldValues: Record<string, string>;
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
    fieldValues: {}
  };
}

export function GradebookWorkspace({ initialFilters }: GradebookWorkspaceProps) {
  const [subjects, setSubjects] = useState<GradebookSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [assessmentName, setAssessmentName] = useState("");
  const [assessmentDate, setAssessmentDate] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [fields, setFields] = useState<GradebookFieldDefinition[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

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

        const nextDrafts: Record<string, DraftRow> = {};
        json.students.forEach((student) => {
          const existing = json.entries.find((entry) => entry.student_school_id === student.school_id);
          nextDrafts[student.school_id] = existing
            ? {
                grade: existing.grade ?? "",
                score: existing.score ?? "",
                comment: existing.comment ?? "",
                fieldValues: existing.field_values ?? {}
              }
            : makeEmptyDraft();
        });

        setStudents(json.students);
        setFields(json.fields);
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

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects]
  );

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
    if (!selectedSubjectId || !assessmentName || !assessmentDate) {
      setError("Select a subject and complete the assessment name and date before saving.");
      return;
    }

    const draft = drafts[student.school_id] ?? makeEmptyDraft();
    const response = await fetch("/api/gradebook/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentSchoolId: student.school_id,
        className: student.class_name,
        subjectId: selectedSubjectId,
        assessmentName,
        assessmentDate,
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
    if (!selectedSubjectId || !assessmentName || !assessmentDate) {
      setError("Select a subject and complete the assessment name and date before deleting.");
      return;
    }

    const response = await fetch("/api/gradebook/entries", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentSchoolId: student.school_id,
        subjectId: selectedSubjectId,
        assessmentName,
        assessmentDate
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Assessment Name</th>
                <th>Assessment Date</th>
                <th>Grade</th>
                <th>Score</th>
                <th>Comment</th>
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
                    <td>{assessmentName || "Set above"}</td>
                    <td>{assessmentDate || "Set above"}</td>
                    <td>
                      <input
                        className="cell-input"
                        value={draft.grade}
                        onChange={(event) => updateDraft(student.school_id, "grade", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        value={draft.score}
                        onChange={(event) => updateDraft(student.school_id, "score", event.target.value)}
                      />
                    </td>
                    <td>
                      <textarea
                        className="cell-textarea"
                        value={draft.comment}
                        onChange={(event) => updateDraft(student.school_id, "comment", event.target.value)}
                      />
                    </td>
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
      </section>
    </div>
  );
}
