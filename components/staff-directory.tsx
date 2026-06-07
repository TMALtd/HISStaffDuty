"use client";

import { useEffect, useMemo, useState, type ImgHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import type {
  StaffDirectoryClassOption,
  StaffDirectoryRecord,
  StaffDirectoryUpsertInput
} from "@/lib/types";

type StaffDirectoryProps = {
  staff: StaffDirectoryRecord[];
  classOptions: StaffDirectoryClassOption[];
};

type ModalMode = "view" | "edit" | "create";

const EMPTY_FORM: StaffDirectoryUpsertInput = {
  staff_id: "",
  name: "",
  first_name: "",
  role: "",
  email: "",
  department: "",
  class: "",
  extension: "",
  max_duties: null,
  status: "",
  unavailable_reason: "",
  timetable: "",
  photo_url: "",
  designation: "",
  system_role: ""
};

function uniqueValues(items: Array<string | null | undefined>) {
  return Array.from(new Set(items.map((item) => (item ?? "").trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true })
  );
}

function formatDutyLabel(duty: StaffDirectoryRecord["assigned_duties"][number]) {
  return `${duty.dayLabel} / ${duty.name} (${duty.timeLabel})`;
}

function toFormValues(record: StaffDirectoryRecord): StaffDirectoryUpsertInput {
  return {
    id: record.id,
    staff_id: record.staff_id ?? "",
    name: record.name,
    first_name: record.first_name ?? "",
    role: record.role ?? "",
    email: record.email ?? "",
    department: record.department ?? "",
    class: record.class ?? "",
    extension: record.extension ?? "",
    max_duties: record.max_duties,
    status: record.status ?? "",
    unavailable_reason: record.unavailable_reason ?? "",
    timetable: record.timetable ?? "",
    photo_url: record.photo_url ?? "",
    designation: record.designation ?? "",
    system_role: record.system_role ?? ""
  };
}

function classOptionLabel(option: StaffDirectoryClassOption) {
  const stream = option.streamType
    ? option.streamType.charAt(0).toUpperCase() + option.streamType.slice(1)
    : null;

  return [option.className, option.yearGroup, stream].filter(Boolean).join(" | ");
}

function resolvePhotoUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) {
    return null;
  }

  const trimmed = photoUrl.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return encodeURI(trimmed);
  }

  return encodeURI(`/${trimmed}`);
}

function cleanPhotoToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const withoutExtension = value.replace(/\.[a-z0-9]+$/i, "");
  const withoutTimestamp = withoutExtension.replace(/_\d+$/i, "");
  const alphanumericOnly = withoutTimestamp.replace(/[^a-z0-9]+/gi, "");

  return alphanumericOnly || null;
}

function buildPhotoCandidates(
  photoUrl: string | null | undefined,
  staffName: string,
  firstName?: string | null
) {
  const directUrl = resolvePhotoUrl(photoUrl);
  const candidates = new Set<string>();

  if (directUrl) {
    candidates.add(directUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");

  if (!supabaseUrl) {
    return Array.from(candidates);
  }

  const storageBase = `${supabaseUrl}/storage/v1/object/public/staff-photos`;
  const fileName = photoUrl?.split("/").pop() ?? "";
  const fileExtensionMatch = fileName.match(/\.([a-z0-9]+)$/i);
  const existingExtension = fileExtensionMatch ? fileExtensionMatch[1].toLowerCase() : null;

  const baseNames = [
    cleanPhotoToken(fileName),
    cleanPhotoToken(staffName),
    cleanPhotoToken(firstName)
  ].filter((value): value is string => Boolean(value));

  const extensions = Array.from(
    new Set([existingExtension, "png", "jpg", "jpeg", "webp"].filter((value): value is string => Boolean(value)))
  );

  for (const baseName of baseNames) {
    for (const extension of extensions) {
      candidates.add(encodeURI(`${storageBase}/${baseName}.${extension}`));
    }
  }

  return Array.from(candidates);
}

type StaffAvatarProps = {
  photoUrl: string | null | undefined;
  staffName: string;
  firstName?: string | null;
  alt: string;
  fallback: string;
  className?: string;
  imageClassName?: string;
  imgProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "className">;
};

function StaffAvatar({
  photoUrl,
  staffName,
  firstName,
  alt,
  fallback,
  className = "",
  imageClassName = "",
  imgProps
}: StaffAvatarProps) {
  const photoCandidates = useMemo(
    () => buildPhotoCandidates(photoUrl, staffName, firstName),
    [firstName, photoUrl, staffName]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [photoCandidates]);

  const resolvedPhotoUrl = photoCandidates[candidateIndex] ?? null;
  const showImage = Boolean(resolvedPhotoUrl);

  function handleImageError() {
    setCandidateIndex((current) => {
      if (current >= photoCandidates.length - 1) {
        return current;
      }

      return current + 1;
    });
  }

  return (
    <div className={className}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedPhotoUrl ?? undefined}
          alt={alt}
          className={imageClassName}
          onError={handleImageError}
          {...imgProps}
        />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}

export function StaffDirectory({ staff, classOptions }: StaffDirectoryProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [formValues, setFormValues] = useState<StaffDirectoryUpsertInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const departmentOptions = useMemo(
    () => uniqueValues(staff.map((person) => person.department)),
    [staff]
  );

  const filteredStaff = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return staff.filter((person) => {
      const matchesSearch =
        !search ||
        [
          person.name,
          person.first_name,
          person.role,
          person.email,
          person.class,
          person.staff_id
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      const matchesDepartment =
        !departmentFilter || (person.department ?? "").trim() === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [departmentFilter, searchTerm, staff]);

  const selectedStaff =
    filteredStaff.find((person) => person.id === selectedStaffId) ??
    staff.find((person) => person.id === selectedStaffId) ??
    null;

  function actionStateClass(personId: string, mode: Exclude<ModalMode, "create">) {
    return selectedStaffId === personId && modalMode === mode ? " active" : "";
  }

  function closeModal() {
    setSelectedStaffId(null);
    setModalMode(null);
    setFormValues(EMPTY_FORM);
    setFormError(null);
    setIsSaving(false);
  }

  function openCreateModal() {
    setSelectedStaffId(null);
    setModalMode("create");
    setFormValues(EMPTY_FORM);
    setFormError(null);
  }

  function openViewModal(staffMember: StaffDirectoryRecord) {
    setSelectedStaffId(staffMember.id);
    setModalMode("view");
    setFormValues(toFormValues(staffMember));
    setFormError(null);
  }

  function openEditModal(staffMember: StaffDirectoryRecord) {
    setSelectedStaffId(staffMember.id);
    setModalMode("edit");
    setFormValues(toFormValues(staffMember));
    setFormError(null);
  }

  async function handleSave() {
    setFormError(null);

    if (!String(formValues.name ?? "").trim()) {
      setFormError("Staff name is required.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        ...formValues,
        max_duties:
          formValues.max_duties === null || formValues.max_duties === undefined
            ? null
            : Number(formValues.max_duties)
      };

      const response = await fetch(
        modalMode === "create" ? "/api/staff" : `/api/staff/${selectedStaffId}`,
        {
          method: modalMode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save staff member.");
      }

      router.refresh();
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save staff member.");
      setIsSaving(false);
    }
  }

  async function handleDelete(staffMember: StaffDirectoryRecord) {
    const confirmed = window.confirm(`Delete ${staffMember.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setFormError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/staff/${staffMember.id}`, {
        method: "DELETE"
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete staff member.");
      }

      router.refresh();
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete staff member.");
      setIsSaving(false);
    }
  }

  const activeStaff = modalMode === "create" ? null : selectedStaff;

  return (
    <div className="dashboard-grid">
      <section className="directory-hero">
        <div>
          <h1 className="directory-page-title">Staff Management</h1>
          <p className="directory-page-copy">Manage teaching staff profiles and information</p>
        </div>
        <button className="directory-add-button" type="button" onClick={openCreateModal}>
          + Add Staff Member
        </button>
      </section>

      <section className="directory-search-panel">
        <div className="directory-search-grid">
          <div className="field directory-search-field">
            <label htmlFor="staffSearch">Search Staff</label>
            <input
              id="staffSearch"
              type="text"
              placeholder="Search by name, role, class, ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="departmentFilter">Department</label>
            <select
              id="departmentFilter"
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
            >
              <option value="">All Departments</option>
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="directory-card-grid">
        {filteredStaff.map((person, index) => (
          <article className="staff-management-card" key={person.id}>
            <span className="staff-card-badge">#{person.staff_id ?? index + 1}</span>

            <div className="staff-management-header">
              <StaffAvatar
                photoUrl={person.photo_url}
                staffName={person.name}
                firstName={person.first_name}
                alt={person.name}
                fallback={person.first_name?.[0] ?? person.name[0] ?? "?"}
                className="directory-avatar management-avatar"
                imageClassName="directory-avatar-image"
              />
              <div className="staff-management-copy">
                <h2 className="directory-name">{person.first_name ?? person.name}</h2>
                <p className="staff-management-line primary">{person.department ?? "Department pending"}</p>
                <p className="staff-management-line accent">
                  {person.class || person.timetable || person.designation || "Staff profile"}
                </p>
              </div>
            </div>

            <div className="staff-card-actions">
              <button
                className={`directory-action edit${actionStateClass(person.id, "edit")}`}
                type="button"
                onClick={() => openEditModal(person)}
              >
                Edit
              </button>
              <button
                className={`directory-action view${actionStateClass(person.id, "view")}`}
                type="button"
                onClick={() => openViewModal(person)}
              >
                View
              </button>
              <button
                className="directory-action danger"
                type="button"
                onClick={() => handleDelete(person)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>

      {!filteredStaff.length ? (
        <section className="panel">
          <div className="empty-state">No staff match the current search.</div>
        </section>
      ) : null}

      {modalMode ? (
        <div className="directory-modal-backdrop" role="presentation" onClick={closeModal}>
          <section
            className="directory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-directory-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="directory-modal-close" type="button" onClick={closeModal}>
              ×
            </button>

            <div className="directory-modal-header">
              <StaffAvatar
                photoUrl={activeStaff?.photo_url ?? formValues.photo_url}
                staffName={activeStaff?.name ?? formValues.name ?? ""}
                firstName={activeStaff?.first_name ?? formValues.first_name}
                alt={activeStaff?.name ?? formValues.name ?? "Staff member"}
                fallback={String(formValues.first_name || formValues.name || "?").trim().charAt(0) || "?"}
                className="directory-avatar management-avatar large"
                imageClassName="directory-avatar-image"
              />
              <div>
                <h2 id="staff-directory-modal-title" className="directory-modal-title">
                  {modalMode === "create" ? "Add staff member" : activeStaff?.name ?? "Staff member"}
                </h2>
                <p className="staff-management-line primary">
                  {modalMode === "view" ? activeStaff?.role ?? "Staff" : "Edit staff details and class assignment"}
                </p>
                <p className="staff-management-line accent">
                  {modalMode === "view"
                    ? activeStaff?.department ?? "Department pending"
                    : "Class assignment can be updated here directly."}
                </p>
              </div>
            </div>

            {modalMode === "view" && activeStaff ? (
              <>
                <div className="directory-modal-grid">
                  <div className="directory-modal-section">
                    <h3 className="directory-modal-heading">Personal Information</h3>
                    <div className="directory-modal-list">
                      <div className="directory-modal-row">
                        <span>Staff ID</span>
                        <strong>{activeStaff.staff_id ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>First Name</span>
                        <strong>{activeStaff.first_name ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>Email</span>
                        <strong>{activeStaff.email ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>Department</span>
                        <strong>{activeStaff.department ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>Assigned Class</span>
                        <strong>{activeStaff.class ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>Role</span>
                        <strong>{activeStaff.role ?? "—"}</strong>
                      </div>
                      <div className="directory-modal-row">
                        <span>Status</span>
                        <strong>{activeStaff.status ?? "—"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="directory-modal-section">
                    <h3 className="directory-modal-heading">Work Details</h3>
                    <div className="directory-modal-summary">
                      <span>Assigned Duties</span>
                      <strong>{activeStaff.assigned_duties.length}</strong>
                    </div>
                    <div className="directory-duty-stack">
                      {activeStaff.assigned_duties.length ? (
                        activeStaff.assigned_duties.map((duty) => (
                          <div className="directory-duty-pill" key={duty.id}>
                            {formatDutyLabel(duty)}
                          </div>
                        ))
                      ) : (
                        <div className="directory-duty-pill empty">No assigned duties</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="directory-modal-actions">
                  <button className="directory-action edit" type="button" onClick={() => openEditModal(activeStaff)}>
                    Edit
                  </button>
                  <button className="directory-action danger" type="button" onClick={() => handleDelete(activeStaff)}>
                    Delete
                  </button>
                  <button className="directory-action close" type="button" onClick={closeModal}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="directory-modal-grid">
                  <div className="directory-modal-section">
                    <h3 className="directory-modal-heading">Personal Information</h3>
                    <div className="directory-form-grid">
                      <label className="field">
                        <span>Staff ID</span>
                        <input
                          type="text"
                          value={String(formValues.staff_id ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, staff_id: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Full Name</span>
                        <input
                          type="text"
                          value={formValues.name}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>First Name</span>
                        <input
                          type="text"
                          value={String(formValues.first_name ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, first_name: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Email</span>
                        <input
                          type="email"
                          value={String(formValues.email ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, email: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Department</span>
                        <input
                          type="text"
                          value={String(formValues.department ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, department: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Role</span>
                        <input
                          type="text"
                          value={String(formValues.role ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, role: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Designation</span>
                        <input
                          type="text"
                          value={String(formValues.designation ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, designation: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>System Role</span>
                        <input
                          type="text"
                          value={String(formValues.system_role ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, system_role: event.target.value }))
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="directory-modal-section">
                    <h3 className="directory-modal-heading">Assignment and Status</h3>
                    <div className="directory-form-grid">
                      <label className="field">
                        <span>Assigned Class</span>
                        <select
                          value={String(formValues.class ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, class: event.target.value }))
                          }
                        >
                          <option value="">No class assigned</option>
                          {classOptions.map((option) => (
                            <option key={option.classCode} value={option.className}>
                              {classOptionLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Timetable Label</span>
                        <input
                          type="text"
                          value={String(formValues.timetable ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, timetable: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Status</span>
                        <input
                          type="text"
                          value={String(formValues.status ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, status: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Extension</span>
                        <input
                          type="text"
                          value={String(formValues.extension ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, extension: event.target.value }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Max Duties</span>
                        <input
                          type="number"
                          min="0"
                          value={formValues.max_duties ?? ""}
                          onChange={(event) =>
                            setFormValues((current) => ({
                              ...current,
                              max_duties: event.target.value ? Number(event.target.value) : null
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Photo URL</span>
                        <input
                          type="text"
                          value={String(formValues.photo_url ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({ ...current, photo_url: event.target.value }))
                          }
                        />
                        <small className="field-help">
                          Full Supabase Storage URLs work best. The directory will also try your public
                          <code>staff-photos</code> bucket automatically.
                        </small>
                      </label>
                      <label className="field field-span-2">
                        <span>Unavailable Reason</span>
                        <textarea
                          rows={3}
                          value={String(formValues.unavailable_reason ?? "")}
                          onChange={(event) =>
                            setFormValues((current) => ({
                              ...current,
                              unavailable_reason: event.target.value
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {formError ? <p className="directory-form-error">{formError}</p> : null}

                <div className="directory-modal-actions">
                  <button className="directory-action edit" type="button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : modalMode === "create" ? "Add Staff Member" : "Save Changes"}
                  </button>
                  {activeStaff ? (
                    <button
                      className="directory-action danger"
                      type="button"
                      onClick={() => handleDelete(activeStaff)}
                      disabled={isSaving}
                    >
                      Delete
                    </button>
                  ) : null}
                  <button className="directory-action close" type="button" onClick={closeModal} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
