import { getVisiblePortalViews, requirePortalAccess } from "@/lib/auth";
import { getPortalPageAccessSettings } from "@/lib/data";
import { PortalPageAccessPanel } from "@/components/portal-page-access-panel";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { GradebookAdmin } from "@/components/gradebook-admin";

export default async function GradebookAdminPage() {
  const { user, access } = await requirePortalAccess("setup");
  const [visibleViews, pageAccessSettings] = await Promise.all([
    getVisiblePortalViews(access, true),
    getPortalPageAccessSettings()
  ]);

  return (
    <main className="page-shell">
      <section className="portal-toolbar">
        <div>
          <p className="eyebrow">HELP staff workspace</p>
          <p className="meta">Signed in as {user.email ?? "staff user"}</p>
        </div>
        <SignOutButton />
      </section>
      <PortalNav allowedViews={visibleViews} />
      <GradebookAdmin />
      <PortalPageAccessPanel initialSettings={pageAccessSettings} />
    </main>
  );
}
