import { requirePortalAccess } from "@/lib/auth";
import { PortalNav } from "@/components/portal-nav";
import { StaffDashboard } from "@/components/staff-dashboard";
import { SignOutButton } from "@/components/sign-out-button";
import { getPortalHeroSettings, getStudentAcademicYears } from "@/lib/data";

export default async function HomePage() {
  const { user, access } = await requirePortalAccess("student-filter");
  const academicYears = access.isFullAccess ? await getStudentAcademicYears() : [];
  const heroSettings =
    (await getPortalHeroSettings()).find((setting) => setting.pageKey === "student-filter") ?? null;

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
      <StaffDashboard canManageRosterYears={access.isFullAccess} academicYears={academicYears} />
    </main>
  );
}
