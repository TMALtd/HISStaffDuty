import { getVisiblePortalViews, requirePortalAccess } from "@/lib/auth";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { GradebookAdmin } from "@/components/gradebook-admin";

export default async function GradebookAdminPage() {
  const { user, access } = await requirePortalAccess("setup");
  const visibleViews = await getVisiblePortalViews(access, true);

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
    </main>
  );
}
