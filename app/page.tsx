import { getAccessPreviewSession, requirePortalAccess } from "@/lib/auth";
import { PortalNav } from "@/components/portal-nav";
import { StaffDashboard } from "@/components/staff-dashboard";
import { SignOutButton } from "@/components/sign-out-button";
import { PortalPageAccessPanel } from "@/components/portal-page-access-panel";
import {
  getPortalHeroSettings,
  getPortalPageAccessSettings,
  getStudentAcademicYears,
  getStudentRosterClassOptions,
  getTimetablePreviewStaffOptions
} from "@/lib/data";
import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
import { getVisiblePortalViews } from "@/lib/auth";

type HomePageProps = {
  searchParams?: {
    viewAs?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await requirePortalAccess("student-filter");
  const { user, access } = session;
  const preview = await getAccessPreviewSession(session, searchParams?.viewAs);
  const [academicYears, classOptions, previewOptions, pageAccessSettings, visibleViews] = await Promise.all([
    access.isFullAccess && !preview.isPreviewing ? getStudentAcademicYears() : Promise.resolve([]),
    access.isFullAccess && !preview.isPreviewing ? getStudentRosterClassOptions() : Promise.resolve([]),
    access.isFullAccess ? getTimetablePreviewStaffOptions() : Promise.resolve([]),
    access.isFullAccess && !preview.isPreviewing ? getPortalPageAccessSettings() : Promise.resolve([]),
    getVisiblePortalViews(preview.activeAccess, access.isFullAccess && !preview.isPreviewing)
  ]);
  const heroSettings =
    (await getPortalHeroSettings()).find((setting) => setting.pageKey === "student-filter") ?? null;

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
      <PortalNav allowedViews={visibleViews} />
      <section className="hero-card">
        <p className="eyebrow">{heroSettings?.eyebrow ?? "Render-ready staff workspace"}</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">{heroSettings?.title ?? "Student filter portal"}</h1>
            <p className="hero-copy">
              {heroSettings?.description ??
                "Narrow the roster from school all the way down to class, then review the matching students in one place."}
            </p>
          </div>
        </div>
      </section>
      {access.isFullAccess && !preview.isPreviewing ? (
        <PortalPageAccessPanel initialSettings={pageAccessSettings} />
      ) : null}
      <StaffDashboard
        canManageRosterYears={access.isFullAccess && !preview.isPreviewing}
        academicYears={academicYears}
        classOptions={classOptions}
        previewEmail={preview.previewEmail}
      />
    </main>
  );
}
