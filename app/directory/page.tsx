import { AccessPreviewSwitcher } from "@/components/access-preview-switcher";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { StaffDirectory } from "@/components/staff-directory";
import { getAccessPreviewSession, getVisiblePortalViews, requirePortalAccess } from "@/lib/auth";
import {
  getPortalHeroSettings,
  getStaffDirectoryClassOptions,
  getStaffDirectoryData,
  getTimetablePreviewStaffOptions
} from "@/lib/data";

export const dynamic = "force-dynamic";

type DirectoryPageProps = {
  searchParams?: {
    viewAs?: string;
  };
};

export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  const session = await requirePortalAccess("directory");
  const { user, access } = session;
  const preview = await getAccessPreviewSession(session, searchParams?.viewAs);
  const [staff, classOptions, heroSettings, previewOptions, visibleViews] = await Promise.all([
    getStaffDirectoryData(),
    getStaffDirectoryClassOptions(),
    getPortalHeroSettings(),
    access.isFullAccess ? getTimetablePreviewStaffOptions() : Promise.resolve([]),
    getVisiblePortalViews(preview.activeAccess, access.isFullAccess && !preview.isPreviewing)
  ]);
  const activeHero =
    heroSettings.find((setting) => setting.pageKey === "staff-directory") ?? null;

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
      <StaffDirectory
        staff={staff}
        classOptions={classOptions}
        showAdminGuidance={access.isFullAccess && !preview.isPreviewing}
        canManageStaff={access.isFullAccess && !preview.isPreviewing}
        heroSettings={activeHero}
      />
    </main>
  );
}
