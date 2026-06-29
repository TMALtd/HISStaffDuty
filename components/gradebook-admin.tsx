"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGradebookSectionDefinitions } from "@/lib/gradebook";
import type {
  GradebookFieldDefinition,
  GradebookSectionDefinition,
  GradebookSubject,
  GradebookTerm
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
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

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
