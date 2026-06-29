import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { StaffDirectory } from "@/components/staff-directory";
import { requirePortalAccess } from "@/lib/auth";
import {
  getPortalHeroSettings,
  getStaffDirectoryClassOptions,
  getStaffDirectoryData
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const { user, staffProfile, access } = await requirePortalAccess("directory");
  const [staff, classOptions, heroSettings] = await Promise.all([
    getStaffDirectoryData(),
    getStaffDirectoryClassOptions(),
    getPortalHeroSettings()
  ]);
  const activeHero =
    heroSettings.find((setting) => setting.pageKey === "staff-directory") ?? null;

  return (
    <main className="page-shell">
      <section className="portal-toolbar">
        <div>
          <p className="eyebrow">HELP staff workspace</p>
          <p className="meta">
            Signed in as {staffProfile?.name ?? user.email ?? "staff user"}
          </p>
        </div>
        <SignOutButton />
      </section>
      <PortalNav allowedViews={access.allowedViews} />
      <StaffDirectory
        staff={staff}
        classOptions={classOptions}
        showAdminGuidance={access.isFullAccess}
        heroSettings={activeHero}
      />
    </main>
  );
}
