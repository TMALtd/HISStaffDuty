import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { DutyDashboard } from "@/components/duty-dashboard";
import { requireStaffProfile } from "@/lib/auth";
import { getDutyDashboardData } from "@/lib/data";

export default async function DutiesPage() {
  const { user, staffProfile } = await requireStaffProfile();
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
      <PortalNav />
      <DutyDashboard data={data} />
    </main>
  );
}
