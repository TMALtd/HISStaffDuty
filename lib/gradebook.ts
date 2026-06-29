import type {
  GradebookSectionDefinition,
  GradebookSectionSettingsInput,
  GradebookSectionSlug,
  GradebookSubject,
  GradebookWorkspaceSection
} from "@/lib/types";

const SECTION_DEFINITIONS: GradebookSectionDefinition[] = [
  {
    slug: "pastoral",
    name: "Pastoral",
    mode: "profile",
    description: "Behaviour, wellbeing, attitude to learning, and pastoral notes.",
    recommendedPageName: "Student Pastoral",
    emptyStateTitle: "Pastoral profile not configured yet",
    emptyStateCopy:
      "Create a gradebook page called Student Pastoral so teachers can update student pastoral information in the new profile area.",
    fieldOrder: [
      "student_gender",
      "behaviour_concerns",
      "social_emotional_concerns",
      "attitude_towards_learning",
      "confidential_parent_issues",
      "personal_character",
      "certificates_given",
      "supporting_notes"
    ]
  },
  {
    slug: "learning-support",
    name: "Learning Support",
    mode: "profile",
    description: "SEN, reading support, EAL support, and targeted notes.",
    recommendedPageName: "Learning Support",
    emptyStateTitle: "Learning Support profile not configured yet",
    emptyStateCopy:
      "Create a gradebook page called Learning Support so staff can capture SEN, EAL, and reading support information in one place."
  },
  {
    slug: "ptms",
    name: "PTMs",
    mode: "profile",
    description: "Termly parent-teacher meeting notes by student.",
    recommendedPageName: "PTMs",
    emptyStateTitle: "PTM notes page not configured yet",
    emptyStateCopy:
      "Create a gradebook page called PTMs so teachers can record discussion notes for each term."
  },
  {
    slug: "phonics",
    name: "Phonics",
    mode: "assessment",
    description: "Half-termly phonics checks, OTJ, effort, and final judgement.",
    recommendedPageName: "Phonics",
    emptyStateTitle: "Phonics assessment page not configured yet",
    emptyStateCopy:
      "Create a gradebook page called Phonics to start recording phonics assessment points for this class."
  },
  {
    slug: "reading",
    name: "Reading",
    mode: "assessment",
    description: "Reading assessments, benchmarks, OTJ, and age-related tracking.",
    recommendedPageName: "Reading",
    emptyStateTitle: "Reading assessment page not configured yet",
    emptyStateCopy:
      "Create a gradebook page called Reading to capture benchmark and teacher judgement data."
  },
  {
    slug: "writing",
    name: "Writing",
    mode: "assessment",
    description: "Writing tasks, rubric scores, grades, and term outcomes.",
    recommendedPageName: "Writing",
    emptyStateTitle: "Writing assessment page not configured yet",
    emptyStateCopy:
      "Create a gradebook page called Writing to record rubric-based writing outcomes."
  },
  {
    slug: "maths",
    name: "Maths",
    mode: "assessment",
    description: "Raw score entry, total score, percentages, OTJ, and effort.",
    recommendedPageName: "Maths",
    emptyStateTitle: "Maths assessment page not configured yet",
    emptyStateCopy:
      "Create a gradebook page called Maths so teachers can enter unit and test results for the class."
  },
  {
    slug: "ipc",
    name: "IPC",
    mode: "assessment",
    description: "Topic-based assessment criteria, effort, and teacher judgement.",
    recommendedPageName: "IPC",
    emptyStateTitle: "IPC assessment page not configured yet",
    emptyStateCopy:
      "Create a gradebook page called IPC to record learning-goal and success-criteria outcomes."
  }
];

function normalizeGradebookLabel(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getGradebookSectionDefinitions(): GradebookSectionDefinition[] {
  return SECTION_DEFINITIONS;
}

export function mergeGradebookSectionDefinitions(
  overrides: GradebookSectionSettingsInput[] = []
): GradebookSectionDefinition[] {
  const overrideLookup = new Map(overrides.map((override) => [override.slug, override]));

  return SECTION_DEFINITIONS.map((definition) => {
    const override = overrideLookup.get(definition.slug);
    if (!override) {
      return definition;
    }

    return {
      ...definition,
      name: override.name,
      description: override.description,
      recommendedPageName: override.recommendedPageName,
      emptyStateTitle: override.emptyStateTitle,
      emptyStateCopy: override.emptyStateCopy
    };
  });
}

export function resolveGradebookSectionSlug(
  subject: Pick<GradebookSubject, "slug" | "name">
): GradebookSectionSlug | null {
  const slug = normalizeGradebookLabel(subject.slug);
  const name = normalizeGradebookLabel(subject.name);
  const combined = `${slug} ${name}`.trim();

  if (slug === "student-pastoral" || combined.includes("student pastoral")) {
    return "pastoral";
  }
  if (combined.includes("learning support")) {
    return "learning-support";
  }
  if (slug === "ptms" || combined.includes("ptm")) {
    return "ptms";
  }
  if (combined.includes("phonics")) {
    return "phonics";
  }
  if (combined.includes("reading")) {
    return "reading";
  }
  if (combined.includes("writing")) {
    return "writing";
  }
  if (combined.includes("math")) {
    return "maths";
  }
  if (combined.includes("ipc")) {
    return "ipc";
  }

  return null;
}

export function buildGradebookWorkspaceSections(
  subjects: GradebookSubject[],
  definitions: GradebookSectionDefinition[] = SECTION_DEFINITIONS
): GradebookWorkspaceSection[] {
  const firstSubjectBySection = new Map<GradebookSectionSlug, GradebookSubject>();

  for (const subject of subjects) {
    const sectionSlug = resolveGradebookSectionSlug(subject);
    if (!sectionSlug || firstSubjectBySection.has(sectionSlug)) {
      continue;
    }
    firstSubjectBySection.set(sectionSlug, subject);
  }

  return definitions.map((section) => {
    const subject = firstSubjectBySection.get(section.slug) ?? null;
    return {
      ...section,
      subject,
      isConfigured: Boolean(subject)
    };
  });
}
