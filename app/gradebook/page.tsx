import { requirePortalAccess } from "@/lib/auth";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { GradebookWorkspace } from "@/components/gradebook-workspace";

type GradebookPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

function toStringValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function GradebookPage({ searchParams }: GradebookPageProps) {
  const { user, access } = await requirePortalAccess("gradebook");

  return (
    <main className="page-shell">
      <section className="portal-toolbar">
        <div>
          <p className="eyebrow">HELP staff workspace</p>
          <p className="meta">Signed in as {user.email ?? "staff user"}</p>
        </div>
        <SignOutButton />
      </section>
      <PortalNav allowedViews={access.allowedViews} />
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
