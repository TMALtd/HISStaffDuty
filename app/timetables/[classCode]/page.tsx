import { requireUser } from "@/lib/auth";
import { getTimetableBuilderData } from "@/lib/data";
import { PortalNav } from "@/components/portal-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { TimetableBuilder } from "@/components/timetable-builder";

type TimetableBuilderPageProps = {
  params: {
    classCode: string;
  };
};

export default async function TimetableBuilderPage({ params }: TimetableBuilderPageProps) {
  const user = await requireUser();
  const data = await getTimetableBuilderData(decodeURIComponent(params.classCode));

  return (
    <main className="page-shell">
      <section className="portal-toolbar">
        <div>
          <p className="eyebrow">HELP staff workspace</p>
          <p className="meta">Signed in as {user.email ?? "staff user"}</p>
        </div>
        <SignOutButton />
      </section>
      <PortalNav />
      <TimetableBuilder initialData={data} />
    </main>
  );
}
