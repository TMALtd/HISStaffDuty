import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: {
    message?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="login-shell">
      <section className="hero-card login-card">
        <p className="eyebrow">Private staff access</p>
        <h1 className="hero-title">Sign in to the roster portal</h1>
        <p className="hero-copy">
          Use your staff email to receive a magic link. Once signed in, you can filter by
          school, designation, year group, milepost, level, and class.
        </p>
        <LoginForm message={searchParams.message} />
      </section>
    </main>
  );
}
