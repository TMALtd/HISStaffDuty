import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { DutyDashboard } from "@/components/duty-dashboard";
import { getVisiblePortalViews, requirePortalAccess } from "@/lib/auth";
import { getDutyDashboardData } from "@/lib/data";

export default async function DutiesPage() {
  const { user, staffProfile, access } = await requirePortalAccess("duty");
  const visibleViews = await getVisiblePortalViews(access, access.isFullAccess);
  const data = await getDutyDashboardData(user.email ?? "");

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
      <PortalNav allowedViews={visibleViews} />
      <DutyDashboard data={data} />
    </main>
  );
}
