import type {
  GradebookSectionDefinition,
  GradebookSectionSettingsInput,
  GradebookSectionSlug,
  GradebookSubject,
  GradebookWorkspaceSection
} from "@/lib/types";

const STUDENT_PROFILE_GROUP = {
  groupKey: "student-profile" as const,
  groupLabel: "Student Profile",
  groupOrder: 1
};

const ASSESSMENT_GROUP = {
  groupKey: "assessment" as const,
  groupLabel: "Assessment",
  groupOrder: 2
};

const SECTION_DEFINITIONS: GradebookSectionDefinition[] = [
  {
    slug: "pastoral",
    ...STUDENT_PROFILE_GROUP,
    cardOrder: 1,
    name: "Pastoral Notes",
    mode: "profile",
    description: "Behaviour, wellbeing, attitude to learning, and pastoral notes.",
    recommendedPageName: "Student Pastoral",
    emptyStateTitle: "Pastoral notes page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Student Pastoral so teachers can update student pastoral information in one place.",
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
    ...STUDENT_PROFILE_GROUP,
    cardOrder: 2,
    name: "Learning Support",
    mode: "profile",
    description: "SEN, reading support, EAL support, and targeted notes.",
    recommendedPageName: "Learning Support",
    emptyStateTitle: "Learning Support page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Learning Support so staff can capture SEN, EAL, and reading support information in one place."
  },
  {
    slug: "ptms",
    ...STUDENT_PROFILE_GROUP,
    cardOrder: 3,
    name: "PTM Notes",
    mode: "profile",
    description: "Termly parent-teacher meeting notes by student.",
    recommendedPageName: "PTMs",
    emptyStateTitle: "PTM notes page not configured yet",
    emptyStateCopy:
      "Create a markbook page called PTMs so teachers can record parent-teacher meeting notes for each term."
  },
  {
    slug: "english",
    ...ASSESSMENT_GROUP,
    cardOrder: 1,
    name: "English",
    mode: "assessment",
    description: "Assessment results, classwork evidence, teacher judgement, and term outcomes.",
    recommendedPageName: "English",
    emptyStateTitle: "English assessment page not configured yet",
    emptyStateCopy:
      "Create a markbook page called English so teachers can capture English assessment evidence for this class."
  },
  {
    slug: "reading",
    ...ASSESSMENT_GROUP,
    cardOrder: 2,
    name: "Reading",
    mode: "assessment",
    description: "Reading assessments, benchmarks, OTJ, and age-related tracking.",
    recommendedPageName: "Reading",
    emptyStateTitle: "Reading assessment page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Reading to capture benchmark and teacher judgement data."
  },
  {
    slug: "writing",
    ...ASSESSMENT_GROUP,
    cardOrder: 3,
    name: "Writing",
    mode: "assessment",
    description: "Writing tasks, rubric scores, grades, and term outcomes.",
    recommendedPageName: "Writing",
    emptyStateTitle: "Writing assessment page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Writing to record rubric-based writing outcomes."
  },
  {
    slug: "maths",
    ...ASSESSMENT_GROUP,
    cardOrder: 4,
    name: "Maths",
    mode: "assessment",
    description: "Raw score entry, total score, percentages, OTJ, and effort.",
    recommendedPageName: "Maths",
    emptyStateTitle: "Maths assessment page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Maths so teachers can enter unit and test results for the class."
  },
  {
    slug: "ipc",
    ...ASSESSMENT_GROUP,
    cardOrder: 5,
    name: "IPC",
    mode: "assessment",
    description: "Topic-based assessment criteria, effort, and teacher judgement.",
    recommendedPageName: "IPC",
    emptyStateTitle: "IPC assessment page not configured yet",
    emptyStateCopy:
      "Create a markbook page called IPC to record learning-goal and success-criteria outcomes."
  },
  {
    slug: "ieyc",
    ...ASSESSMENT_GROUP,
    cardOrder: 6,
    name: "IEYC",
    mode: "assessment",
    description: "Preschool inquiry outcomes, observations, and teacher judgement.",
    recommendedPageName: "IEYC",
    emptyStateTitle: "IEYC assessment page not configured yet",
    emptyStateCopy:
      "Create a markbook page called IEYC to track preschool inquiry and developmental outcomes."
  },
  {
    slug: "phonics",
    ...ASSESSMENT_GROUP,
    cardOrder: 7,
    name: "Phonics",
    mode: "assessment",
    description: "Lower-primary phonics checks, OTJ, effort, and final judgement.",
    recommendedPageName: "Phonics",
    emptyStateTitle: "Phonics assessment page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Phonics to start recording phonics assessment points for this class."
  },
  {
    slug: "science",
    ...ASSESSMENT_GROUP,
    cardOrder: 8,
    name: "Science",
    mode: "assessment",
    description: "Upper-primary science tasks, investigations, and final judgement.",
    recommendedPageName: "Science",
    emptyStateTitle: "Science assessment page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Science so teachers can capture science assessment evidence for upper primary."
  },
  {
    slug: "spelling",
    ...ASSESSMENT_GROUP,
    cardOrder: 9,
    name: "Spelling",
    mode: "assessment",
    description: "Weekly or unit spelling tests, scores, and teacher judgement.",
    recommendedPageName: "Spelling",
    emptyStateTitle: "Spelling assessment page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Spelling to track spelling assessments across MP2 and MP3."
  },
  {
    slug: "design-technology",
    ...ASSESSMENT_GROUP,
    cardOrder: 10,
    name: "Design & Technology",
    mode: "assessment",
    description: "Design tasks, practical outcomes, and teacher judgement for MP3.",
    recommendedPageName: "Design & Technology",
    emptyStateTitle: "Design & Technology page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Design & Technology to record MP3 DT assessment outcomes."
  },
  {
    slug: "mandarin-writing",
    ...ASSESSMENT_GROUP,
    cardOrder: 11,
    name: "Mandarin Writing",
    mode: "assessment",
    description: "Bilingual writing tasks, rubric outcomes, and final judgement.",
    recommendedPageName: "Mandarin Writing",
    emptyStateTitle: "Mandarin Writing page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Mandarin Writing to track bilingual writing outcomes."
  },
  {
    slug: "mandarin-reading",
    ...ASSESSMENT_GROUP,
    cardOrder: 12,
    name: "Mandarin Reading",
    mode: "assessment",
    description: "Bilingual reading checks, comprehension, fluency, and teacher judgement.",
    recommendedPageName: "Mandarin Reading",
    emptyStateTitle: "Mandarin Reading page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Mandarin Reading to track bilingual reading outcomes."
  },
  {
    slug: "mandarin-speaking-listening",
    ...ASSESSMENT_GROUP,
    cardOrder: 13,
    name: "Mandarin Speaking & Listening",
    mode: "assessment",
    description: "Bilingual speaking and listening evidence, oral tasks, and teacher judgement.",
    recommendedPageName: "Mandarin Speaking & Listening",
    emptyStateTitle: "Mandarin Speaking & Listening page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Mandarin Speaking & Listening to capture oral-language assessment evidence."
  },
  {
    slug: "mandarin",
    ...ASSESSMENT_GROUP,
    cardOrder: 14,
    name: "Mandarin",
    mode: "assessment",
    description: "Specialist Mandarin assessments, performance, and teacher judgement.",
    recommendedPageName: "Mandarin",
    emptyStateTitle: "Mandarin specialist page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Mandarin so specialist teachers can track assessments and outcomes."
  },
  {
    slug: "bm",
    ...ASSESSMENT_GROUP,
    cardOrder: 15,
    name: "BM",
    mode: "assessment",
    description: "Bahasa Melayu specialist assessments, performance, and teacher judgement.",
    recommendedPageName: "BM",
    emptyStateTitle: "BM specialist page not configured yet",
    emptyStateCopy:
      "Create a markbook page called BM so specialist teachers can track assessments and outcomes."
  },
  {
    slug: "pe",
    ...ASSESSMENT_GROUP,
    cardOrder: 16,
    name: "P.E.",
    mode: "assessment",
    description: "Physical education skills, performance checkpoints, and teacher judgement.",
    recommendedPageName: "P.E.",
    emptyStateTitle: "P.E. specialist page not configured yet",
    emptyStateCopy:
      "Create a markbook page called P.E. so specialist teachers can record physical education outcomes."
  },
  {
    slug: "music",
    ...ASSESSMENT_GROUP,
    cardOrder: 17,
    name: "Music",
    mode: "assessment",
    description: "Music performance, theory, practical outcomes, and teacher judgement.",
    recommendedPageName: "Music",
    emptyStateTitle: "Music specialist page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Music so specialist teachers can record music outcomes."
  },
  {
    slug: "steam-coding",
    ...ASSESSMENT_GROUP,
    cardOrder: 18,
    name: "STEAM / Coding",
    mode: "assessment",
    description: "STEAM and coding tasks, projects, and specialist teacher judgement.",
    recommendedPageName: "STEAM / Coding",
    emptyStateTitle: "STEAM / Coding page not configured yet",
    emptyStateCopy:
      "Create a markbook page called STEAM / Coding to record specialist project outcomes."
  },
  {
    slug: "eal",
    ...ASSESSMENT_GROUP,
    cardOrder: 19,
    name: "EAL",
    mode: "assessment",
    description: "English as an Additional Language support targets, progress, and outcomes.",
    recommendedPageName: "EAL",
    emptyStateTitle: "EAL page not configured yet",
    emptyStateCopy:
      "Create a markbook page called EAL to capture targeted language-support outcomes."
  },
  {
    slug: "maths-support",
    ...ASSESSMENT_GROUP,
    cardOrder: 20,
    name: "Maths Support",
    mode: "assessment",
    description: "Support targets, intervention checks, and maths progress notes.",
    recommendedPageName: "Maths Support",
    emptyStateTitle: "Maths Support page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Maths Support to capture intervention outcomes and progress."
  },
  {
    slug: "reading-support",
    ...ASSESSMENT_GROUP,
    cardOrder: 21,
    name: "Reading Support",
    mode: "assessment",
    description: "Reading-support targets, intervention checks, and progress notes.",
    recommendedPageName: "Reading Support",
    emptyStateTitle: "Reading Support page not configured yet",
    emptyStateCopy:
      "Create a markbook page called Reading Support to capture intervention outcomes and progress."
  },
  {
    slug: "sen",
    ...ASSESSMENT_GROUP,
    cardOrder: 22,
    name: "SEN",
    mode: "assessment",
    description: "Special educational needs targets, provision notes, and outcomes.",
    recommendedPageName: "SEN",
    emptyStateTitle: "SEN page not configured yet",
    emptyStateCopy:
      "Create a markbook page called SEN to capture support targets, provision, and outcomes."
  }
];

function normalizeGradebookLabel(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function compactGradebookLabel(value: string | null | undefined) {
  return normalizeGradebookLabel(value).replace(/[^a-z0-9]+/g, "");
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
  const slugCompact = compactGradebookLabel(subject.slug);
  const nameCompact = compactGradebookLabel(subject.name);
  const combinedCompact = `${slugCompact} ${nameCompact}`.trim();

  if (
    slug === "student-pastoral" ||
    slugCompact === "studentpastoral" ||
    combined.includes("student pastoral") ||
    combinedCompact.includes("studentpastoral")
  ) {
    return "pastoral";
  }
  if (combined.includes("learning support") || combinedCompact.includes("learningsupport")) {
    return "learning-support";
  }
  if (slug === "ptms" || slugCompact === "ptms" || nameCompact === "ptms" || combined.includes("ptm")) {
    return "ptms";
  }
  if (combined.includes("english")) {
    return "english";
  }
  if (combined.includes("phonics")) {
    return "phonics";
  }
  if (combined.includes("science")) {
    return "science";
  }
  if (combined.includes("spelling")) {
    return "spelling";
  }
  if (
    combined.includes("design & technology") ||
    combined.includes("design and technology") ||
    combined.includes("design technology") ||
    combined === "dt" ||
    slugCompact === "dt" ||
    nameCompact === "dt" ||
    combinedCompact.includes("designtechnology")
  ) {
    return "design-technology";
  }
  if (combined.includes("mandarin writing")) {
    return "mandarin-writing";
  }
  if (combined.includes("mandarin reading")) {
    return "mandarin-reading";
  }
  if (
    combined.includes("mandarin speaking") ||
    combined.includes("mandarin listening") ||
    combined.includes("speaking & listening") ||
    combined.includes("speaking and listening")
  ) {
    return "mandarin-speaking-listening";
  }
  if (combined.includes("reading support")) {
    return "reading-support";
  }
  if (combined.includes("maths support") || combined.includes("math support")) {
    return "maths-support";
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
  if (combined.includes("ieyc")) {
    return "ieyc";
  }
  if (combined === "mandarin" || name === "mandarin" || slugCompact === "mandarin" || nameCompact === "mandarin") {
    return "mandarin";
  }
  if (combined === "bm" || slugCompact === "bm" || nameCompact === "bm" || combined.includes("bahasa melayu")) {
    return "bm";
  }
  if (
    combined === "p.e." ||
    combined === "pe" ||
    slugCompact === "pe" ||
    nameCompact === "pe" ||
    combined.includes("physical education") ||
    combinedCompact.includes("physicaleducation")
  ) {
    return "pe";
  }
  if (combined === "music" || slugCompact === "music" || nameCompact === "music" || combined.includes("music")) {
    return "music";
  }
  if (
    combined.includes("steam") ||
    combined.includes("coding") ||
    combinedCompact.includes("steam") ||
    combinedCompact.includes("coding")
  ) {
    return "steam-coding";
  }
  if (combined === "eal" || slugCompact === "eal" || nameCompact === "eal" || combined.includes("additional language")) {
    return "eal";
  }
  if (
    combined === "sen" ||
    combined === "senco" ||
    slugCompact === "sen" ||
    slugCompact === "senco" ||
    nameCompact === "sen" ||
    nameCompact === "senco" ||
    combined.includes("special educational")
  ) {
    return "sen";
  }

  return null;
}

export function deriveGradebookSubjectSlug(name: string) {
  const fallbackSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return resolveGradebookSectionSlug({ slug: fallbackSlug, name }) ?? fallbackSlug;
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

  return definitions
    .map((section) => {
      const subject = firstSubjectBySection.get(section.slug) ?? null;
      return {
        ...section,
        subject,
        isConfigured: Boolean(subject)
      };
    })
    .sort(
      (left, right) =>
        left.groupOrder - right.groupOrder || left.cardOrder - right.cardOrder || left.name.localeCompare(right.name)
    );
}
