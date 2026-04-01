"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LoginFormProps = {
  message?: string;
};

export function LoginForm({ message }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(message ?? "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (authError) {
      setError(authError.message);
      setIsSubmitting(false);
      return;
    }

    setStatus("Magic link sent. Check your email to continue.");
    setEmail("");
    setIsSubmitting(false);
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">Staff Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@school.edu"
          required
        />
      </div>
      <div className="actions">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Sending..." : "Send Magic Link"}
        </button>
      </div>
      {status ? <div className="banner">{status}</div> : null}
      {error ? <div className="banner error-banner">{error}</div> : null}
    </form>
  );
}
