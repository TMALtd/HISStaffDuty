import { requireUser } from "@/lib/auth";
import { StaffDashboard } from "@/components/staff-dashboard";
import { SignOutButton } from "@/components/sign-out-button";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Render-ready staff workspace</p>
        <div className="topbar">
          <div>
            <h1 className="hero-title">Student filter portal</h1>
            <p className="hero-copy">
              Narrow the roster from school all the way down to class, then review the
              matching students in one place.
            </p>
          </div>
          <SignOutButton />
        </div>
        <p className="meta">Signed in as {user.email ?? "staff user"}</p>
      </section>
      <StaffDashboard />
    </main>
  );
}
