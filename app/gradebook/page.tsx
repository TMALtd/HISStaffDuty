import Link from "next/link";
import { getAccessPreviewSession, requirePortalAccess } from "@/lib/auth";
import { getPortalHeroSettings, getTimetablePreviewStaffOptions } from "@/lib/data";
import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
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
  const session = await requirePortalAccess("gradebook");
  const { user, access } = session;
  const previewEmail = toStringValue(searchParams.viewAs);
  const preview = await getAccessPreviewSession(session, previewEmail);
  const previewOptions = access.isFullAccess ? await getTimetablePreviewStaffOptions() : [];
  const heroSettings =
    (await getPortalHeroSettings()).find((setting) => setting.pageKey === "markbook") ?? null;
  const activeClassName =
    !preview.activeAccess.isFullAccess
      ? preview.activeProfile?.class || preview.activeProfile?.timetable || ""
      : toStringValue(searchParams.className);

  return (
    <main className="page-shell">
      <section className="portal-toolbar">
        <div>
          <p className="eyebrow">HELP staff workspace</p>
          <p className="meta">Signed in as {user.email ?? "staff user"}</p>
          {preview.isPreviewing ? (
            <p className="meta">
              Viewing as {preview.activeProfile?.name ?? preview.previewEmail} ({preview.activeAccess.roleLabel})
            </p>
          ) : null}
        </div>
        {access.isFullAccess ? (
          <AccessPreviewSwitcher options={previewOptions} selectedEmail={preview.previewEmail} />
        ) : null}
        <SignOutButton />
      </section>
      <PortalNav allowedViews={preview.activeAccess.allowedViews} />
      <section className="panel mi-card">
        <div>
          <p className="eyebrow">Specialist Registers</p>
          <h2 className="mi-title">Build specialist teaching groups by year group</h2>
          <p className="compact-copy">
            Specialist teachers can create their own year-group registers here before those groups are connected into
            the markbook workflow.
          </p>
        </div>
        <div className="actions">
          <Link
            className="button secondary"
            href={preview.previewEmail ? `/gradebook/registers?viewAs=${encodeURIComponent(preview.previewEmail)}` : "/gradebook/registers"}
          >
            Open Specialist Registers
          </Link>
        </div>
      </section>
      <GradebookWorkspace
        canManageAssignments={access.isFullAccess && !preview.isPreviewing}
        canManageSetup={access.isFullAccess && !preview.isPreviewing}
        previewEmail={preview.previewEmail}
        heroSettings={heroSettings}
        initialFilters={{
          school: toStringValue(searchParams.school),
          designation: toStringValue(searchParams.designation),
          yearGroup: toStringValue(searchParams.yearGroup),
          milepost: toStringValue(searchParams.milepost),
          level: toStringValue(searchParams.level),
          className: activeClassName
        }}
      />
    </main>
  );
}
