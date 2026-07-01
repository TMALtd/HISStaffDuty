"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGradebookSectionDefinitions } from "@/lib/gradebook";
import type {
  GradebookFieldDefinition,
  GradebookSectionDefinition,
  GradebookSubject,
  GradebookTerm,
  PortalHeroSettings,
  StaffDirectoryClassOption,
  StudentAcademicYear
} from "@/lib/types";

type SubjectsResponse = {
  subjects: GradebookSubject[];
};

type FieldsResponse = {
  fields: GradebookFieldDefinition[];
};

type TermsResponse = {
  terms: GradebookTerm[];
};

type SectionsResponse = {
  sections: GradebookSectionDefinition[];
};

type PortalHeroSettingsResponse = {
  settings: PortalHeroSettings[];
};

type StudentRosterAdminResponse = {
  academicYears: StudentAcademicYear[];
  classOptions: StaffDirectoryClassOption[];
};

export function GradebookAdmin() {
  const [subjects, setSubjects] = useState<GradebookSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [fields, setFields] = useState<GradebookFieldDefinition[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [subjectClassName, setSubjectClassName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<GradebookFieldDefinition["field_type"]>("text");
  const [terms, setTerms] = useState<GradebookTerm[]>([]);
  const [sections, setSections] = useState<GradebookSectionDefinition[]>(getGradebookSectionDefinitions());
  const [portalHeroSettings, setPortalHeroSettings] = useState<PortalHeroSettings[]>([]);
  const [academicYears, setAcademicYears] = useState<StudentAcademicYear[]>([]);
  const [classOptions, setClassOptions] = useState<StaffDirectoryClassOption[]>([]);
  const [archiveYearLabel, setArchiveYearLabel] = useState("AY 2025/2026");
  const [newAcademicYearLabel, setNewAcademicYearLabel] = useState("AY 2026/2027");
  const [newAcademicYearStart, setNewAcademicYearStart] = useState("");
  const [newAcademicYearEnd, setNewAcademicYearEnd] = useState("");
  const [importAcademicYearLabel, setImportAcademicYearLabel] = useState("");
  const [importClassCode, setImportClassCode] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function loadStudentRosterAdmin() {
    const response = await fetch("/api/students/admin", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not load student roster setup.");
    }

    const json = (await response.json()) as StudentRosterAdminResponse;
    setAcademicYears(json.academicYears);
    setClassOptions(json.classOptions);
  }

  async function loadSubjects() {
    const response = await fetch("/api/gradebook/subjects", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not load gradebook subjects.");
    }

    const json = (await response.json()) as SubjectsResponse;
    setSubjects(json.subjects);
    if (!selectedSubjectId && json.subjects[0]) {
      setSelectedSubjectId(json.subjects[0].id);
    }
  }

  useEffect(() => {
    void loadSubjects().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load subjects.");
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/gradebook/terms", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load markbook terms.");
      }

      const json = (await response.json()) as TermsResponse;
      setTerms(json.terms);
    })().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load markbook terms.");
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/gradebook/sections", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load markbook section text.");
      }

      const json = (await response.json()) as SectionsResponse;
      setSections(json.sections);
    })().catch((loadError) => {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load markbook section text."
      );
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/portal/hero-settings", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load portal card text.");
      }

      const json = (await response.json()) as PortalHeroSettingsResponse;
      setPortalHeroSettings(json.settings);
    })().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load portal card text.");
    });
  }, []);

  useEffect(() => {
    void loadStudentRosterAdmin().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load student roster setup.");
    });
  }, []);

  useEffect(() => {
    if (!importAcademicYearLabel) {
      const activeYear = academicYears.find((year) => year.is_active) ?? academicYears[0] ?? null;
      if (activeYear) {
        setImportAcademicYearLabel(activeYear.label);
      }
    }
  }, [academicYears, importAcademicYearLabel]);

  useEffect(() => {
    if (!selectedSubjectId) {
      setFields([]);
      return;
    }

    void (async () => {
      const response = await fetch(`/api/gradebook/fields?subjectId=${selectedSubjectId}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Could not load custom fields.");
      }

      const json = (await response.json()) as FieldsResponse;
      setFields(json.fields);
    })().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load custom fields.");
    });
  }, [selectedSubjectId]);

  async function createSubject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/gradebook/subjects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: subjectName,
        className: subjectClassName || null
      })
    });

    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setError(json.error ?? "Could not create subject page.");
      return;
    }

    setStatus("Subject page created.");
    setSubjectName("");
    setSubjectClassName("");
    await loadSubjects();
  }

  async function createField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSubjectId) {
      setError("Choose a subject page before adding extra fields.");
      return;
    }

    const response = await fetch("/api/gradebook/fields", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subjectId: selectedSubjectId,
        fieldLabel,
        fieldType
      })
    });

    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setError(json.error ?? "Could not add custom field.");
      return;
    }

    setStatus("Custom field added.");
    setFieldLabel("");
    const fieldsResponse = await fetch(`/api/gradebook/fields?subjectId=${selectedSubjectId}`, {
      cache: "no-store"
    });
    const fieldsJson = (await fieldsResponse.json()) as FieldsResponse;
    setFields(fieldsJson.fields);
  }

  async function saveTerms(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/gradebook/terms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        terms: terms.map((term) => ({
          termKey: term.term_key,
          termLabel: term.term_label,
          startDate: term.start_date,
          endDate: term.end_date,
          sortOrder: term.sort_order
        }))
      })
    });

    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setError(json.error ?? "Could not save markbook terms.");
      return;
    }

    const json = (await response.json()) as TermsResponse;
    setTerms(json.terms);
    setStatus("Markbook terms updated.");
  }

  function updateTerm(termKey: string, field: "start_date" | "end_date", value: string) {
    setTerms((current) =>
      current.map((term) =>
        term.term_key === termKey
          ? {
              ...term,
              [field]: value || null
            }
          : term
      )
    );
  }

  function updateSection(
    slug: string,
    field: keyof Pick<
      GradebookSectionDefinition,
      "name" | "description" | "recommendedPageName" | "emptyStateTitle" | "emptyStateCopy"
    >,
    value: string
  ) {
    setSections((current) =>
      current.map((section) =>
        section.slug === slug
          ? {
              ...section,
              [field]: value
            }
          : section
      )
    );
  }

  function updatePortalHeroSetting(
    pageKey: PortalHeroSettings["pageKey"],
    field: keyof Pick<PortalHeroSettings, "label" | "eyebrow" | "title" | "description">,
    value: string
  ) {
    setPortalHeroSettings((current) =>
      current.map((setting) =>
        setting.pageKey === pageKey
          ? {
              ...setting,
              [field]: value
            }
          : setting
      )
    );
  }

  async function saveSections(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/gradebook/sections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sections: sections.map((section) => ({
          slug: section.slug,
          name: section.name,
          description: section.description,
          recommendedPageName: section.recommendedPageName,
          emptyStateTitle: section.emptyStateTitle,
          emptyStateCopy: section.emptyStateCopy
        }))
      })
    });

    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setError(json.error ?? "Could not save markbook section text.");
      return;
    }

    const json = (await response.json()) as SectionsResponse;
    setSections(json.sections);
    setStatus("Markbook card text updated.");
  }

  async function savePortalHeroSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/portal/hero-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        settings: portalHeroSettings
      })
    });

    if (!response.ok) {
      const json = (await response.json()) as { error?: string };
      setError(json.error ?? "Could not save portal card text.");
      return;
    }

    const json = (await response.json()) as PortalHeroSettingsResponse;
    setPortalHeroSettings(json.settings);
    setStatus("Portal card text updated.");
  }

  async function createAcademicYear(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/students/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "create-year",
        label: newAcademicYearLabel,
        startsOn: newAcademicYearStart || null,
        endsOn: newAcademicYearEnd || null,
        isActive: false,
        isArchived: false
      })
    });

    const json = (await response.json()) as { academicYears?: StudentAcademicYear[]; error?: string };
    if (!response.ok) {
      setError(json.error ?? "Could not create the academic year.");
      return;
    }

    setAcademicYears(json.academicYears ?? []);
    setImportAcademicYearLabel(newAcademicYearLabel);
    setStatus(`Academic year ${newAcademicYearLabel} is ready for imports.`);
  }

  async function activateAcademicYear(label: string) {
    setError("");

    const response = await fetch("/api/students/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "activate-year",
        label
      })
    });

    const json = (await response.json()) as { academicYears?: StudentAcademicYear[]; error?: string };
    if (!response.ok) {
      setError(json.error ?? "Could not activate that academic year.");
      return;
    }

    setAcademicYears(json.academicYears ?? []);
    setImportAcademicYearLabel(label);
    setStatus(`${label} is now the live student roster.`);
  }

  async function archiveCurrentRoster(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/students/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "archive-current",
        label: archiveYearLabel
      })
    });

    const json = (await response.json()) as { academicYears?: StudentAcademicYear[]; error?: string };
    if (!response.ok) {
      setError(json.error ?? "Could not archive the current roster.");
      return;
    }

    setAcademicYears(json.academicYears ?? []);
    setStatus(`Current live roster archived as ${archiveYearLabel}.`);
  }

  async function importClassRoster(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!importAcademicYearLabel) {
      setError("Choose an academic year before importing a class list.");
      return;
    }

    if (!importClassCode) {
      setError("Choose a class before importing a class list.");
      return;
    }

    if (!importFile) {
      setError("Choose a CSV file to import.");
      return;
    }

    const selectedClassOption =
      classOptions.find((option) => (option.classCode || option.className) === importClassCode) ?? null;

    if (!selectedClassOption) {
      setError("Choose a valid class before importing a class list.");
      return;
    }

    const csvText = await importFile.text();

    const response = await fetch("/api/students/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "import-class-csv",
        academicYearLabel: importAcademicYearLabel,
        classCode: selectedClassOption.classCode || null,
        className: selectedClassOption.className,
        csvText,
        sourceFilename: importFile.name
      })
    });

    const json = (await response.json()) as {
      academicYears?: StudentAcademicYear[];
      classOptions?: StaffDirectoryClassOption[];
      summary?: { className?: string; importedCount?: number; skippedCount?: number };
      error?: string;
    };

    if (!response.ok) {
      setError(json.error ?? "Could not import that class list.");
      return;
    }

    setAcademicYears(json.academicYears ?? []);
    setClassOptions(json.classOptions ?? []);
    setStatus(
      `${json.summary?.className ?? "Class"} imported into ${importAcademicYearLabel}: ${json.summary?.importedCount ?? 0} students added${json.summary?.skippedCount ? `, ${json.summary.skippedCount} skipped` : ""}.`
    );
  }

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">Markbook administration</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">Configure subject pages and bespoke fields</h1>
            <p className="hero-copy">
              Core markbook fields remain fixed. Use this page to add new subject pages and
              class-specific extra fields whenever a team needs them.
            </p>
          </div>
          <Link className="button secondary" href="/">
            Back to Filter View
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="admin-grid">
          <div className="mi-card">
            <h2 className="mi-title">Student academic years</h2>
            <p className="hero-copy compact-copy">
              Archive the current roster as AY 2025/2026, create AY 2026/2027, then import each
              class list against the correct class before you make that year live.
            </p>

            <form onSubmit={archiveCurrentRoster} style={{ marginBottom: "1.5rem" }}>
              <div className="field">
                <label htmlFor="archiveYearLabel">Archive current live roster as</label>
                <input
                  id="archiveYearLabel"
                  value={archiveYearLabel}
                  onChange={(event) => setArchiveYearLabel(event.target.value)}
                  placeholder="AY 2025/2026"
                />
              </div>
              <div className="actions">
                <button className="button secondary" type="submit">
                  Archive Current Roster
                </button>
              </div>
            </form>

            <form onSubmit={createAcademicYear} style={{ marginBottom: "1.5rem" }}>
              <div className="field">
                <label htmlFor="newAcademicYearLabel">New academic year</label>
                <input
                  id="newAcademicYearLabel"
                  value={newAcademicYearLabel}
                  onChange={(event) => setNewAcademicYearLabel(event.target.value)}
                  placeholder="AY 2026/2027"
                />
              </div>
              <div className="field">
                <label htmlFor="newAcademicYearStart">Start date</label>
                <input
                  id="newAcademicYearStart"
                  type="date"
                  value={newAcademicYearStart}
                  onChange={(event) => setNewAcademicYearStart(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="newAcademicYearEnd">End date</label>
                <input
                  id="newAcademicYearEnd"
                  type="date"
                  value={newAcademicYearEnd}
                  onChange={(event) => setNewAcademicYearEnd(event.target.value)}
                />
              </div>
              <div className="actions">
                <button className="button" type="submit">
                  Create Academic Year
                </button>
              </div>
            </form>

            <form onSubmit={importClassRoster}>
              <div className="field">
                <label htmlFor="importAcademicYearLabel">Import into academic year</label>
                <select
                  id="importAcademicYearLabel"
                  value={importAcademicYearLabel}
                  onChange={(event) => setImportAcademicYearLabel(event.target.value)}
                >
                  <option value="">Choose academic year</option>
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.label}>
                      {year.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="importClassCode">Class list</label>
                <select
                  id="importClassCode"
                  value={importClassCode}
                  onChange={(event) => setImportClassCode(event.target.value)}
                >
                  <option value="">Choose class</option>
                  {classOptions.map((option) => (
                    <option
                      key={option.classCode || option.className}
                      value={option.classCode || option.className}
                    >
                      {option.className} | {option.yearGroup}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="importRosterFile">CSV file</label>
                <input
                  id="importRosterFile"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <p className="hint">
                Upload one class at a time. The selected class decides where those students go in
                the live roster.
              </p>
              <div className="actions">
                <button className="button" type="submit">
                  Import Class CSV
                </button>
              </div>
            </form>

            <div className="breakdown-list" style={{ marginTop: "1.5rem" }}>
              {academicYears.length ? (
                academicYears.map((year) => (
                  <div className="breakdown-row" key={year.id} style={{ alignItems: "flex-start" }}>
                    <div>
                      <strong>{year.label}</strong>
                      <div className="hint">
                        {year.student_count} students | {year.class_count} classes
                        {year.starts_on || year.ends_on
                          ? ` | ${year.starts_on ?? "Start TBC"} to ${year.ends_on ?? "End TBC"}`
                          : ""}
                      </div>
                    </div>
                    <div className="actions" style={{ justifyContent: "flex-end" }}>
                      {year.is_active ? <span className="hint">Live year</span> : null}
                      {year.is_archived ? <span className="hint">Archived</span> : null}
                      {!year.is_active ? (
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => void activateAcademicYear(year.label)}
                        >
                          Make Live
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="hint">No academic years saved yet.</div>
              )}
            </div>
          </div>

          <form className="mi-card" onSubmit={saveTerms}>
            <h2 className="mi-title">School terms</h2>
            <p className="hero-copy compact-copy">
              Set the date range for each term so assignments can be grouped correctly in the Markbook.
            </p>
            <div className="banner" style={{ marginBottom: "1rem" }}>
              Update term dates here in the app, then return to the Markbook to assign assessments to Term 1, Term 2, or Term 3.
            </div>
            {terms.map((term) => (
              <div key={term.term_key} style={{ marginBottom: "1rem" }}>
                <strong style={{ display: "block", marginBottom: "0.5rem" }}>{term.term_label}</strong>
                <div className="field">
                  <label htmlFor={`${term.term_key}-start`}>Start date</label>
                  <input
                    id={`${term.term_key}-start`}
                    type="date"
                    value={term.start_date ?? ""}
                    onChange={(event) => updateTerm(term.term_key, "start_date", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${term.term_key}-end`}>End date</label>
                  <input
                    id={`${term.term_key}-end`}
                    type="date"
                    value={term.end_date ?? ""}
                    onChange={(event) => updateTerm(term.term_key, "end_date", event.target.value)}
                  />
                </div>
              </div>
            ))}
            <div className="actions">
              <button className="button" type="submit">
                Save Terms
              </button>
            </div>
          </form>

          <form className="mi-card" onSubmit={saveSections}>
            <h2 className="mi-title">Markbook card text</h2>
            <p className="hero-copy compact-copy">
              Update the section names, descriptions, and empty-state guidance shown on the class Markbook cards.
            </p>
            <div className="dashboard-grid" style={{ gap: "1rem" }}>
              {sections.map((section) => (
                <div key={section.slug} className="panel" style={{ padding: "1rem" }}>
                  <strong style={{ display: "block", marginBottom: "0.75rem" }}>{section.slug}</strong>
                  <div className="field">
                    <label htmlFor={`${section.slug}-name`}>Card title</label>
                    <input
                      id={`${section.slug}-name`}
                      value={section.name}
                      onChange={(event) => updateSection(section.slug, "name", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${section.slug}-description`}>Card description</label>
                    <input
                      id={`${section.slug}-description`}
                      value={section.description}
                      onChange={(event) => updateSection(section.slug, "description", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${section.slug}-recommended`}>Recommended page name</label>
                    <input
                      id={`${section.slug}-recommended`}
                      value={section.recommendedPageName}
                      onChange={(event) =>
                        updateSection(section.slug, "recommendedPageName", event.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${section.slug}-empty-title`}>Empty state title</label>
                    <input
                      id={`${section.slug}-empty-title`}
                      value={section.emptyStateTitle}
                      onChange={(event) =>
                        updateSection(section.slug, "emptyStateTitle", event.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${section.slug}-empty-copy`}>Empty state copy</label>
                    <input
                      id={`${section.slug}-empty-copy`}
                      value={section.emptyStateCopy}
                      onChange={(event) =>
                        updateSection(section.slug, "emptyStateCopy", event.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="actions">
              <button className="button" type="submit">
                Save Markbook Card Text
              </button>
            </div>
          </form>

          <form className="mi-card" onSubmit={savePortalHeroSettings}>
            <h2 className="mi-title">Portal card text</h2>
            <p className="hero-copy compact-copy">
              Update the main header cards shown on Student Filter, Markbook, and Timetables.
            </p>
            <div className="dashboard-grid" style={{ gap: "1rem" }}>
              {portalHeroSettings.map((setting) => (
                <div key={setting.pageKey} className="panel" style={{ padding: "1rem" }}>
                  <strong style={{ display: "block", marginBottom: "0.75rem" }}>{setting.label}</strong>
                  <div className="field">
                    <label htmlFor={`${setting.pageKey}-label`}>Internal label</label>
                    <input
                      id={`${setting.pageKey}-label`}
                      value={setting.label}
                      onChange={(event) =>
                        updatePortalHeroSetting(setting.pageKey, "label", event.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${setting.pageKey}-eyebrow`}>Eyebrow</label>
                    <input
                      id={`${setting.pageKey}-eyebrow`}
                      value={setting.eyebrow}
                      onChange={(event) =>
                        updatePortalHeroSetting(setting.pageKey, "eyebrow", event.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${setting.pageKey}-title`}>Title</label>
                    <input
                      id={`${setting.pageKey}-title`}
                      value={setting.title}
                      onChange={(event) =>
                        updatePortalHeroSetting(setting.pageKey, "title", event.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${setting.pageKey}-description`}>Description</label>
                    <textarea
                      id={`${setting.pageKey}-description`}
                      value={setting.description}
                      onChange={(event) =>
                        updatePortalHeroSetting(setting.pageKey, "description", event.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="actions">
              <button className="button" type="submit">
                Save Portal Card Text
              </button>
            </div>
          </form>

          <form className="mi-card" onSubmit={createSubject}>
            <h2 className="mi-title">Create subject page</h2>
            <div className="field">
              <label htmlFor="subjectName">Subject name</label>
              <input
                id="subjectName"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                placeholder="e.g. Reading Fluency"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="subjectClassName">Class name</label>
              <input
                id="subjectClassName"
                value={subjectClassName}
                onChange={(event) => setSubjectClassName(event.target.value)}
                placeholder="Leave blank for all classes"
              />
            </div>
            <div className="actions">
              <button className="button" type="submit">
                Add Subject Page
              </button>
            </div>
          </form>

          <form className="mi-card" onSubmit={createField}>
            <h2 className="mi-title">Add bespoke field</h2>
            <div className="field">
              <label htmlFor="adminSubject">Subject page</label>
              <select
                id="adminSubject"
                value={selectedSubjectId}
                onChange={(event) => setSelectedSubjectId(event.target.value)}
              >
                <option value="">Select subject page</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                    {subject.class_name ? ` (${subject.class_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fieldLabel">Field label</label>
              <input
                id="fieldLabel"
                value={fieldLabel}
                onChange={(event) => setFieldLabel(event.target.value)}
                placeholder="e.g. Target Band"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="fieldType">Field type</label>
              <select
                id="fieldType"
                value={fieldType}
                onChange={(event) =>
                  setFieldType(event.target.value as GradebookFieldDefinition["field_type"])
                }
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="long_text">Long text</option>
              </select>
            </div>
            <div className="actions">
              <button className="button" type="submit">
                Add Custom Field
              </button>
            </div>
          </form>
        </div>

        {status ? <div className="banner">{status}</div> : null}
        {error ? <div className="banner error-banner">{error}</div> : null}
      </section>

      <section className="panel">
        <h2 className="panel-title">Current subject pages</h2>
        <div className="breakdown-list">
          {subjects.map((subject) => (
            <div className="breakdown-row" key={subject.id}>
              <span>
                {subject.name}
                {subject.class_name ? ` | ${subject.class_name}` : " | All classes"}
              </span>
              <strong>{subject.is_core ? "Core" : "Custom"}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Extra fields for selected subject</h2>
        <div className="breakdown-list">
          {fields.map((field) => (
            <div className="breakdown-row" key={field.id}>
              <span>{field.field_label}</span>
              <strong>{field.field_type}</strong>
            </div>
          ))}
          {!fields.length ? (
            <div className="empty-state">
              No bespoke fields yet for this subject page. Core fields are still available on
              every gradebook page.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
