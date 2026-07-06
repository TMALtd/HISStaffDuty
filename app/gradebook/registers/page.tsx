import { getAccessPreviewSession, getVisiblePortalViews, requirePortalAccess } from "@/lib/auth";
import { getTimetablePreviewStaffOptions } from "@/lib/data";
import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SpecialistRegisterManager } from "@/components/specialist-register-manager";

type SpecialistRegistersPageProps = {
  searchParams?: {
    viewAs?: string;
    yearGroup?: string;
    subjectId?: string;
  };
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SpecialistRegistersPage({ searchParams }: SpecialistRegistersPageProps) {
  const session = await requirePortalAccess("gradebook");
  const { user, access } = session;
  const preview = await getAccessPreviewSession(session, searchParams?.viewAs);
  const [previewOptions, visibleViews] = await Promise.all([
    access.isFullAccess ? getTimetablePreviewStaffOptions() : Promise.resolve([]),
    getVisiblePortalViews(preview.activeAccess, access.isFullAccess && !preview.isPreviewing)
  ]);

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
      <SpecialistRegisterManager
        previewEmail={preview.previewEmail}
        initialYearGroup={searchParams?.yearGroup ?? null}
        initialSubjectId={searchParams?.subjectId ?? null}
      />
    </main>
  );
}
