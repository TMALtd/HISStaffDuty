"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  GradebookSubject,
  SpecialistRegister,
  SpecialistRegisterStudent,
  StudentRow
} from "@/lib/types";

type SpecialistRegisterManagerProps = {
  previewEmail?: string | null;
  initialYearGroup?: string | null;
  initialSubjectId?: string | null;
};

type SubjectsResponse = {
  subjects: GradebookSubject[];
};

type StudentsResponse = {
  students: StudentRow[];
};

type RegistersResponse = {
  registers: SpecialistRegister[];
};

type RegisterDetailResponse = {
  register: SpecialistRegister;
  students: SpecialistRegisterStudent[];
};

function buildApiPath(path: string, previewEmail?: string | null) {
  if (!previewEmail) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}viewAs=${encodeURIComponent(previewEmail)}`;
}

export function SpecialistRegisterManager({
  previewEmail = null,
  initialYearGroup = null,
  initialSubjectId = null
}: SpecialistRegisterManagerProps) {
  const [subjects, setSubjects] = useState<GradebookSubject[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [registers, setRegisters] = useState<SpecialistRegister[]>([]);
  const [selectedRegisterId, setSelectedRegisterId] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerDescription, setRegisterDescription] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjectId ?? "");
  const [selectedYearGroup, setSelectedYearGroup] = useState(initialYearGroup ?? "");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const yearGroupOptions = useMemo(
    () =>
      Array.from(new Set(allStudents.map((student) => student.year_group).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true })
      ),
    [allStudents]
  );

  const visibleStudents = useMemo(() => {
    const filtered = allStudents
      .filter((student) => !selectedYearGroup || student.year_group === selectedYearGroup)
      .sort(
        (left, right) =>
          left.full_name.localeCompare(right.full_name, undefined, { numeric: true }) ||
          left.class_name.localeCompare(right.class_name, undefined, { numeric: true })
      );

    if (!studentSearch.trim()) {
      return filtered;
    }

    const query = studentSearch.trim().toLowerCase();
    return filtered.filter((student) =>
      [
        student.full_name,
        student.preferred_name ?? "",
        student.class_name,
        student.school_id
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [allStudents, selectedYearGroup, studentSearch]);

  const selectedRegister = useMemo(
    () => registers.find((register) => register.id === selectedRegisterId) ?? null,
    [registers, selectedRegisterId]
  );

  const selectedYearGroupStudents = useMemo(
    () =>
      allStudents
        .filter((student) => !selectedYearGroup || student.year_group === selectedYearGroup)
        .sort(
          (left, right) =>
            left.class_name.localeCompare(right.class_name, undefined, { numeric: true }) ||
            left.full_name.localeCompare(right.full_name, undefined, { numeric: true })
        ),
    [allStudents, selectedYearGroup]
  );

  const selectedVisibleCount = useMemo(
    () => visibleStudents.filter((student) => selectedStudentIds.includes(student.school_id)).length,
    [selectedStudentIds, visibleStudents]
  );

  const yearGroupClassBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    selectedYearGroupStudents.forEach((student) => {
      const className = student.class_name || "Unassigned";
      counts.set(className, (counts.get(className) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([className, count]) => ({ className, count }))
      .sort(
        (left, right) =>
          right.count - left.count ||
          left.className.localeCompare(right.className, undefined, { numeric: true })
      );
  }, [selectedYearGroupStudents]);

  async function loadSubjects() {
    const response = await fetch(buildApiPath("/api/gradebook/subjects", previewEmail), {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error("Could not load specialist subjects.");
    }

    const json = (await response.json()) as SubjectsResponse;
    setSubjects(json.subjects);
    if (!selectedSubjectId && json.subjects[0]) {
      setSelectedSubjectId(json.subjects[0].id);
    }
  }

  async function loadStudents() {
    const response = await fetch(buildApiPath("/api/students", previewEmail), {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error("Could not load students for specialist registers.");
    }

    const json = (await response.json()) as StudentsResponse;
    setAllStudents(json.students);
    if (!selectedYearGroup) {
      const firstYearGroup = json.students.find((student) => student.year_group)?.year_group ?? "";
      if (firstYearGroup) {
        setSelectedYearGroup(firstYearGroup);
      }
    }
  }

  async function loadRegisters(subjectId = selectedSubjectId, yearGroup = selectedYearGroup) {
    const params = new URLSearchParams();
    if (subjectId) {
      params.set("subjectId", subjectId);
    }
    if (yearGroup) {
      params.set("yearGroup", yearGroup);
    }
    const query = params.toString();
    const response = await fetch(
      buildApiPath(`/api/gradebook/specialist-registers${query ? `?${query}` : ""}`, previewEmail),
      { cache: "no-store" }
    );
    if (!response.ok) {
      throw new Error("Could not load specialist registers.");
    }

    const json = (await response.json()) as RegistersResponse;
    setRegisters(json.registers);
  }

  async function loadRegisterDetail(registerId: string) {
    const response = await fetch(
      buildApiPath(`/api/gradebook/specialist-registers/${encodeURIComponent(registerId)}`, previewEmail),
      { cache: "no-store" }
    );
    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      throw new Error(json.error ?? "Could not load register details.");
    }

    const json = (await response.json()) as RegisterDetailResponse;
    setSelectedRegisterId(json.register.id);
    setRegisterName(json.register.name);
    setRegisterDescription(json.register.description ?? "");
    setSelectedSubjectId(json.register.subject_id);
    setSelectedYearGroup(json.register.year_group);
    setSelectedStudentIds(json.students.map((student) => student.student_school_id));
  }

  function resetEditor() {
    setSelectedRegisterId("");
    setRegisterName("");
    setRegisterDescription("");
    setSelectedStudentIds([]);
    setStudentSearch("");
    setStatus("");
    setError("");
  }

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadSubjects(), loadStudents()]);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load specialist register setup.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedSubjectId && !selectedYearGroup) {
      return;
    }

    void loadRegisters().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load specialist registers.");
    });
  }, [selectedSubjectId, selectedYearGroup]);

  function toggleStudent(studentSchoolId: string) {
    setSelectedStudentIds((current) =>
      current.includes(studentSchoolId)
        ? current.filter((studentId) => studentId !== studentSchoolId)
        : [...current, studentSchoolId]
    );
  }

  function selectVisibleStudents() {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      visibleStudents.forEach((student) => next.add(student.school_id));
      return Array.from(next);
    });
  }

  function clearVisibleStudents() {
    const visibleStudentIdSet = new Set(visibleStudents.map((student) => student.school_id));
    setSelectedStudentIds((current) => current.filter((studentId) => !visibleStudentIdSet.has(studentId)));
  }

  async function saveRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    setIsSaving(true);

    try {
      const payload = {
        subjectId: selectedSubjectId,
        yearGroup: selectedYearGroup,
        name: registerName,
        description: registerDescription || null,
        studentIds: selectedStudentIds
      };
      const path = selectedRegisterId
        ? `/api/gradebook/specialist-registers/${encodeURIComponent(selectedRegisterId)}`
        : "/api/gradebook/specialist-registers";
      const response = await fetch(buildApiPath(path, previewEmail), {
        method: selectedRegisterId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const json = (await response.json()) as {
        error?: string;
        register?: SpecialistRegister;
      };

      if (!response.ok) {
        throw new Error(json.error ?? "Could not save specialist register.");
      }

      await loadRegisters(payload.subjectId, payload.yearGroup);
      if (json.register) {
        await loadRegisterDetail(json.register.id);
      }
      setStatus(selectedRegisterId ? "Register updated." : "Register created.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save specialist register.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRegister() {
    if (!selectedRegisterId) {
      return;
    }

    setStatus("");
    setError("");
    setIsDeleting(true);

    try {
      const response = await fetch(
        buildApiPath(`/api/gradebook/specialist-registers/${encodeURIComponent(selectedRegisterId)}`, previewEmail),
        {
          method: "DELETE"
        }
      );

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Could not delete specialist register.");
      }

      resetEditor();
      await loadRegisters();
      setStatus("Register deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete specialist register.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="panel mi-card">
        <div>
          <p className="eyebrow">Specialist Markbook Registers</p>
          <h1 className="hero-title">Build your own year-group teaching registers</h1>
          <p className="compact-copy">
            Choose the subject you teach, open a year group, and save the exact student groups you want to use in the
            markbook later on.
          </p>
        </div>
        <div className="actions">
          <a className="button secondary" href={buildApiPath("/gradebook", previewEmail)}>
            Back to Markbook
          </a>
          <button className="button secondary" type="button" onClick={resetEditor}>
            New Register
          </button>
        </div>
        {status ? <div className="status-banner success">{status}</div> : null}
        {error ? <div className="status-banner error">{error}</div> : null}
      </section>

      <div className="mi-grid specialist-register-grid">
        <section className="mi-card">
          <h2 className="mi-title">Current Registers</h2>
          {!registers.length ? (
            <div className="empty-state compact">No specialist registers yet for this subject and year group.</div>
          ) : (
            <div className="breakdown-list">
              {registers.map((register) => (
                <button
                  key={register.id}
                  type="button"
                  className={`specialist-register-row${register.id === selectedRegisterId ? " active" : ""}`}
                  onClick={() => {
                    void loadRegisterDetail(register.id).catch((detailError) => {
                      setError(
                        detailError instanceof Error
                          ? detailError.message
                          : "Could not load specialist register details."
                      );
                    });
                  }}
                >
                  <span>
                    <strong>{register.name}</strong>
                    <span className="meta">{register.year_group}</span>
                  </span>
                  <strong>{register.student_count}</strong>
                </button>
              ))}
            </div>
          )}
        </section>

        <form className="mi-card" onSubmit={saveRegister}>
          <h2 className="mi-title">{selectedRegister ? "Edit Register" : "Create Register"}</h2>
          <div className="field">
            <label htmlFor="specialistSubject">Subject</label>
            <select
              id="specialistSubject"
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="specialistYearGroup">Year group</label>
            <select
              id="specialistYearGroup"
              value={selectedYearGroup}
              onChange={(event) => setSelectedYearGroup(event.target.value)}
            >
              <option value="">Select year group</option>
              {yearGroupOptions.map((yearGroup) => (
                <option key={yearGroup} value={yearGroup}>
                  {yearGroup}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="specialistRegisterName">Register name</label>
            <input
              id="specialistRegisterName"
              value={registerName}
              onChange={(event) => setRegisterName(event.target.value)}
              placeholder="Example: Year 3 Mandarin Group A"
            />
          </div>
          <div className="field">
            <label htmlFor="specialistRegisterDescription">Description</label>
            <input
              id="specialistRegisterDescription"
              value={registerDescription}
              onChange={(event) => setRegisterDescription(event.target.value)}
              placeholder="Optional notes about this teaching group"
            />
          </div>
          <div className="actions">
            <button className="button" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : selectedRegister ? "Save Register" : "Create Register"}
            </button>
            {selectedRegister ? (
              <button
                className="button secondary"
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  void deleteRegister();
                }}
              >
                {isDeleting ? "Deleting..." : "Delete Register"}
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <section className="panel mi-card">
        <div className="specialist-register-toolbar">
          <div>
            <h2 className="panel-title">Year-group Student Pool</h2>
            <p className="compact-copy">
              Build the exact register you need for this subject. Students stay tied to their year group, not to a
              homeroom class list.
            </p>
          </div>
          <div className="actions">
            <button className="button secondary" type="button" onClick={selectVisibleStudents}>
              Select Visible
            </button>
            <button className="button secondary" type="button" onClick={clearVisibleStudents}>
              Clear Visible
            </button>
          </div>
        </div>
        {selectedYearGroup ? (
          <div className="mini-stats specialist-pool-stats">
            <article className="stat-card">
              <p className="stat-label">Year group students</p>
              <p className="mini-value">{selectedYearGroupStudents.length}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Visible in filter</p>
              <p className="mini-value">{visibleStudents.length}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Selected now</p>
              <p className="mini-value">{selectedVisibleCount}</p>
            </article>
          </div>
        ) : null}
        {selectedYearGroup && yearGroupClassBreakdown.length > 0 ? (
          <div className="breakdown-list specialist-class-breakdown">
            {yearGroupClassBreakdown.map((entry) => (
              <div className="breakdown-row" key={`${selectedYearGroup}-${entry.className}`}>
                <span>{entry.className}</span>
                <strong>{entry.count}</strong>
              </div>
            ))}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="specialistStudentSearch">Search students</label>
          <input
            id="specialistStudentSearch"
            value={studentSearch}
            onChange={(event) => setStudentSearch(event.target.value)}
            placeholder="Search by name, class, or school ID"
          />
        </div>
        {!selectedYearGroup ? (
          <div className="empty-state compact">Choose a year group to load the available students.</div>
        ) : !visibleStudents.length ? (
          <div className="empty-state compact">No students are available for this year group.</div>
        ) : (
          <div className="specialist-student-grid">
            {visibleStudents.map((student) => {
              const isSelected = selectedStudentIds.includes(student.school_id);
              return (
                <label
                  key={student.school_id}
                  className={`specialist-student-card${isSelected ? " selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleStudent(student.school_id)}
                  />
                  <span>
                    <strong>{student.full_name}</strong>
                    <span className="meta">
                      {student.class_name} | {student.school_id}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
