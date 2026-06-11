"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TimetableClassSummary, TimetableTemplate } from "@/lib/types";

type TimetableAdminProps = {
  initialClasses: TimetableClassSummary[];
  templates: TimetableTemplate[];
  setupMessage?: string | null;
  canManageClasses?: boolean;
};

export function TimetableAdmin({
  initialClasses,
  templates,
  setupMessage,
  canManageClasses = false
}: TimetableAdminProps) {
  const router = useRouter();
  const [classes, setClasses] = useState(initialClasses);
  const [selectedClassCode, setSelectedClassCode] = useState(initialClasses[0]?.classCode ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(setupMessage ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingClassCode, setDeletingClassCode] = useState("");
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedClassCsvCode, setSelectedClassCsvCode] = useState(
    initialClasses.find((entry) => entry.hasTimetable)?.classCode ?? initialClasses[0]?.classCode ?? ""
  );
  const [selectedClassTimetableCsvFile, setSelectedClassTimetableCsvFile] = useState<File | null>(null);
  const [isDownloadingClassCsv, setIsDownloadingClassCsv] = useState(false);
  const [isImportingClassCsv, setIsImportingClassCsv] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassYearGroup, setNewClassYearGroup] = useState("Year 3");
  const [newClassCode, setNewClassCode] = useState("");
  const [newClassStreamType, setNewClassStreamType] = useState<"mainstream" | "bilingual">("mainstream");
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  useEffect(() => {
    setClasses(initialClasses);
    setSelectedClassCode((current) => {
      if (initialClasses.some((entry) => entry.classCode === current)) {
        return current;
      }

      return initialClasses[0]?.classCode ?? "";
    });
    setSelectedClassCsvCode((current) => {
      const nextOptions = initialClasses.filter((entry) => entry.hasTimetable);
      if (nextOptions.some((entry) => entry.classCode === current)) {
        return current;
      }

      return nextOptions[0]?.classCode ?? initialClasses[0]?.classCode ?? "";
    });
    setSelectedTemplateId((current) => {
      if (templates.some((template) => template.id === current)) {
        return current;
      }

      return templates[0]?.id ?? "";
    });
    setSearchTerm("");
    setStatus("");
    setError(setupMessage ?? "");
  }, [initialClasses, setupMessage, templates]);

  const visibleClasses = useMemo(
    () => (canManageClasses ? classes : classes.filter((entry) => entry.hasTimetable)),
    [canManageClasses, classes]
  );

  const filteredClasses = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) {
      return visibleClasses;
    }

    return visibleClasses.filter((entry) =>
      [entry.classCode, entry.className, entry.school, entry.designation, entry.yearGroup]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [searchTerm, visibleClasses]);

  const classCsvOptions = useMemo(
    () => classes.filter((entry) => entry.hasTimetable),
    [classes]
  );

  const yearGroupOptions = useMemo(
    () => Array.from(new Set(classes.map((entry) => entry.yearGroup))).sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
    [classes]
  );

  const selectedClassCsvSummary = classCsvOptions.find((entry) => entry.classCode === selectedClassCsvCode) ?? null;

  async function refreshClasses() {
    const response = await fetch("/api/timetables/classes", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not refresh timetable classes.");
    }

    const json = (await response.json()) as {
      classes: TimetableClassSummary[];
      templates?: TimetableTemplate[];
      setupMessage?: string | null;
    };

    setClasses(json.classes);
    if (json.setupMessage) {
      setError(json.setupMessage);
    }
  }

  async function createTimetable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!selectedClassCode || !selectedTemplateId) {
      setError("Choose both a class and a timetable template.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`/api/timetables/${encodeURIComponent(selectedClassCode)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          templateId: selectedTemplateId
        })
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Could not create timetable.");
      }

      const selectedClass = classes.find((entry) => entry.classCode === selectedClassCode);
      setStatus(`Timetable created for ${selectedClass?.className ?? selectedClassCode}.`);
      await refreshClasses();
      router.push(`/timetables/${encodeURIComponent(selectedClassCode)}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create timetable.");
    } finally {
      setIsCreating(false);
    }
  }

  async function createClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!newClassName.trim() || !newClassYearGroup.trim()) {
      setError("Add a class name and choose a year group.");
      return;
    }

    setIsCreatingClass(true);

    try {
      const response = await fetch("/api/timetables/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          classCode: newClassCode,
          className: newClassName,
          yearGroup: newClassYearGroup,
          streamType: newClassStreamType
        })
      });

      const json = (await response.json()) as {
        error?: string;
        classRecord?: { ["Class Code"]?: string; ["Class Name"]?: string };
      };

      if (!response.ok) {
        throw new Error(json.error ?? "Could not add timetable class.");
      }

      await refreshClasses();
      const createdClassCode = json.classRecord?.["Class Code"] ?? "";
      setSelectedClassCode(createdClassCode);
      setNewClassName("");
      setNewClassCode("");
      setStatus(`Added ${json.classRecord?.["Class Name"] ?? "new class"} to the timetable class list.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not add timetable class.");
    } finally {
      setIsCreatingClass(false);
    }
  }

  async function deleteTimetable(classCode: string, className: string) {
    setStatus("");
    setError("");
    setDeletingClassCode(classCode);

    try {
      const response = await fetch(`/api/timetables/${encodeURIComponent(classCode)}`, {
        method: "DELETE"
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Could not delete timetable.");
      }

      await refreshClasses();
      setStatus(`Timetable deleted for ${className}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete timetable.");
    } finally {
      setDeletingClassCode("");
    }
  }

  async function importSpecialistCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!selectedCsvFile) {
      setError("Choose a CSV file before importing.");
      return;
    }

    setIsImporting(true);

    try {
      const csvText = await selectedCsvFile.text();
      const response = await fetch("/api/timetables/import-specialist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ csvText })
      });

      const json = (await response.json()) as {
        error?: string;
        result?: {
          importedClassCount: number;
          assignmentCount: number;
          updatedBlockCount: number;
          classes: Array<{ className: string; updatedCount: number }>;
        };
      };

      if (!response.ok) {
        throw new Error(json.error ?? "Could not import specialist CSV.");
      }

      await refreshClasses();
      setSelectedCsvFile(null);
      setStatus(
        `Imported ${json.result?.updatedBlockCount ?? 0} specialist lessons across ${json.result?.importedClassCount ?? 0} timetables.`
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import specialist CSV.");
    } finally {
      setIsImporting(false);
    }
  }

  async function downloadClassCsvTemplate() {
    setStatus("");
    setError("");

    if (!selectedClassCsvCode) {
      setError("Choose a class timetable before downloading the CSV template.");
      return;
    }

    setIsDownloadingClassCsv(true);

    try {
      const response = await fetch(`/api/timetables/${encodeURIComponent(selectedClassCsvCode)}/class-csv`, {
        method: "GET"
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Could not download class timetable CSV.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const filename = filenameMatch?.[1] ?? "class-timetable-template.csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      setStatus(`Downloaded class CSV template for ${selectedClassCsvSummary?.className ?? selectedClassCsvCode}.`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download class timetable CSV.");
    } finally {
      setIsDownloadingClassCsv(false);
    }
  }

  async function importClassTimetableCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!selectedClassCsvCode) {
      setError("Choose a class timetable before uploading a class CSV.");
      return;
    }

    if (!selectedClassTimetableCsvFile) {
      setError("Choose a class timetable CSV before importing.");
      return;
    }

    setIsImportingClassCsv(true);

    try {
      const csvText = await selectedClassTimetableCsvFile.text();
      const response = await fetch(`/api/timetables/${encodeURIComponent(selectedClassCsvCode)}/class-csv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ csvText })
      });

      const json = (await response.json()) as {
        error?: string;
        result?: {
          className: string;
          updatedCount: number;
          processedRowCount: number;
          skippedCount: number;
          issues: Array<{ rowNumber: number; slot: string; reason: string }>;
        };
      };

      if (!response.ok) {
        throw new Error(json.error ?? "Could not import class timetable CSV.");
      }

      await refreshClasses();
      setSelectedClassTimetableCsvFile(null);
      const result = json.result;
      const classLabel = result?.className ?? selectedClassCsvSummary?.className ?? selectedClassCsvCode;
      const issuePreview =
        result?.issues?.length
          ? ` Issues: ${result.issues
              .slice(0, 3)
              .map((issue) => `row ${issue.rowNumber} (${issue.slot}) - ${issue.reason}`)
              .join("; ")}${result.issues.length > 3 ? `; plus ${result.issues.length - 3} more` : ""}`
          : "";
      setStatus(
        `Imported ${result?.updatedCount ?? 0} of ${result?.processedRowCount ?? 0} timetable rows for ${classLabel}. Skipped ${result?.skippedCount ?? 0}.${issuePreview}`
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import class timetable CSV.");
    } finally {
      setIsImportingClassCsv(false);
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="hero-card">
        <p className="eyebrow">{canManageClasses ? "Timetable administration" : "Timetable access"}</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">
              {canManageClasses ? "Build and manage class timetables" : "View class timetables"}
            </h1>
            <p className="hero-copy">
              {canManageClasses
                ? "Create one weekly timetable per class, attach it to a reusable period template, and then fill each block with lessons and teachers."
                : "Open the timetable cards you have access to and review the class schedules in a cleaner read-only view."}
            </p>
          </div>
          {canManageClasses ? (
            <Link className="button secondary" href="/admin/gradebook">
              Setup
            </Link>
          ) : null}
        </div>
      </section>

      {canManageClasses ? (
        <section className="panel">
        <div className="admin-grid">
          {canManageClasses ? (
            <form className="mi-card" onSubmit={createClass}>
              <h2 className="mi-title">Add timetable class</h2>
              <div className="field">
                <label htmlFor="newTimetableClassName">Class name</label>
                <input
                  id="newTimetableClassName"
                  type="text"
                  placeholder="e.g. 3 Teresa"
                  value={newClassName}
                  onChange={(event) => setNewClassName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="newTimetableYearGroup">Year group</label>
                <select
                  id="newTimetableYearGroup"
                  value={newClassYearGroup}
                  onChange={(event) => setNewClassYearGroup(event.target.value)}
                >
                  {yearGroupOptions.map((yearGroup) => (
                    <option key={yearGroup} value={yearGroup}>
                      {yearGroup}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="newTimetableStreamType">Stream type</label>
                <select
                  id="newTimetableStreamType"
                  value={newClassStreamType}
                  onChange={(event) =>
                    setNewClassStreamType(event.target.value === "bilingual" ? "bilingual" : "mainstream")
                  }
                >
                  <option value="mainstream">Mainstream</option>
                  <option value="bilingual">Bilingual</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="newTimetableClassCode">Class code (optional)</label>
                <input
                  id="newTimetableClassCode"
                  type="text"
                  placeholder="Auto-generated if left blank"
                  value={newClassCode}
                  onChange={(event) => setNewClassCode(event.target.value)}
                />
              </div>
              <div className="actions">
                <button className="button" type="submit" disabled={isCreatingClass}>
                  {isCreatingClass ? "Adding..." : "Add Class"}
                </button>
              </div>
            </form>
          ) : null}

          <form className="mi-card" onSubmit={createTimetable}>
            <h2 className="mi-title">Create class timetable</h2>
            <div className="field">
              <label htmlFor="timetableClassName">Class</label>
              <select
                id="timetableClassName"
                value={selectedClassCode}
                onChange={(event) => setSelectedClassCode(event.target.value)}
              >
                <option value="">Select class</option>
                {classes.map((entry) => (
                  <option key={entry.classCode} value={entry.classCode}>
                    {entry.className} | {entry.yearGroup}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="timetableTemplate">Template</label>
              <select
                id="timetableTemplate"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.year_group ? ` | ${template.year_group}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="actions">
              <button className="button" type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Timetable"}
              </button>
            </div>
          </form>

          <form className="mi-card" onSubmit={importSpecialistCsv}>
            <h2 className="mi-title">Bulk import specialist CSV</h2>
            <div className="field">
              <label htmlFor="specialistCsv">CSV file</label>
              <input
                id="specialistCsv"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setSelectedCsvFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <p className="hint">
              Use this for specialist overview CSV files. The importer matches lesson times and
              updates existing class timetables mentioned in the file.
            </p>
            <div className="actions">
              <button className="button" type="submit" disabled={isImporting}>
                {isImporting ? "Importing..." : "Import Specialist Lessons"}
              </button>
            </div>
          </form>

          <form className="mi-card" onSubmit={importClassTimetableCsv}>
            <h2 className="mi-title">Class timetable CSV</h2>
            <div className="field">
              <label htmlFor="classTimetableCsvClass">Class timetable</label>
              <select
                id="classTimetableCsvClass"
                value={selectedClassCsvCode}
                onChange={(event) => setSelectedClassCsvCode(event.target.value)}
              >
                <option value="">Select class timetable</option>
                {classCsvOptions.map((entry) => (
                  <option key={entry.classCode} value={entry.classCode}>
                    {entry.className} | {entry.yearGroup}
                  </option>
                ))}
              </select>
            </div>
            <div className="actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => void downloadClassCsvTemplate()}
                disabled={!selectedClassCsvCode || isDownloadingClassCsv}
              >
                {isDownloadingClassCsv ? "Downloading..." : "Download Class CSV Template"}
              </button>
            </div>
            <div className="field">
              <label htmlFor="classTimetableCsvUpload">Updated class CSV</label>
              <input
                id="classTimetableCsvUpload"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setSelectedClassTimetableCsvFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <p className="hint">
              Download the current class timetable first, update the lesson rows offline, then upload
              the same CSV back for that class. Teacher assignment is controlled by the
              <strong> Teacher IDs </strong>
              column, and specialist lessons already in the timetable are included in the template.
            </p>
            <div className="actions">
              <button className="button" type="submit" disabled={isImportingClassCsv}>
                {isImportingClassCsv ? "Importing..." : "Import Class Timetable CSV"}
              </button>
            </div>
          </form>
        </div>

        {status ? <div className="banner">{status}</div> : null}
        {error ? <div className="banner error-banner">{error}</div> : null}
        </section>
      ) : null}

      {canManageClasses ? (
        <section className="panel">
          <h2 className="panel-title">Template library</h2>
          <div className="breakdown-list">
            {templates.map((template) => (
              <div className="breakdown-row" key={template.id}>
                <span>
                  {template.name}
                  {template.year_group ? ` | ${template.year_group}` : ""}
                </span>
                <strong>{template.school ?? "All school"}</strong>
              </div>
            ))}
            {!templates.length ? (
              <div className="empty-state compact">
                No timetable templates are available yet. Add them in Supabase first.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2 className="panel-title">Current timetable coverage</h2>
            <p className="meta">Open a class to continue editing its weekly schedule.</p>
          </div>
          <div className="field timetable-search-field">
            <label htmlFor="timetableSearch">Search classes</label>
            <input
              id="timetableSearch"
              type="text"
              placeholder="Search by class, year group, or school..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="timetable-admin-grid">
          {filteredClasses.map((entry) => (
            <article className="timetable-admin-card" key={entry.classCode}>
              <div className="timetable-admin-card-copy">
                <p className="eyebrow compact-eyebrow">{entry.school}</p>
                <h3 className="timetable-admin-card-title">{entry.className}</h3>
                <p className="meta">
                  {entry.designation} | {entry.yearGroup}
                </p>
                <p className="meta">
                  {entry.hasTimetable ? `Template: ${entry.templateName ?? "Assigned"}` : "No timetable yet"}
                </p>
              </div>
              <div className="timetable-admin-card-actions">
                {entry.hasTimetable ? (
                  <>
                    <Link className="button" href={`/timetables/${encodeURIComponent(entry.classCode)}`}>
                      {canManageClasses ? "Open Builder" : "Open Timetable"}
                    </Link>
                    {canManageClasses ? (
                      <button
                        className="button secondary"
                        type="button"
                        disabled={deletingClassCode === entry.classCode}
                        onClick={() => void deleteTimetable(entry.classCode, entry.className)}
                      >
                        {deletingClassCode === entry.classCode ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
                  </>
                ) : canManageClasses ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setSelectedClassCode(entry.classCode);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Create Above
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {!filteredClasses.length ? (
            <div className="empty-state">No classes match the current search.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
