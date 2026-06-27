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
  StaffDirectoryClassOption,
  StudentRow
} from "@/lib/types";

type GradebookWorkspaceProps = {
  canManageAssignments: boolean;
  canManageSetup: boolean;
  initialFilters: FilterState;
  previewEmail?: string | null;
};

type EntriesResponse = {
  students: StudentRow[];
  classOptions: StaffDirectoryClassOption[];
  fields: GradebookFieldDefinition[];
  entries: GradebookEntry[];
  assessments?: Array<{
    assessment_name: string;
    assessment_date: string;
  }>;
  subject: GradebookSubject | null;
};

type SubjectsResponse = {
  subjects: GradebookSubject[];
};

type DraftRow = {
  grade: string;
  score: string;
  comment: string;
  fieldValues: Record<string, string>;
  assessmentName: string;
  assessmentDate: string;
};

type AssessmentColumn = {
  assessment_name: string;
  assessment_date: string;
};

function assessmentKey(assessmentName: string, assessmentDate: string) {
  return `${assessmentName}||${assessmentDate}`;
}

function formatClassOptionLabel(option: StaffDirectoryClassOption) {
  const streamLabel =
    option.streamType === "bilingual"
      ? "Bilingual"
      : option.streamType === "mainstream"
        ? "Mainstream"
        : null;

  return [option.className, option.yearGroup, streamLabel].filter(Boolean).join(" | ");
}

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

export function GradebookWorkspace({
  canManageAssignments,
  canManageSetup,
  initialFilters
  ,
  previewEmail
}: GradebookWorkspaceProps) {
  const [subjects, setSubjects] = useState<GradebookSubject[]>([]);
  const [selectedSectionSlug, setSelectedSectionSlug] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [newAssessmentName, setNewAssessmentName] = useState("");
  const [newAssessmentDate, setNewAssessmentDate] = useState("");
  const [assessments, setAssessments] = useState<AssessmentColumn[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classOptions, setClassOptions] = useState<StaffDirectoryClassOption[]>([]);
  const [classDrafts, setClassDrafts] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<GradebookFieldDefinition[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, Record<string, DraftRow>>>({});
  const [entryIndex, setEntryIndex] = useState<Record<string, Record<string, GradebookEntry>>>({});
  const [subjectMeta, setSubjectMeta] = useState<GradebookSubject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assignmentSavingId, setAssignmentSavingId] = useState("");
  const [isSavingAssessmentGrid, setIsSavingAssessmentGrid] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const sections = useMemo(() => buildGradebookWorkspaceSections(subjects), [subjects]);
  const selectedSection = useMemo(
    () => sections.find((section) => section.slug === selectedSectionSlug) ?? sections[0] ?? null,
    [sections, selectedSectionSlug]
  );
  const linkedSubject = selectedSection?.subject ?? null;
  const classOptionLookup = useMemo(
    () => new Map(classOptions.map((option) => [option.className, option])),
    [classOptions]
  );
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
    setNewAssessmentName("");
    setNewAssessmentDate("");
    setAssessments([]);
    setStudents([]);
    setClassOptions([]);
    setClassDrafts({});
    setFields([]);
    setDrafts({});
    setAssessmentDrafts({});
    setEntryIndex({});
    setSubjectMeta(null);
    setStatus("");
    setError("");
  }, [selectedSectionSlug]);

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      if (!selectedSection || !linkedSubject) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setStatus("");
      setError("");

      try {
        const params = new URLSearchParams(buildQueryString(initialFilters));
        params.set("subjectId", linkedSubject.id);
        if (previewEmail) {
          params.set("viewAs", previewEmail);
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
        setClassOptions(json.classOptions);
        const assessmentSet = new Map<string, AssessmentColumn>();

        (json.assessments ?? []).forEach((assessment) => {
          assessmentSet.set(
            assessmentKey(assessment.assessment_name, assessment.assessment_date),
            assessment
          );
        });

        json.entries.forEach((entry) => {
          assessmentSet.set(
            assessmentKey(entry.assessment_name, entry.assessment_date),
            {
              assessment_name: entry.assessment_name,
              assessment_date: entry.assessment_date
            }
          );
        });

        const nextAssessments = Array.from(assessmentSet.values()).sort(
          (left, right) =>
            left.assessment_date.localeCompare(right.assessment_date) ||
            left.assessment_name.localeCompare(right.assessment_name, undefined, { numeric: true })
        );
        setAssessments(nextAssessments);

        const nextDrafts: Record<string, DraftRow> = {};
        const nextClassDrafts: Record<string, string> = {};
        const nextAssessmentDrafts: Record<string, Record<string, DraftRow>> = {};
        const nextEntryIndex: Record<string, Record<string, GradebookEntry>> = {};
        json.students.forEach((student) => {
          const existing = json.entries.find((entry) => entry.student_school_id === student.school_id);
          nextClassDrafts[student.school_id] = student.class_name;
          const studentEntries = json.entries.filter(
            (entry) => entry.student_school_id === student.school_id
          );
          nextEntryIndex[student.school_id] = {};
          nextAssessmentDrafts[student.school_id] = {};

          nextAssessments.forEach((assessment) => {
            const key = assessmentKey(assessment.assessment_name, assessment.assessment_date);
            const matchingEntry = studentEntries.find(
              (entry) =>
                entry.assessment_name === assessment.assessment_name &&
                entry.assessment_date === assessment.assessment_date
            );

            if (matchingEntry) {
              nextEntryIndex[student.school_id][key] = matchingEntry;
            }

            nextAssessmentDrafts[student.school_id][key] = matchingEntry
              ? {
                  grade: matchingEntry.grade ?? "",
                  score: matchingEntry.score ?? "",
                  comment: matchingEntry.comment ?? "",
                  fieldValues: matchingEntry.field_values ?? {},
                  assessmentName: matchingEntry.assessment_name,
                  assessmentDate: matchingEntry.assessment_date
                }
              : {
                  ...makeEmptyDraft(),
                  assessmentName: assessment.assessment_name,
                  assessmentDate: assessment.assessment_date
                };
          });

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
        setClassDrafts(nextClassDrafts);
        setAssessmentDrafts(nextAssessmentDrafts);
        setEntryIndex(nextEntryIndex);
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
    initialFilters,
    linkedSubject,
    previewEmail,
    refreshToken,
    selectedSection,
    selectedStudentId
  ]);

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

  function updateClassDraft(studentId: string, className: string) {
    setClassDrafts((current) => ({
      ...current,
      [studentId]: className
    }));
  }

  function updateAssessmentDraft(
    studentId: string,
    columnKey: string,
    field: keyof DraftRow,
    value: string
  ) {
    setAssessmentDrafts((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] ?? {}),
        [columnKey]: {
          ...(current[studentId]?.[columnKey] ?? makeEmptyDraft()),
          [field]: value
        }
      }
    }));
  }

  function addAssessmentColumn() {
    if (!newAssessmentName || !newAssessmentDate) {
      setError("Add both an assessment name and date before creating a new assignment column.");
      return;
    }

    const nextColumn = {
      assessment_name: newAssessmentName.trim(),
      assessment_date: newAssessmentDate
    };
    const key = assessmentKey(nextColumn.assessment_name, nextColumn.assessment_date);

    if (assessments.some((assessment) => assessmentKey(assessment.assessment_name, assessment.assessment_date) === key)) {
      setError("This assignment column already exists.");
      return;
    }

    const nextAssessments = [...assessments, nextColumn].sort(
      (left, right) =>
        left.assessment_date.localeCompare(right.assessment_date) ||
        left.assessment_name.localeCompare(right.assessment_name, undefined, { numeric: true })
    );

    setAssessments(nextAssessments);
    setAssessmentDrafts((current) => {
      const next = { ...current };
      students.forEach((student) => {
        next[student.school_id] = {
          ...(next[student.school_id] ?? {}),
          [key]: {
            ...makeEmptyDraft(),
            assessmentName: nextColumn.assessment_name,
            assessmentDate: nextColumn.assessment_date
          }
        };
      });
      return next;
    });
    setNewAssessmentName("");
    setNewAssessmentDate("");
    setError("");
    setStatus(`Added ${nextColumn.assessment_name} as a new assignment column.`);
  }

  async function saveAssessmentSpreadsheet() {
    if (!linkedSubject) {
      setError("Choose a configured gradebook section before saving.");
      return;
    }

    setIsSavingAssessmentGrid(true);
    setError("");

    try {
      const upserts: Array<{
        studentSchoolId: string;
        className: string;
        subjectId: string;
        assessmentName: string;
        assessmentDate: string;
        grade: string;
        score: string;
        comment: string;
        fieldValues: Record<string, string>;
      }> = [];
      const deletions: Array<{
        studentSchoolId: string;
        subjectId: string;
        assessmentName: string;
        assessmentDate: string;
      }> = [];

      filteredStudents.forEach((student) => {
        assessments.forEach((assessment) => {
          const key = assessmentKey(assessment.assessment_name, assessment.assessment_date);
          const draft = assessmentDrafts[student.school_id]?.[key];
          if (!draft) {
            return;
          }

          const hasValue =
            Boolean(draft.grade.trim()) ||
            Boolean(draft.score.trim()) ||
            Boolean(draft.comment.trim()) ||
            Object.values(draft.fieldValues).some((value) => Boolean(value?.trim()));

          if (hasValue) {
            upserts.push({
              studentSchoolId: student.school_id,
              className: student.class_name,
              subjectId: linkedSubject.id,
              assessmentName: assessment.assessment_name,
              assessmentDate: assessment.assessment_date,
              grade: draft.grade,
              score: draft.score,
              comment: draft.comment,
              fieldValues: draft.fieldValues
            });
          } else if (entryIndex[student.school_id]?.[key]) {
            deletions.push({
              studentSchoolId: student.school_id,
              subjectId: linkedSubject.id,
              assessmentName: assessment.assessment_name,
              assessmentDate: assessment.assessment_date
            });
          }
        });
      });

      if (!upserts.length && !deletions.length) {
        setStatus("No assessment changes to save.");
        setIsSavingAssessmentGrid(false);
        return;
      }

      if (upserts.length) {
        const saveResponse = await fetch("/api/gradebook/entries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ entries: upserts })
        });

        if (!saveResponse.ok) {
          const json = (await saveResponse.json()) as { error?: string };
          throw new Error(json.error ?? "Could not save assessment spreadsheet.");
        }
      }

      if (deletions.length) {
        const deleteResponse = await fetch("/api/gradebook/entries", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ entries: deletions })
        });

        if (!deleteResponse.ok) {
          const json = (await deleteResponse.json()) as { error?: string };
          throw new Error(json.error ?? "Could not clear empty assessment cells.");
        }
      }

      setStatus(`Saved ${upserts.length} assessment value${upserts.length === 1 ? "" : "s"} across the sheet.`);
      setRefreshToken((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save assessment spreadsheet.");
    } finally {
      setIsSavingAssessmentGrid(false);
    }
  }

  async function saveStudentClassAssignment(student: StudentRow) {
    const nextClassName = classDrafts[student.school_id] ?? student.class_name;
    const selectedOption = classOptionLookup.get(nextClassName) ?? null;

    setAssignmentSavingId(student.school_id);
    setError("");

    try {
      const response = await fetch("/api/students", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          studentSchoolId: student.school_id,
          className: nextClassName,
          classCode: selectedOption?.classCode ?? null
        })
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Could not update class placement.");
      }

      setStatus(`Updated ${student.full_name} to ${nextClassName}.`);
      setError("");
      setSelectedStudentId(student.school_id);
      setAssignmentSavingId("");
      setRefreshToken((current) => current + 1);
    } catch (saveError) {
      setAssignmentSavingId("");
      setError(saveError instanceof Error ? saveError.message : "Could not update class placement.");
    }
  }

  async function saveEntry(student: StudentRow) {
    if (!selectedSection || !linkedSubject) {
      setError("Choose a configured gradebook section before saving.");
      return;
    }

    const draft = drafts[student.school_id] ?? makeEmptyDraft();
    const effectiveAssessmentName =
      selectedSection.mode === "profile"
        ? `${selectedSection.name} Profile`
        : draft.assessmentName;
    const effectiveAssessmentDate =
      selectedSection.mode === "profile"
        ? "2000-01-01"
        : draft.assessmentDate;

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

    const response = await fetch("/api/gradebook/entries", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentSchoolId: student.school_id,
        subjectId: linkedSubject.id,
        assessmentName:
          selectedSection.mode === "profile" ? `${selectedSection.name} Profile` : drafts[student.school_id]?.assessmentName ?? "",
        assessmentDate: selectedSection.mode === "profile" ? "2000-01-01" : drafts[student.school_id]?.assessmentDate ?? ""
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

  function renderClassAssignmentControls(student: StudentRow) {
    if (!canManageAssignments || !classOptions.length) {
      return null;
    }

    return (
      <div className="student-assignment-grid">
        <div className="field">
          <label htmlFor={`studentClass-${student.school_id}`}>Assigned class</label>
          <select
            id={`studentClass-${student.school_id}`}
            value={classDrafts[student.school_id] ?? student.class_name}
            onChange={(event) => updateClassDraft(student.school_id, event.target.value)}
          >
            {classOptions.map((option) => (
              <option key={`${option.classCode}-${option.className}`} value={option.className}>
                {formatClassOptionLabel(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="identity-chip">
          <span>Assigned teacher</span>
          <strong>{student.assigned_teacher_name || "No linked homeroom teacher yet"}</strong>
        </div>
        <div className="identity-chip">
          <span>Assignment source</span>
          <strong>{student.class_assignment_source === "override" ? "Manual override" : "Roster"}</strong>
        </div>
        <div className="actions">
          <button
            className="button"
            type="button"
            onClick={() => void saveStudentClassAssignment(student)}
            disabled={assignmentSavingId === student.school_id}
          >
            {assignmentSavingId === student.school_id ? "Saving..." : "Update Class Placement"}
          </button>
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
              {renderClassAssignmentControls(student)}

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

  function renderAssessmentSpreadsheet() {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              {assessments.map((assessment) => (
                <th key={assessmentKey(assessment.assessment_name, assessment.assessment_date)}>
                  <div className="gradebook-assessment-column-title">{assessment.assessment_name}</div>
                  <div className="gradebook-assessment-column-date">{assessment.assessment_date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => {
              return (
                <tr key={student.school_id}>
                  <td>
                    <div className="gradebook-student-name">{student.full_name}</div>
                    <div className="gradebook-student-meta">
                      {student.class_name}
                      {student.assigned_teacher_name ? ` | ${student.assigned_teacher_name}` : ""}
                    </div>
                  </td>
                  {assessments.map((assessment) => {
                    const key = assessmentKey(assessment.assessment_name, assessment.assessment_date);
                    const draft = assessmentDrafts[student.school_id]?.[key] ?? {
                      ...makeEmptyDraft(),
                      assessmentName: assessment.assessment_name,
                      assessmentDate: assessment.assessment_date
                    };

                    return (
                      <td key={`${student.school_id}-${key}`}>
                        <div className="gradebook-assessment-cell">
                          <input
                            className="cell-input"
                            placeholder="Score"
                            value={draft.score}
                            onChange={(event) =>
                              updateAssessmentDraft(student.school_id, key, "score", event.target.value)
                            }
                          />
                          <input
                            className="cell-input"
                            placeholder="Grade"
                            value={draft.grade}
                            onChange={(event) =>
                              updateAssessmentDraft(student.school_id, key, "grade", event.target.value)
                            }
                          />
                        </div>
                      </td>
                    );
                  })}
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
          {canManageSetup ? (
            <Link className="button" href="/admin/gradebook">
              Open Gradebook Setup
            </Link>
          ) : null}
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
            {canManageSetup ? (
              <Link className="button" href="/admin/gradebook">
                Gradebook Setup
              </Link>
            ) : null}
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
                <label htmlFor="assessmentName">New assignment name</label>
                <input
                  id="assessmentName"
                  value={newAssessmentName}
                  onChange={(event) => setNewAssessmentName(event.target.value)}
                  placeholder="e.g. Term 1 Numbers within 10"
                  disabled={!linkedSubject}
                />
              </div>
              <div className="field">
                <label htmlFor="assessmentDate">New assignment date</label>
                <input
                  id="assessmentDate"
                  type="date"
                  value={newAssessmentDate}
                  onChange={(event) => setNewAssessmentDate(event.target.value)}
                  disabled={!linkedSubject}
                />
              </div>
              <div className="field">
                <label>Assessment sheet</label>
                <div className="actions" style={{ marginTop: 0 }}>
                  <button className="button secondary" type="button" onClick={addAssessmentColumn}>
                    Add Assignment Column
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => void saveAssessmentSpreadsheet()}
                    disabled={isSavingAssessmentGrid}
                  >
                    {isSavingAssessmentGrid ? "Saving Sheet..." : "Save Assessment Sheet"}
                  </button>
                </div>
                <div className="hint">
                  {assessments.length
                    ? `${assessments.length} assignment column${assessments.length === 1 ? "" : "s"} loaded.`
                    : "No assignment columns yet. Add the first one above."}
                </div>
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
              {renderAssessmentSpreadsheet()}
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
