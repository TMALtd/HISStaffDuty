"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  buildGradebookWorkspaceSections,
  getGradebookSectionDefinitions
} from "@/lib/gradebook";
import type {
  GradebookAssessment,
  GradebookEntry,
  GradebookFieldDefinition,
  GradebookSectionDefinition,
  GradebookSubject,
  GradebookTerm,
  GradebookWorkspaceSection,
  FilterOptions,
  FilterState,
  PortalHeroSettings,
  SpecialistRegister,
  StaffDirectoryClassOption,
  StudentRow
} from "@/lib/types";

type GradebookWorkspaceProps = {
  canManageAssignments: boolean;
  canManageSetup: boolean;
  initialFilters: FilterState;
  previewEmail?: string | null;
  heroSettings?: PortalHeroSettings | null;
  isSpecialistView?: boolean;
  specialistSectionSlug?: string | null;
};

type EntriesResponse = {
  students: StudentRow[];
  classOptions: StaffDirectoryClassOption[];
  fields: GradebookFieldDefinition[];
  entries: GradebookEntry[];
  assessments?: GradebookAssessment[];
  terms?: GradebookTerm[];
  subject: GradebookSubject | null;
  specialistRegisters?: SpecialistRegister[];
  activeRegisterId?: string | null;
  usesSpecialistRegisters?: boolean;
};

type SubjectsResponse = {
  subjects: GradebookSubject[];
};

type SectionsResponse = {
  sections: GradebookSectionDefinition[];
};

type DraftRow = {
  grade: string;
  score: string;
  comment: string;
  fieldValues: Record<string, string>;
  assessmentName: string;
  assessmentDate: string;
};

function assessmentKey(assessmentName: string, assessmentDate: string) {
  return `${assessmentName}||${assessmentDate}`;
}

function getGradeOptionsForYearGroup(yearGroup: string) {
  const normalized = yearGroup.trim().toLowerCase();

  if (normalized === "year 1" || normalized === "year 2") {
    return ["Above", "At", "Below", "Well Below"];
  }

  return ["A", "B", "C", "D", "E"];
}

function formatPercentage(score: string, maxScore: number | null) {
  if (!score.trim()) {
    return "—";
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore) || numericScore < 0 || !maxScore || maxScore <= 0) {
    return "—";
  }

  return `${((numericScore / maxScore) * 100).toFixed(1)}%`;
}

function computePercentageNumber(score: string, maxScore: number | null) {
  if (!score.trim()) {
    return null;
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore) || numericScore < 0 || !maxScore || maxScore <= 0) {
    return null;
  }

  return (numericScore / maxScore) * 100;
}

function deriveGradeFromPercentage(yearGroup: string, percentage: number | null) {
  if (percentage === null) {
    return "";
  }

  const normalized = yearGroup.trim().toLowerCase();

  if (normalized === "year 1" || normalized === "year 2") {
    if (percentage >= 80) return "Above";
    if (percentage >= 50) return "At";
    if (percentage >= 30) return "Below";
    return "Well Below";
  }

  if (percentage >= 80) return "A";
  if (percentage >= 65) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 25) return "D";
  return "E";
}

function deriveTermGrade(yearGroup: string, percentage: number | null) {
  return deriveGradeFromPercentage(yearGroup, percentage) || "—";
}

function getGradeToneClass(grade: string) {
  const normalized = grade.trim().toLowerCase();

  switch (normalized) {
    case "a":
    case "above":
      return "grade-tone-a";
    case "b":
    case "at":
      return "grade-tone-b";
    case "c":
      return "grade-tone-c";
    case "d":
    case "below":
      return "grade-tone-d";
    case "e":
    case "well below":
      return "grade-tone-e";
    default:
      return "";
  }
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

function makeEmptyFilterOptions(): FilterOptions {
  return {
    school: [],
    designation: [],
    yearGroup: [],
    milepost: [],
    level: [],
    className: []
  };
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

function buildDefaultTerms(): GradebookTerm[] {
  return [
    { id: "default-term-1", term_key: "term-1", term_label: "Term 1", start_date: null, end_date: null, sort_order: 1 },
    { id: "default-term-2", term_key: "term-2", term_label: "Term 2", start_date: null, end_date: null, sort_order: 2 },
    { id: "default-term-3", term_key: "term-3", term_label: "Term 3", start_date: null, end_date: null, sort_order: 3 }
  ];
}

function inferTermKeyFromDate(assessmentDate: string, terms: GradebookTerm[]) {
  if (!assessmentDate) {
    return "";
  }

  const assessmentTime = Date.parse(assessmentDate);
  if (Number.isNaN(assessmentTime)) {
    return "";
  }

  const matched = terms.find((term) => {
    if (!term.start_date || !term.end_date) {
      return false;
    }
    const start = Date.parse(term.start_date);
    const end = Date.parse(term.end_date);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return false;
    }
    return assessmentTime >= start && assessmentTime <= end;
  });

  return matched?.term_key ?? "";
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
  initialFilters,
  previewEmail,
  heroSettings,
  isSpecialistView = false,
  specialistSectionSlug = null
}: GradebookWorkspaceProps) {
  const isAdminView = canManageAssignments || canManageSetup;
  const [activeFilters, setActiveFilters] = useState<FilterState>(initialFilters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(makeEmptyFilterOptions());
  const [sectionDefinitions, setSectionDefinitions] = useState<GradebookSectionDefinition[]>(
    getGradebookSectionDefinitions()
  );
  const [subjects, setSubjects] = useState<GradebookSubject[]>([]);
  const [selectedSectionSlug, setSelectedSectionSlug] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [newAssessmentName, setNewAssessmentName] = useState("");
  const [newAssessmentDate, setNewAssessmentDate] = useState("");
  const [newAssessmentMaxScore, setNewAssessmentMaxScore] = useState("");
  const [newAssessmentTermKey, setNewAssessmentTermKey] = useState("");
  const [newAssessmentIncludeInTerm, setNewAssessmentIncludeInTerm] = useState(false);
  const [newAssessmentWeightingPercent, setNewAssessmentWeightingPercent] = useState("");
  const [editingAssessmentKey, setEditingAssessmentKey] = useState("");
  const [assessments, setAssessments] = useState<GradebookAssessment[]>([]);
  const [terms, setTerms] = useState<GradebookTerm[]>(buildDefaultTerms());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classOptions, setClassOptions] = useState<StaffDirectoryClassOption[]>([]);
  const [classDrafts, setClassDrafts] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<GradebookFieldDefinition[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, Record<string, DraftRow>>>({});
  const [entryIndex, setEntryIndex] = useState<Record<string, Record<string, GradebookEntry>>>({});
  const [subjectMeta, setSubjectMeta] = useState<GradebookSubject | null>(null);
  const [specialistRegisters, setSpecialistRegisters] = useState<SpecialistRegister[]>([]);
  const [selectedRegisterId, setSelectedRegisterId] = useState("");
  const [usesSpecialistRegisters, setUsesSpecialistRegisters] = useState(false);
  const [selectedSpecialistYearGroup, setSelectedSpecialistYearGroup] = useState("");
  const [selectedSpecialistClass, setSelectedSpecialistClass] = useState("");
  const [collapsedTerms, setCollapsedTerms] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [assignmentSavingId, setAssignmentSavingId] = useState("");
  const [isSavingAssessmentGrid, setIsSavingAssessmentGrid] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const sections = useMemo(
    () => buildGradebookWorkspaceSections(subjects, sectionDefinitions),
    [sectionDefinitions, subjects]
  );
  const visibleSections = useMemo(
    () => (isAdminView ? sections : sections.filter((section) => section.isConfigured)),
    [isAdminView, sections]
  );
  const sectionGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        order: number;
        sections: typeof visibleSections;
      }
    >();

    for (const section of visibleSections) {
      const current =
        groups.get(section.groupKey) ??
        {
          key: section.groupKey,
          label: section.groupLabel,
          order: section.groupOrder,
          sections: []
        };
      current.sections.push(section);
      groups.set(section.groupKey, current);
    }

    return Array.from(groups.values()).sort((left, right) => left.order - right.order);
  }, [visibleSections]);
  const selectedSection = useMemo(
    () =>
      visibleSections.find((section) => section.slug === selectedSectionSlug) ?? visibleSections[0] ?? null,
    [selectedSectionSlug, visibleSections]
  );
  const linkedSubject = selectedSection?.subject ?? null;
  const specialistAssessmentSection = useMemo(
    () =>
      visibleSections.find(
        (section) => section.mode === "assessment" && section.subject
      ) ?? null,
    [visibleSections]
  );
  const specialistSubjectForRegisters = specialistAssessmentSection?.subject ?? null;
  const classOptionLookup = useMemo(
    () => new Map(classOptions.map((option) => [option.className, option])),
    [classOptions]
  );
  const filteredStudents = useMemo(
    () =>
      selectedStudentId
        ? students.filter((student) => student.school_id === selectedStudentId)
        : students.filter((student) => {
            if (selectedSpecialistYearGroup && student.year_group !== selectedSpecialistYearGroup) {
              return false;
            }
            if (selectedSpecialistClass && student.class_name !== selectedSpecialistClass) {
              return false;
            }
            return true;
          }),
    [selectedSpecialistClass, selectedSpecialistYearGroup, selectedStudentId, students]
  );
  const specialistYearGroupOptions = useMemo(
    () =>
      Array.from(new Set(students.map((student) => student.year_group).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true })
      ),
    [students]
  );
  const specialistClassOptions = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .filter((student) => !selectedSpecialistYearGroup || student.year_group === selectedSpecialistYearGroup)
            .map((student) => student.class_name)
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
    [selectedSpecialistYearGroup, students]
  );
  const assessmentsByTerm = useMemo(() => {
    const orderedTerms = terms.length ? terms : buildDefaultTerms();
    return orderedTerms.map((term) => ({
      term,
      assessments: assessments.filter((assessment) => assessment.term_key === term.term_key)
    }));
  }, [assessments, terms]);

  useEffect(() => {
    setActiveFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    if (!newAssessmentDate) {
      return;
    }

    const inferred = inferTermKeyFromDate(newAssessmentDate, terms);
    if (inferred && !newAssessmentTermKey) {
      setNewAssessmentTermKey(inferred);
    }
  }, [newAssessmentDate, newAssessmentTermKey, terms]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const response = await fetch("/api/gradebook/sections", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load Markbook section text.");
      }

      const json = (await response.json()) as SectionsResponse;
      if (isMounted) {
        setSectionDefinitions(json.sections);
      }
    })().catch((loadError) => {
      if (isMounted) {
        setError(
          loadError instanceof Error ? loadError.message : "Could not load Markbook section text."
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSubjects() {
      const params = new URLSearchParams();
      if (activeFilters.className) {
        params.set("className", activeFilters.className);
      }
      if (previewEmail) {
        params.set("viewAs", previewEmail);
      }
      if (specialistSectionSlug) {
        params.set("specialistSectionSlug", specialistSectionSlug);
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
      const workspaceSections = buildGradebookWorkspaceSections(json.subjects, sectionDefinitions);

      setSelectedSectionSlug((current) => {
        if (current && workspaceSections.some((section) => section.slug === current)) {
          return current;
        }

        if (isSpecialistView) {
          if (
            specialistSectionSlug &&
            workspaceSections.some(
              (section) => section.slug === specialistSectionSlug && section.isConfigured
            )
          ) {
            return specialistSectionSlug;
          }

          const specialistAssessment =
            workspaceSections.find((section) => section.mode === "assessment" && section.isConfigured) ?? null;
          if (specialistAssessment) {
            return specialistAssessment.slug;
          }
        }

        return (
          workspaceSections.find((section) => section.isConfigured)?.slug ??
          workspaceSections[0]?.slug ??
          ""
        );
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
  }, [activeFilters.className, isSpecialistView, previewEmail, sectionDefinitions, specialistSectionSlug]);

  useEffect(() => {
    if (!isAdminView) {
      return;
    }

    let isMounted = true;

    async function loadFilterOptions() {
      const response = await fetch(`/api/filters?${buildQueryString(activeFilters)}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Could not load gradebook filters.");
      }

      const json = (await response.json()) as { options?: FilterOptions };

      if (!isMounted) {
        return;
      }

      setFilterOptions(json.options ?? makeEmptyFilterOptions());
    }

    void loadFilterOptions().catch((loadError) => {
      if (isMounted) {
        setError(loadError instanceof Error ? loadError.message : "Could not load gradebook filters.");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeFilters, isAdminView]);

  useEffect(() => {
    setSelectedStudentId("");
    setNewAssessmentName("");
    setNewAssessmentDate("");
    setNewAssessmentMaxScore("");
    setNewAssessmentTermKey("");
    setNewAssessmentIncludeInTerm(false);
    setNewAssessmentWeightingPercent("");
    setAssessments([]);
    setStudents([]);
    setClassOptions([]);
    setClassDrafts({});
    setFields([]);
    setDrafts({});
    setAssessmentDrafts({});
    setEntryIndex({});
    setSubjectMeta(null);
    setSpecialistRegisters([]);
    setSelectedRegisterId("");
    setUsesSpecialistRegisters(false);
    setSelectedSpecialistYearGroup("");
    setSelectedSpecialistClass("");
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
        const params = new URLSearchParams(buildQueryString(activeFilters));
        params.set("subjectId", linkedSubject.id);
        if (specialistSubjectForRegisters?.id) {
          params.set("specialistSubjectId", specialistSubjectForRegisters.id);
        }
        if (selectedRegisterId) {
          params.set("registerId", selectedRegisterId);
        }
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
        setSpecialistRegisters(json.specialistRegisters ?? []);
        setUsesSpecialistRegisters(Boolean(json.usesSpecialistRegisters));
        setSelectedRegisterId((current) => {
          if (json.activeRegisterId) {
            return json.activeRegisterId;
          }
          if (current && (json.specialistRegisters ?? []).some((register) => register.id === current)) {
            return current;
          }
          return "";
        });
        setSelectedSpecialistYearGroup((current) => {
          if (current && (json.students ?? []).some((student) => student.year_group === current)) {
            return current;
          }
          if (json.activeRegisterId) {
            const activeRegister =
              (json.specialistRegisters ?? []).find((register) => register.id === json.activeRegisterId) ?? null;
            return activeRegister?.year_group ?? "";
          }
          return (json.students ?? []).find((student) => student.year_group)?.year_group ?? "";
        });
        setSelectedSpecialistClass((current) =>
          current && (json.students ?? []).some((student) => student.class_name === current) ? current : ""
        );
        const nextTerms = (json.terms?.length ? json.terms : buildDefaultTerms()).slice().sort(
          (left, right) => left.sort_order - right.sort_order
        );
        setTerms(nextTerms);
        setClassOptions(json.classOptions);
        const assessmentSet = new Map<string, GradebookAssessment>();

        (json.assessments ?? []).forEach((assessment) => {
          assessmentSet.set(
            assessmentKey(assessment.assessment_name, assessment.assessment_date),
            assessment
          );
        });

        json.entries.forEach((entry) => {
          const key = assessmentKey(entry.assessment_name, entry.assessment_date);
          if (assessmentSet.has(key)) {
            return;
          }

          assessmentSet.set(key, {
            id: `entry-${entry.assessment_name}-${entry.assessment_date}`,
            subject_id: linkedSubject.id,
            class_name: activeFilters.className || null,
            assessment_name: entry.assessment_name,
            assessment_date: entry.assessment_date,
            max_score: null,
            term_key: inferTermKeyFromDate(entry.assessment_date, nextTerms) || null,
            include_in_term: false,
            weighting_percent: null
          });
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
    activeFilters,
    linkedSubject,
    previewEmail,
    refreshToken,
    selectedRegisterId,
    selectedSection,
    selectedStudentId,
    specialistSubjectForRegisters
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
    const linkedAssessment = assessments.find(
      (assessment) => assessmentKey(assessment.assessment_name, assessment.assessment_date) === columnKey
    );
    const nextScore =
      field === "score"
        ? value
        : (assessmentDrafts[studentId]?.[columnKey]?.score ?? makeEmptyDraft().score);
    const autoGrade =
      linkedAssessment && (field === "score" || field === "grade")
        ? deriveGradeFromPercentage(
            students.find((student) => student.school_id === studentId)?.year_group ?? "",
            computePercentageNumber(nextScore, linkedAssessment.max_score)
          )
        : null;

    setAssessmentDrafts((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] ?? {}),
        [columnKey]: {
          ...(current[studentId]?.[columnKey] ?? makeEmptyDraft()),
          [field]: value,
          ...(field === "score" && autoGrade !== null ? { grade: autoGrade } : {})
        }
      }
    }));
  }

  function resetAssessmentBuilderForm() {
    setEditingAssessmentKey("");
    setNewAssessmentName("");
    setNewAssessmentDate("");
    setNewAssessmentMaxScore("");
    setNewAssessmentTermKey("");
    setNewAssessmentIncludeInTerm(false);
    setNewAssessmentWeightingPercent("");
  }

  function beginEditingAssessment(assessment: GradebookAssessment) {
    setEditingAssessmentKey(assessmentKey(assessment.assessment_name, assessment.assessment_date));
    setNewAssessmentName(assessment.assessment_name);
    setNewAssessmentDate(assessment.assessment_date);
    setNewAssessmentMaxScore(assessment.max_score === null ? "" : String(assessment.max_score));
    setNewAssessmentTermKey(assessment.term_key ?? "");
    setNewAssessmentIncludeInTerm(assessment.include_in_term);
    setNewAssessmentWeightingPercent(
      assessment.weighting_percent === null ? "" : String(assessment.weighting_percent)
    );
  }

  function replaceAssessmentLocally(previousKey: string, nextAssessment: GradebookAssessment) {
    const nextKey = assessmentKey(nextAssessment.assessment_name, nextAssessment.assessment_date);

    setAssessments((current) =>
      current
        .map((assessment) =>
          assessmentKey(assessment.assessment_name, assessment.assessment_date) === previousKey
            ? nextAssessment
            : assessment
        )
        .sort(
          (left, right) =>
            left.assessment_date.localeCompare(right.assessment_date) ||
            left.assessment_name.localeCompare(right.assessment_name, undefined, { numeric: true })
        )
    );

    setAssessmentDrafts((current) => {
      const next = { ...current };
      Object.keys(next).forEach((studentId) => {
        const row = next[studentId];
        if (!row?.[previousKey]) {
          return;
        }
        next[studentId] = {
          ...row,
          [nextKey]: {
            ...row[previousKey],
            assessmentName: nextAssessment.assessment_name,
            assessmentDate: nextAssessment.assessment_date
          }
        };
        if (nextKey !== previousKey) {
          delete next[studentId][previousKey];
        }
      });
      return next;
    });

    setEntryIndex((current) => {
      const next = { ...current };
      Object.keys(next).forEach((studentId) => {
        const row = next[studentId];
        if (!row?.[previousKey]) {
          return;
        }
        next[studentId] = {
          ...row,
          [nextKey]: {
            ...row[previousKey],
            assessment_name: nextAssessment.assessment_name,
            assessment_date: nextAssessment.assessment_date
          }
        };
        if (nextKey !== previousKey) {
          delete next[studentId][previousKey];
        }
      });
      return next;
    });
  }

  function removeAssessmentLocally(columnKey: string) {
    setAssessments((current) =>
      current.filter(
        (assessment) => assessmentKey(assessment.assessment_name, assessment.assessment_date) !== columnKey
      )
    );

    setAssessmentDrafts((current) => {
      const next = { ...current };
      Object.keys(next).forEach((studentId) => {
        if (next[studentId]?.[columnKey]) {
          delete next[studentId][columnKey];
        }
      });
      return next;
    });

    setEntryIndex((current) => {
      const next = { ...current };
      Object.keys(next).forEach((studentId) => {
        if (next[studentId]?.[columnKey]) {
          delete next[studentId][columnKey];
        }
      });
      return next;
    });
  }

  function updateAssessmentMetadata(
    columnKey: string,
    updates: Partial<
      Pick<GradebookAssessment, "max_score" | "term_key" | "include_in_term" | "weighting_percent">
    >
  ) {
    setAssessments((current) =>
      current.map((assessment) =>
        assessmentKey(assessment.assessment_name, assessment.assessment_date) === columnKey
          ? {
              ...assessment,
              ...updates
            }
          : assessment
      )
    );
  }

  function saveAssessmentMetadataLocally(
    assessmentName: string,
    assessmentDate: string,
    includeInTerm: boolean,
    weightingPercent: number | null
  ) {
    const key = assessmentKey(assessmentName, assessmentDate);
    updateAssessmentMetadata(key, {
      include_in_term: includeInTerm,
      weighting_percent: weightingPercent
    });
  }

  function seedAssessmentColumn(assessment: GradebookAssessment) {
    const key = assessmentKey(assessment.assessment_name, assessment.assessment_date);

    setAssessments((current) =>
      [...current, assessment]
        .filter(
          (item, index, items) =>
            items.findIndex(
              (candidate) =>
                assessmentKey(candidate.assessment_name, candidate.assessment_date) ===
                assessmentKey(item.assessment_name, item.assessment_date)
            ) === index
        )
        .sort(
          (left, right) =>
            left.assessment_date.localeCompare(right.assessment_date) ||
            left.assessment_name.localeCompare(right.assessment_name, undefined, { numeric: true })
        )
    );

    setAssessmentDrafts((current) => {
      const next = { ...current };
      students.forEach((student) => {
        next[student.school_id] = {
          ...(next[student.school_id] ?? {}),
          [key]:
            next[student.school_id]?.[key] ??
            {
              ...makeEmptyDraft(),
              assessmentName: assessment.assessment_name,
              assessmentDate: assessment.assessment_date
            }
        };
      });
      return next;
    });
  }

  function updateFilter<K extends keyof FilterState>(field: K, value: FilterState[K]) {
    setSelectedStudentId("");
    setActiveFilters((current) => {
      const nextFilters: FilterState = {
        ...current,
        [field]: value
      };

      if (field === "school") {
        nextFilters.designation = "";
        nextFilters.yearGroup = "";
        nextFilters.milepost = "";
        nextFilters.level = "";
        nextFilters.className = "";
      } else if (field === "designation") {
        nextFilters.yearGroup = "";
        nextFilters.milepost = "";
        nextFilters.level = "";
        nextFilters.className = "";
      } else if (field === "yearGroup") {
        nextFilters.milepost = "";
        nextFilters.level = "";
        nextFilters.className = "";
      } else if (field === "milepost" || field === "level") {
        nextFilters.className = "";
      }

      return nextFilters;
    });
  }

  async function createAssessmentColumn() {
    if (!linkedSubject) {
      setError("Choose a configured gradebook section first.");
      return;
    }

    const parsedMaxScore = Number(newAssessmentMaxScore);
    const parsedWeightingPercent = newAssessmentWeightingPercent.trim()
      ? Number(newAssessmentWeightingPercent)
      : null;

    if (!newAssessmentName || !newAssessmentDate || !newAssessmentMaxScore) {
      setError("Add an assessment name, date, and out-of score before creating a new assignment column.");
      return;
    }

    if (!Number.isFinite(parsedMaxScore) || parsedMaxScore <= 0) {
      setError("Use a valid number greater than 0 for the out-of score.");
      return;
    }

    if (
      parsedWeightingPercent !== null &&
      (!Number.isFinite(parsedWeightingPercent) || parsedWeightingPercent < 0 || parsedWeightingPercent > 100)
    ) {
      setError("Use a weighting between 0 and 100, or leave it blank.");
      return;
    }

    const nextColumnKey = assessmentKey(newAssessmentName.trim(), newAssessmentDate);

    if (
      assessments.some((assessment) => {
        const key = assessmentKey(assessment.assessment_name, assessment.assessment_date);
        return key === nextColumnKey && key !== editingAssessmentKey;
      })
    ) {
      setError("This assignment column already exists.");
      return;
    }

    try {
      const isEditing = Boolean(editingAssessmentKey);
      const currentAssessment = isEditing
        ? assessments.find(
            (assessment) =>
              assessmentKey(assessment.assessment_name, assessment.assessment_date) === editingAssessmentKey
          ) ?? null
        : null;

      if (isEditing && !currentAssessment) {
        throw new Error("The selected assignment could not be found.");
      }

      const response = await fetch("/api/gradebook/assessments", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: linkedSubject.id,
          className: activeFilters.className || null,
          assessmentName: newAssessmentName.trim(),
          assessmentDate: newAssessmentDate,
          currentAssessmentName: currentAssessment?.assessment_name,
          currentAssessmentDate: currentAssessment?.assessment_date,
          nextAssessmentName: newAssessmentName.trim(),
          nextAssessmentDate: newAssessmentDate,
          termKey: newAssessmentTermKey || null,
          maxScore: parsedMaxScore,
          includeInTerm: newAssessmentIncludeInTerm,
          weightingPercent: newAssessmentIncludeInTerm ? parsedWeightingPercent : null
        })
      });

      const json = (await response.json()) as { assessment?: GradebookAssessment; error?: string };
      if (!response.ok || !json.assessment) {
        throw new Error(json.error ?? "Could not create the assignment column.");
      }

      if (isEditing && editingAssessmentKey) {
        replaceAssessmentLocally(editingAssessmentKey, json.assessment);
      } else {
        seedAssessmentColumn(json.assessment);
      }
      resetAssessmentBuilderForm();
      setError("");
      setStatus(
        isEditing
          ? `Updated ${json.assessment.assessment_name}.`
          : `Added ${json.assessment.assessment_name} as a new assignment column.`
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save the assignment column."
      );
    }
  }

  async function deleteAssessmentColumn(assessment: GradebookAssessment) {
    if (!linkedSubject) {
      setError("Choose a configured markbook section before deleting.");
      return;
    }

    try {
      const response = await fetch("/api/gradebook/assessments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: linkedSubject.id,
          className: activeFilters.className || null,
          assessmentName: assessment.assessment_name,
          assessmentDate: assessment.assessment_date
        })
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Could not delete assignment column.");
      }

      const key = assessmentKey(assessment.assessment_name, assessment.assessment_date);
      removeAssessmentLocally(key);
      if (editingAssessmentKey === key) {
        resetAssessmentBuilderForm();
      }
      setStatus(`Deleted ${assessment.assessment_name}.`);
      setError("");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete assignment column."
      );
    }
  }

  async function saveAssessmentSpreadsheet() {
    if (!linkedSubject) {
      setError("Choose a configured gradebook section before saving.");
      return;
    }

    setIsSavingAssessmentGrid(true);
    setError("");

    try {
      const metadataPayload = assessments.map((assessment) => ({
        subjectId: linkedSubject.id,
        className: activeFilters.className || null,
        assessmentName: assessment.assessment_name,
        assessmentDate: assessment.assessment_date,
        termKey: assessment.term_key,
        maxScore: assessment.max_score,
        includeInTerm: assessment.include_in_term,
        weightingPercent: assessment.include_in_term ? assessment.weighting_percent : null
      }));

      if (metadataPayload.length) {
        const metadataResponses = await Promise.all(
          metadataPayload.map((payload) =>
            fetch("/api/gradebook/assessments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            })
          )
        );

        const failedMetadata = await Promise.all(
          metadataResponses.map(async (response) => {
            if (response.ok) {
              return null;
            }

            const json = (await response.json()) as { error?: string };
            return json.error ?? "Could not save assignment settings.";
          })
        );

        const metadataError = failedMetadata.find(Boolean);
        if (metadataError) {
          throw new Error(metadataError);
        }
      }

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
      <div className="gradebook-section-groups">
        {sectionGroups.map((group) => (
          <details className="gradebook-section-group" key={group.key} open>
            <summary className="gradebook-section-group-header">
              <div>
                <p className="eyebrow compact-eyebrow">{group.label}</p>
                <h3 className="gradebook-section-group-title">{group.label}</h3>
              </div>
              <span className="hint">
                {isAdminView
                  ? `${group.sections.filter((section) => section.isConfigured).length} of ${group.sections.length} ready`
                  : `${group.sections.length} sections`}
              </span>
            </summary>
            <div className="gradebook-section-group-body">
              <div className="gradebook-section-group-grid">
                {group.sections.map((section) => (
                  <button
                    className={`gradebook-section-card${section.slug === selectedSection?.slug ? " active" : ""}`}
                    key={section.slug}
                    type="button"
                    onClick={() => setSelectedSectionSlug(section.slug)}
                  >
                    <div className="gradebook-section-card-top">
                      <p className="eyebrow compact-eyebrow">{group.label}</p>
                      <span className={`gradebook-section-status ${section.isConfigured ? "ready" : "pending"}`}>
                        {isAdminView ? (section.isConfigured ? "Ready" : "To build") : "Ready"}
                      </span>
                    </div>
                    <h3 className="gradebook-section-name">{section.name}</h3>
                    <p className="gradebook-section-copy">{section.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </details>
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
    const unassignedAssessments = assessments.filter((assessment) => !assessment.term_key);
    const groupedTerms = [
      ...assessmentsByTerm,
      ...(unassignedAssessments.length
        ? [
            {
              term: {
                id: "unassigned-term",
                term_key: "unassigned",
                term_label: "Unassigned",
                start_date: null,
                end_date: null,
                sort_order: 999
              },
              assessments: unassignedAssessments
            }
          ]
        : [])
    ];

    return (
      <div className="dashboard-grid" style={{ gap: "1rem" }}>
        {groupedTerms.map(({ term, assessments: termAssessments }) => {
          const isCollapsed = collapsedTerms[term.term_key] ?? false;

          return (
            <section className="panel" key={term.term_key}>
              <div className="panel-heading gradebook-term-heading">
                <div className="gradebook-term-heading-copy">
                  <h3 className="panel-title" style={{ marginBottom: 0 }}>{term.term_label}</h3>
                  <span className="hint">
                    {term.start_date && term.end_date
                      ? `${term.start_date} to ${term.end_date}`
                      : "Dates not set yet"}
                  </span>
                </div>
                <div className="actions gradebook-term-actions" style={{ marginTop: 0 }}>
                  <span className="hint">
                    {termAssessments.length} assignment column{termAssessments.length === 1 ? "" : "s"}
                  </span>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() =>
                      setCollapsedTerms((current) => ({
                        ...current,
                        [term.term_key]: !isCollapsed
                      }))
                    }
                  >
                    {isCollapsed ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>

              {!isCollapsed ? (
                termAssessments.length ? (
                  <div className="table-wrap gradebook-term-table-wrap">
                    <table className="gradebook-term-table">
                      <thead>
                        <tr>
                          <th rowSpan={2} className="gradebook-name-column">Name</th>
                          {termAssessments.map((assessment) => (
                            <th
                              colSpan={3}
                              className="gradebook-assessment-column"
                              key={assessmentKey(assessment.assessment_name, assessment.assessment_date)}
                            >
                              <div className="gradebook-assessment-column-title">{assessment.assessment_name}</div>
                              <div className="gradebook-assessment-column-date">{assessment.assessment_date}</div>
                              {canManageAssignments ? (
                                <div className="gradebook-assessment-header-actions">
                                  <button
                                    className="button secondary"
                                    type="button"
                                    onClick={() => beginEditingAssessment(assessment)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="button secondary"
                                    type="button"
                                    onClick={() => void deleteAssessmentColumn(assessment)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                              <div className="gradebook-assessment-column-date">
                                <label style={{ display: "block" }}>
                                  <span style={{ display: "block" }}>Term</span>
                                  <select
                                    className="gradebook-assessment-meta-input"
                                    value={assessment.term_key ?? ""}
                                    onChange={(event) =>
                                      updateAssessmentMetadata(
                                        assessmentKey(assessment.assessment_name, assessment.assessment_date),
                                        { term_key: event.target.value || null }
                                      )
                                    }
                                  >
                                    <option value="">Unassigned</option>
                                    {terms.map((termOption) => (
                                      <option key={termOption.term_key} value={termOption.term_key}>
                                        {termOption.term_label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="gradebook-assessment-column-date">
                                <label style={{ display: "block" }}>
                                  <span style={{ display: "block" }}>Out of</span>
                                  <input
                                    className="cell-input gradebook-assessment-meta-input"
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={assessment.max_score ?? ""}
                                    onChange={(event) =>
                                      updateAssessmentMetadata(
                                        assessmentKey(assessment.assessment_name, assessment.assessment_date),
                                        {
                                          max_score: event.target.value ? Number(event.target.value) : null
                                        }
                                      )
                                    }
                                  />
                                </label>
                              </div>
                              <div className="gradebook-assessment-column-date">
                                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "center" }}>
                                  <input
                                    type="checkbox"
                                    checked={assessment.include_in_term}
                                    onChange={(event) => {
                                      const checked = event.target.checked;
                                      saveAssessmentMetadataLocally(
                                        assessment.assessment_name,
                                        assessment.assessment_date,
                                        checked,
                                        checked ? assessment.weighting_percent : null
                                      );
                                    }}
                                  />
                                  <span>Include in term</span>
                                </label>
                              </div>
                              <div className="gradebook-assessment-column-date">
                                <label style={{ display: "block" }}>
                                  <span style={{ display: "block" }}>Weighting %</span>
                                  <input
                                    className="cell-input gradebook-assessment-meta-input"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={assessment.weighting_percent ?? ""}
                                    onChange={(event) =>
                                      updateAssessmentMetadata(
                                        assessmentKey(assessment.assessment_name, assessment.assessment_date),
                                        {
                                          weighting_percent: event.target.value ? Number(event.target.value) : null
                                        }
                                      )
                                    }
                                    disabled={!assessment.include_in_term}
                                  />
                                </label>
                              </div>
                            </th>
                          ))}
                          <th colSpan={2} className="gradebook-summary-column">
                            {term.term_label} Summary
                          </th>
                        </tr>
                        <tr>
                          {termAssessments.flatMap((assessment) => [
                            <th key={`${assessment.id}-score`}>Score</th>,
                            <th key={`${assessment.id}-percent`}>%</th>,
                            <th key={`${assessment.id}-grade`}>Grade</th>
                          ])}
                          <th className="gradebook-summary-column gradebook-summary-percent">%</th>
                          <th className="gradebook-summary-column gradebook-summary-grade">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => {
                          const gradeOptions = getGradeOptionsForYearGroup(student.year_group);
                          const includedAssessments = termAssessments.filter((assessment) => assessment.include_in_term);
                          const explicitWeightingTotal = includedAssessments.reduce(
                            (total, assessment) => total + (assessment.weighting_percent ?? 0),
                            0
                          );
                          const unspecifiedWeightingCount = includedAssessments.filter(
                            (assessment) => assessment.weighting_percent === null
                          ).length;
                          const remainingWeighting =
                            unspecifiedWeightingCount > 0
                              ? Math.max(100 - explicitWeightingTotal, 0) / unspecifiedWeightingCount
                              : 0;
                          const weightedPercentages = includedAssessments
                            .map((assessment) => {
                              const key = assessmentKey(assessment.assessment_name, assessment.assessment_date);
                              const draft = assessmentDrafts[student.school_id]?.[key] ?? {
                                ...makeEmptyDraft(),
                                assessmentName: assessment.assessment_name,
                                assessmentDate: assessment.assessment_date
                              };
                              const percentage = computePercentageNumber(draft.score, assessment.max_score);
                              if (percentage === null) {
                                return null;
                              }

                              return {
                                percentage,
                                weight:
                                  assessment.weighting_percent !== null
                                    ? assessment.weighting_percent
                                    : remainingWeighting
                              };
                            })
                            .filter(Boolean) as Array<{ percentage: number; weight: number }>;
                          const termWeightTotal = weightedPercentages.reduce((total, item) => total + item.weight, 0);
                          const termPercentage =
                            termWeightTotal > 0
                              ? weightedPercentages.reduce(
                                  (total, item) => total + item.percentage * (item.weight / termWeightTotal),
                                  0
                                )
                              : null;
                          const termGrade = deriveTermGrade(student.year_group, termPercentage);

                          return (
                            <tr key={`${term.term_key}-${student.school_id}`}>
                              <td className="gradebook-name-column gradebook-name-cell">
                                <div className="gradebook-student-name">{student.full_name}</div>
                                <div className="gradebook-student-meta">
                                  {student.class_name}
                                  {student.assigned_teacher_name ? ` | ${student.assigned_teacher_name}` : ""}
                                </div>
                              </td>
                              {termAssessments.map((assessment) => {
                                const key = assessmentKey(assessment.assessment_name, assessment.assessment_date);
                                const draft = assessmentDrafts[student.school_id]?.[key] ?? {
                                  ...makeEmptyDraft(),
                                  assessmentName: assessment.assessment_name,
                                  assessmentDate: assessment.assessment_date
                                };

                                return (
                                  <Fragment key={`${term.term_key}-${student.school_id}-${key}`}>
                                    <td>
                                      <input
                                        className="cell-input gradebook-score-input"
                                        inputMode="decimal"
                                        placeholder="Score"
                                        value={draft.score}
                                        onChange={(event) =>
                                          updateAssessmentDraft(student.school_id, key, "score", event.target.value)
                                        }
                                      />
                                    </td>
                                    <td>
                                      <div
                                        className={`gradebook-percentage-value ${getGradeToneClass(draft.grade)}`}
                                      >
                                        {formatPercentage(draft.score, assessment.max_score)}
                                      </div>
                                    </td>
                                    <td>
                                      <select
                                        className={`gradebook-grade-select ${getGradeToneClass(draft.grade)}`}
                                        value={draft.grade}
                                        onChange={(event) =>
                                          updateAssessmentDraft(student.school_id, key, "grade", event.target.value)
                                        }
                                      >
                                        <option value="">Select</option>
                                        {gradeOptions.map((option) => (
                                          <option key={option} value={option}>
                                            {option}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                  </Fragment>
                                );
                              })}
                              <td className="gradebook-summary-column gradebook-summary-percent">
                                <div
                                  className={`gradebook-percentage-value ${getGradeToneClass(termGrade)}`}
                                >
                                  {termPercentage === null ? "—" : `${termPercentage.toFixed(1)}%`}
                                </div>
                              </td>
                              <td className="gradebook-summary-column gradebook-summary-grade">
                                <div
                                  className={`gradebook-percentage-value ${getGradeToneClass(termGrade)}`}
                                >
                                  {termGrade}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">No assignments in {term.term_label} yet.</div>
                )
              ) : null}
            </section>
          );
        })}
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
              Open Markbook Setup
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
        <p className="eyebrow">{heroSettings?.eyebrow ?? "Markbook workspace"}</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">
              {heroSettings?.title ?? "Build the class markbook around real teaching sections"}
            </h1>
            <p className="hero-copy">
              {heroSettings?.description ??
                "This new workspace is organised the same way your class markbook works in practice: student profiles, parent meeting notes, and subject assessment areas such as Phonics, Reading, Writing, Maths, and IPC."}
            </p>
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <Link
              className="button secondary"
              href={`/${buildQueryString(activeFilters) ? `?${buildQueryString(activeFilters)}` : ""}`}
            >
              Back to Filter View
            </Link>
            {canManageSetup ? (
              <Link className="button" href="/admin/gradebook">
                Markbook Setup
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow compact-eyebrow">{isSpecialistView ? "Specialist Markbook" : "Class Markbook"}</p>
            <h2 className="panel-title" style={{ marginBottom: 0 }}>
              {isSpecialistView
                ? specialistSubjectForRegisters?.name || linkedSubject?.name || "Specialist markbook"
                : activeFilters.className || "Whole-school markbook"}
            </h2>
          </div>
          <span className="hint">
            {isAdminView
              ? `${sections.filter((section) => section.isConfigured).length} of ${sections.length} sections configured`
              : `${visibleSections.length} sections available`}
          </span>
        </div>
        {renderSectionCards()}
      </section>

      <section className="panel">
        <div className="filters-grid">
          {isAdminView ? (
            <>
              <div className="field">
                <label htmlFor="gradebookSchoolFilter">School</label>
                <select
                  id="gradebookSchoolFilter"
                  value={activeFilters.school}
                  onChange={(event) => updateFilter("school", event.target.value)}
                >
                  <option value="">All schools</option>
                  {filterOptions.school.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="gradebookDesignationFilter">Designation</label>
                <select
                  id="gradebookDesignationFilter"
                  value={activeFilters.designation}
                  onChange={(event) => updateFilter("designation", event.target.value)}
                >
                  <option value="">All designations</option>
                  {filterOptions.designation.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="gradebookYearGroupFilter">Year group</label>
                <select
                  id="gradebookYearGroupFilter"
                  value={activeFilters.yearGroup}
                  onChange={(event) => updateFilter("yearGroup", event.target.value)}
                >
                  <option value="">All year groups</option>
                  {filterOptions.yearGroup.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="gradebookMilepostFilter">Milepost</label>
                <select
                  id="gradebookMilepostFilter"
                  value={activeFilters.milepost}
                  onChange={(event) => updateFilter("milepost", event.target.value)}
                >
                  <option value="">All mileposts</option>
                  {filterOptions.milepost.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="gradebookLevelFilter">Level</label>
                <select
                  id="gradebookLevelFilter"
                  value={activeFilters.level}
                  onChange={(event) => updateFilter("level", event.target.value)}
                >
                  <option value="">All levels</option>
                  {filterOptions.level.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="gradebookClassFilter">Class</label>
                <select
                  id="gradebookClassFilter"
                  value={activeFilters.className}
                  onChange={(event) => updateFilter("className", event.target.value)}
                >
                  <option value="">All classes</option>
                  {filterOptions.className.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          <div className="field">
            <label htmlFor="gradebookSection">Section</label>
            <select
              id="gradebookSection"
              value={selectedSection?.slug ?? ""}
              onChange={(event) => setSelectedSectionSlug(event.target.value)}
            >
              {visibleSections.map((section) => (
                <option key={section.slug} value={section.slug}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
          {isSpecialistView ? (
            <div className="field">
              <label htmlFor="specialistYearGroupFilter">Year group</label>
              <select
                id="specialistYearGroupFilter"
                value={selectedSpecialistYearGroup}
                onChange={(event) => {
                  setSelectedStudentId("");
                  setSelectedSpecialistYearGroup(event.target.value);
                  setSelectedSpecialistClass("");
                }}
                disabled={!students.length}
              >
                <option value="">All year groups</option>
                {specialistYearGroupOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {isSpecialistView ? (
            <div className="field">
              <label htmlFor="specialistClassFilter">Class</label>
              <select
                id="specialistClassFilter"
                value={selectedSpecialistClass}
                onChange={(event) => {
                  setSelectedStudentId("");
                  setSelectedSpecialistClass(event.target.value);
                }}
                disabled={!students.length}
              >
                <option value="">All classes</option>
                {specialistClassOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {usesSpecialistRegisters ? (
            <div className="field">
              <label htmlFor="specialistRegisterFilter">Specialist register</label>
              <select
                id="specialistRegisterFilter"
                value={selectedRegisterId}
                onChange={(event) => {
                  setSelectedStudentId("");
                  setSelectedRegisterId(event.target.value);
                }}
                disabled={!specialistRegisters.length}
              >
                {specialistRegisters.length ? null : <option value="">No registers saved yet</option>}
                {specialistRegisters.map((register) => (
                  <option key={register.id} value={register.id}>
                    {register.name} | {register.year_group} | {register.student_count} students
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="studentFilter">Student filter</label>
            <select
              id="studentFilter"
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              disabled={!linkedSubject}
            >
              <option value="">{isSpecialistView ? "Whole register" : "Whole class"}</option>
              {filteredStudents.map((student) => (
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
                <label htmlFor="assessmentMaxScore">Out of how many?</label>
                <input
                  id="assessmentMaxScore"
                  type="number"
                  min="1"
                  step="0.01"
                  value={newAssessmentMaxScore}
                  onChange={(event) => setNewAssessmentMaxScore(event.target.value)}
                  placeholder="e.g. 20"
                  disabled={!linkedSubject}
                />
              </div>
              <div className="field">
                <label htmlFor="assessmentTerm">Assignment term</label>
                <select
                  id="assessmentTerm"
                  value={newAssessmentTermKey}
                  onChange={(event) => setNewAssessmentTermKey(event.target.value)}
                  disabled={!linkedSubject}
                >
                  <option value="">Choose term</option>
                  {terms.map((term) => (
                    <option key={term.term_key} value={term.term_key}>
                      {term.term_label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="assessmentIncludeInTerm">Include in term grade?</label>
                <div className="hint" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <input
                    id="assessmentIncludeInTerm"
                    type="checkbox"
                    checked={newAssessmentIncludeInTerm}
                    onChange={(event) => setNewAssessmentIncludeInTerm(event.target.checked)}
                    disabled={!linkedSubject}
                  />
                  <span>Tick this if the assignment should count towards the term summary.</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="assessmentWeightingPercent">Weighting %</label>
                <input
                  id="assessmentWeightingPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={newAssessmentWeightingPercent}
                  onChange={(event) => setNewAssessmentWeightingPercent(event.target.value)}
                  placeholder="Leave blank to auto-balance"
                  disabled={!linkedSubject || !newAssessmentIncludeInTerm}
                />
              </div>
              <div className="field">
                <label>Assessment sheet</label>
                {editingAssessmentKey ? (
                  <div className="banner compact-banner" style={{ marginBottom: "0.75rem" }}>
                    Editing this assignment column. Save to apply the changes or cancel to go back to adding a new assignment.
                  </div>
                ) : null}
                <div className="actions" style={{ marginTop: 0 }}>
                  {canManageSetup ? (
                    <Link className="button secondary" href="/admin/gradebook">
                      Set Term Dates
                    </Link>
                  ) : null}
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void createAssessmentColumn()}
                  >
                    {editingAssessmentKey ? "Update Assignment Column" : "Add Assignment Column"}
                  </button>
                  {editingAssessmentKey ? (
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => resetAssessmentBuilderForm()}
                    >
                      Cancel Edit
                    </button>
                  ) : null}
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
            {isSpecialistView
              ? `Year group: ${selectedSpecialistYearGroup || "All year groups"} | Class: ${
                  selectedSpecialistClass || "All classes"
                }`
              : `Active class filter: ${activeFilters.className || "All classes"}`}
            {selectedSection ? ` | Section: ${selectedSection.name}` : ""}
            {usesSpecialistRegisters
              ? ` | Register: ${
                  specialistRegisters.find((register) => register.id === selectedRegisterId)?.name ?? "Not selected"
                }`
              : ""}
            {selectedStudentId
              ? ` | Student: ${
                  students.find((student) => student.school_id === selectedStudentId)?.full_name ??
                  "Selected"
                }`
              : " | Student: Whole class"}
          </span>
        </div>
        {usesSpecialistRegisters && !specialistRegisters.length ? (
          <div className="empty-state compact" style={{ marginTop: "1rem" }}>
            No specialist registers exist for this subject yet. Open Specialist Registers from the main Markbook page
            to create the first teaching group for this subject and year group.
          </div>
        ) : null}
        {selectedSection?.mode === "assessment" ? (
          <div className="breakdown-list" style={{ marginTop: "1rem" }}>
            {terms.map((term) => {
              const termCount = assessments.filter((assessment) => assessment.term_key === term.term_key).length;
              const isCollapsed = collapsedTerms[term.term_key] ?? false;
              return (
                <div className="breakdown-row" key={term.term_key}>
                  <span>
                    {term.term_label}
                    {term.start_date && term.end_date ? ` | ${term.start_date} to ${term.end_date}` : " | Dates not set"}
                  </span>
                  <div className="gradebook-term-summary-actions">
                    <strong>{termCount} assignment{termCount === 1 ? "" : "s"}</strong>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() =>
                        setCollapsedTerms((current) => ({
                          ...current,
                          [term.term_key]: !isCollapsed
                        }))
                      }
                    >
                      {isCollapsed ? "Expand" : "Collapse"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        {status ? <div className="banner">{status}</div> : null}
        {error ? <div className="banner error-banner">{error}</div> : null}
      </section>

      {!linkedSubject ? (
        renderSectionEmptyState()
      ) : (
        <section className="table-shell gradebook-table-shell">
          {selectedSection?.mode === "profile" ? (
            <div className="pastoral-shell">
              {renderProfileCards()}
              {!students.length && !isLoading ? (
                <div className="empty-state">
                  No students match the current filters. Choose a different filter or return to the
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
