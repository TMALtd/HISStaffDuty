import { requireUser } from "@/lib/auth";
import { GradebookAdmin } from "@/components/gradebook-admin";

export default async function GradebookAdminPage() {
  await requireUser();

  return (
    <main className="page-shell">
      <GradebookAdmin />
    </main>
  );
}
