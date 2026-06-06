import { redirect } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth";
import { getTimetableBuilderData } from "@/lib/data";
import { canAccessTimetableClass } from "@/lib/access";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { TimetableBuilder } from "@/components/timetable-builder";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TimetableBuilderPageProps = {
  params: {
    classCode: string;
  };
};

export default async function TimetableBuilderPage({ params }: TimetableBuilderPageProps) {
  const { user, access } = await requirePortalAccess("timetables");
  const data = await getTimetableBuilderData(decodeURIComponent(params.classCode));

  if (!canAccessTimetableClass(access, data.classSummary)) {
    redirect("/timetables");
  }

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
      <TimetableBuilder initialData={data} />
    </main>
  );
}
