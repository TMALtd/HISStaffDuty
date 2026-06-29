"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GradebookFieldDefinition, GradebookSubject } from "@/lib/types";

type SubjectsResponse = {
  subjects: GradebookSubject[];
};

type FieldsResponse = {
  fields: GradebookFieldDefinition[];
};

export function GradebookAdmin() {
  const [subjects, setSubjects] = useState<GradebookSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [fields, setFields] = useState<GradebookFieldDefinition[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [subjectClassName, setSubjectClassName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<GradebookFieldDefinition["field_type"]>("text");
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
