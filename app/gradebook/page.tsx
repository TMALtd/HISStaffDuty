import { requireUser } from "@/lib/auth";
import { GradebookWorkspace } from "@/components/gradebook-workspace";

type GradebookPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

function toStringValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function GradebookPage({ searchParams }: GradebookPageProps) {
  await requireUser();

  return (
    <main className="page-shell">
      <GradebookWorkspace
        initialFilters={{
          school: toStringValue(searchParams.school),
          designation: toStringValue(searchParams.designation),
          yearGroup: toStringValue(searchParams.yearGroup),
          milepost: toStringValue(searchParams.milepost),
          level: toStringValue(searchParams.level),
          className: toStringValue(searchParams.className)
        }}
      />
    </main>
  );
}
