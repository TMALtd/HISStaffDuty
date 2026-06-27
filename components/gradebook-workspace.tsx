"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildGradebookWorkspaceSections } from "@/lib/gradebook";
import type {
  GradebookEntry,
  GradebookFieldDefinition,
  GradebookSubject,
  GradebookWorkspaceSection,
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

function orderFields(section: GradebookWorkspaceSection, fields: GradebookFieldDefinition[]) {
  if (!section.fieldOrder?.length) {
    return fields;
  }

  return [...fields]
    .filter((field) => section.fieldOrder?.includes(field.field_key))
    .sort(
      (left, right) =>
        (section.fieldOrder?.indexOf(left.field_key) ?? 0) -
        (section.fieldOrder?.indexOf(right.field_key) ?? 0)
    );
}

export function GradebookWorkspace({ initialFilters }: GradebookWorkspaceProps) {
  const [subjects, setSubjects] = useState<GradebookSubject[]>([]);
  const [selectedSectionSlug, setSelectedSectionSlug] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
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

  const sections = useMemo(() => buildGradebookWorkspaceSections(subjects), [subjects]);
  const selectedSection = useMemo(
    () => sections.find((section) => section.slug === selectedSectionSlug) ?? sections[0] ?? null,
    [sections, selectedSectionSlug]
  );
  const linkedSubject = selectedSection?.subject ?? null;
  const filteredStudents = useMemo(
    () =>
      selectedStudentId
        ? students.filter((student) => student.school_id === selectedStudentId)
        : students,
    [selectedStudentId, students]
  );

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
        throw new Error("Could not load gradebook sections.");
      }

      const json = (await response.json()) as SubjectsResponse;

      if (!isMounted) {
        return;
      }

      setSubjects(json.subjects);
      setSelectedSectionSlug((current) => {
        if (current && sections.some((section) => section.slug === current)) {
          return current;
        }

        const workspaceSections = buildGradebookWorkspaceSections(json.subjects);
        return workspaceSections.find((section) => section.isConfigured)?.slug ?? workspaceSections[0]?.slug ?? "";
      });
    }

    void loadSubjects().catch((loadError) => {
      if (isMounted) {
        setError(loadError instanceof Error ? loadError.message : "Could not load gradebook sections.");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [initialFilters.className]);

  useEffect(() => {
    setSelectedStudentId("");
    setAssessmentName("");
    setAssessmentDate("");
    setAssessments([]);
    setStudents([]);
    setFields([]);
    setDrafts({});
    setSubjectMeta(null);
    setStatus("");
    setError("");
  }, [selectedSectionSlug]);

  useEffect(() => {
    let isMounted = true;

    async function loadAssessments() {
      if (!selectedSection || selectedSection.mode !== "assessment" || !linkedSubject) {
        setAssessments([]);
        return;
      }

      const params = new URLSearchParams({ subjectId: linkedSubject.id });
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
  }, [assessmentDate, assessmentName, initialFilters.className, linkedSubject, selectedSection]);

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      if (!selectedSection || !linkedSubject) {
        setIsLoading(false);
        return;
      }

      if (
        selectedSection.mode === "assessment" &&
        (!assessmentName || !assessmentDate) &&
        assessments.length > 0
      ) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setStatus("");
      setError("");

      try {
        const params = new URLSearchParams(buildQueryString(initialFilters));
        params.set("subjectId", linkedSubject.id);

        if (selectedSection.mode === "assessment") {
          if (assessmentName) {
            params.set("assessmentName", assessmentName);
          }
          if (assessmentDate) {
            params.set("assessmentDate", assessmentDate);
          }
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
        if (selectedStudentId && !json.students.some((student) => student.school_id === selectedStudentId)) {
          setSelectedStudentId("");
        }
        setFields(orderFields(selectedSection, json.fields));
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
  }, [
    assessmentDate,
    assessmentName,
    assessments.length,
    initialFilters,
    linkedSubject,
    selectedSection,
    selectedStudentId
  ]);

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
    if (!selectedSection || !linkedSubject) {
      setError("Choose a configured gradebook section before saving.");
      return;
    }

    if (selectedSection.mode === "assessment" && (!assessmentName || !assessmentDate)) {
      setError("Select an assessment name and date before saving.");
      return;
    }

    const draft = drafts[student.school_id] ?? makeEmptyDraft();
    const effectiveAssessmentName =
      selectedSection.mode === "profile"
        ? `${selectedSection.name} Profile`
        : assessmentName;
    const effectiveAssessmentDate =
      selectedSection.mode === "profile"
        ? "2000-01-01"
        : assessmentDate;

    const response = await fetch("/api/gradebook/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentSchoolId: student.school_id,
        className: student.class_name,
        subjectId: linkedSubject.id,
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
    if (!selectedSection || !linkedSubject) {
      setError("Choose a configured gradebook section before deleting.");
      return;
    }

    if (selectedSection.mode === "assessment" && (!assessmentName || !assessmentDate)) {
      setError("Select an assessment name and date before deleting.");
      return;
    }

    const response = await fetch("/api/gradebook/entries", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentSchoolId: student.school_id,
        subjectId: linkedSubject.id,
        assessmentName:
          selectedSection.mode === "profile" ? `${selectedSection.name} Profile` : assessmentName,
        assessmentDate: selectedSection.mode === "profile" ? "2000-01-01" : assessmentDate
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

  function renderSectionCards() {
    return (
      <div className="gradebook-section-grid">
        {sections.map((section) => (
          <button
            className={`gradebook-section-card${section.slug === selectedSection?.slug ? " active" : ""}`}
            key={section.slug}
            type="button"
            onClick={() => setSelectedSectionSlug(section.slug)}
          >
            <div className="gradebook-section-card-top">
              <p className="eyebrow compact-eyebrow">
                {section.mode === "profile" ? "Student Profile" : "Assessment"}
              </p>
              <span className={`gradebook-section-status ${section.isConfigured ? "ready" : "pending"}`}>
                {section.isConfigured ? "Ready" : "To build"}
              </span>
            </div>
            <h3 className="gradebook-section-name">{section.name}</h3>
            <p className="gradebook-section-copy">{section.description}</p>
          </button>
        ))}
      </div>
    );
  }

  function renderIdentityChips(student: StudentRow) {
    return (
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
    );
  }

  function renderProfileCards() {
    return (
      <div className="pastoral-grid">
        {filteredStudents.map((student) => {
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

              {renderIdentityChips(student)}

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

  function renderAssessmentTable() {
    return (
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
            {filteredStudents.map((student) => {
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
      </div>
    );
  }

  function renderSectionEmptyState() {
    if (!selectedSection) {
      return null;
    }

    return (
      <section className="panel">
        <h2 className="panel-title">{selectedSection.emptyStateTitle}</h2>
        <p className="hero-copy compact-copy">{selectedSection.emptyStateCopy}</p>
        <div className="actions">
          <Link className="button" href="/admin/gradebook">
            Open Gradebook Setup
          </Link>
          <span className="hint">
            Recommended page name: {selectedSection.recommendedPageName}
          </span>
        </div>
      </section>
    );
  }

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Gradebook workspace</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">Build the class markbook around real teaching sections</h1>
            <p className="hero-copy">
              This new workspace is organised the same way your class markbook works in practice:
              student profiles, parent meeting notes, and subject assessment areas such as
              Phonics, Reading, Writing, Maths, and IPC.
            </p>
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <Link
              className="button secondary"
              href={`/${buildQueryString(initialFilters) ? `?${buildQueryString(initialFilters)}` : ""}`}
            >
              Back to Filter View
            </Link>
            <Link className="button" href="/admin/gradebook">
              Gradebook Setup
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow compact-eyebrow">Class Markbook</p>
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              {initialFilters.className || "Whole-school gradebook"}
            </h2>
          </div>
          <span className="hint">
            {sections.filter((section) => section.isConfigured).length} of {sections.length} sections configured
          </span>
        </div>
        {renderSectionCards()}
      </section>

      <section className="panel">
        <div className="filters-grid">
          <div className="field">
            <label htmlFor="gradebookSection">Section</label>
            <select
              id="gradebookSection"
              value={selectedSection?.slug ?? ""}
              onChange={(event) => setSelectedSectionSlug(event.target.value)}
            >
              {sections.map((section) => (
                <option key={section.slug} value={section.slug}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="studentFilter">Student filter</label>
            <select
              id="studentFilter"
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              disabled={!linkedSubject}
            >
              <option value="">Whole class</option>
              {students.map((student) => (
                <option key={student.school_id} value={student.school_id}>
                  {student.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Section status</label>
            <div className="hint">
              {selectedSection?.isConfigured
                ? `Linked to ${subjectMeta?.name ?? linkedSubject?.name ?? selectedSection.name}`
                : "This section still needs a matching gradebook page in setup."}
            </div>
          </div>
          {selectedSection?.mode === "assessment" ? (
            <>
              <div className="field">
                <label htmlFor="existingAssessment">Existing assessment</label>
                <select
                  id="existingAssessment"
                  value={
                    assessmentName && assessmentDate ? `${assessmentName}||${assessmentDate}` : ""
                  }
                  onChange={(event) => handleAssessmentSelection(event.target.value)}
                  disabled={!linkedSubject}
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
                  placeholder="e.g. Term 1 Numbers within 10"
                  disabled={!linkedSubject}
                />
              </div>
              <div className="field">
                <label htmlFor="assessmentDate">Assessment date</label>
                <input
                  id="assessmentDate"
                  type="date"
                  value={assessmentDate}
                  onChange={(event) => setAssessmentDate(event.target.value)}
                  disabled={!linkedSubject}
                />
              </div>
            </>
          ) : null}
        </div>
        <div className="actions">
          <span className="hint">
            Active class filter: {initialFilters.className || "All classes"}
            {selectedSection ? ` | Section: ${selectedSection.name}` : ""}
            {selectedStudentId
              ? ` | Student: ${
                  students.find((student) => student.school_id === selectedStudentId)?.full_name ??
                  "Selected"
                }`
              : " | Student: Whole class"}
          </span>
        </div>
        {status ? <div className="banner">{status}</div> : null}
        {error ? <div className="banner error-banner">{error}</div> : null}
      </section>

      {!linkedSubject ? (
        renderSectionEmptyState()
      ) : (
        <section className="table-shell">
          {selectedSection?.mode === "profile" ? (
            <div className="pastoral-shell">
              {renderProfileCards()}
              {!students.length && !isLoading ? (
                <div className="empty-state">
                  No students match the current filters. Choose a different class or return to the
                  filter page first.
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {renderAssessmentTable()}
              {!students.length && !isLoading ? (
                <div className="empty-state">
                  No students match the current filters. Choose a different class or return to the
                  filter page first.
                </div>
              ) : null}
            </>
          )}
        </section>
      )}
    </div>
  );
}
