"use client";

import { useState } from "react";
import { getSupabaseBrowserEnvError, hasSupabaseBrowserEnv } from "@/lib/supabase/config";

type LoginFormProps = {
  message?: string;
};

export function LoginForm({ message }: LoginFormProps) {
  const [status, setStatus] = useState(message ?? "");
  const [error, setError] = useState("");
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false);
  const [isSubmittingMagicLink, setIsSubmittingMagicLink] = useState(false);
  const [email, setEmail] = useState("");
  const isSupabaseConfigured = hasSupabaseBrowserEnv();

  function handleGoogleSignIn() {
    setError("");
    setStatus("");

    if (!isSupabaseConfigured) {
      setError(getSupabaseBrowserEnvError());
      return;
    }

    setIsSubmittingGoogle(true);
    window.location.href = "/auth/google";
  }

  function handleMagicLinkSubmit(event: React.FormEvent<HTMLFormElement>) {
    setError("");
    setStatus("");

    if (!isSupabaseConfigured) {
      event.preventDefault();
      setError(getSupabaseBrowserEnvError());
      return;
    }

    setIsSubmittingMagicLink(true);
  }

  return (
    <div className="panel">
      <div className="actions" style={{ marginTop: 0 }}>
        <button
          className="button"
          disabled={isSubmittingGoogle || !isSupabaseConfigured}
          type="button"
          onClick={handleGoogleSignIn}
        >
          {isSubmittingGoogle ? "Redirecting..." : "Sign In With Google"}
        </button>
      </div>
      <p className="hint">Use your staff Google account for the smoothest sign-in flow.</p>
      <form action="/auth/magic-link" method="post" onSubmit={handleMagicLinkSubmit}>
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
            disabled={!isSupabaseConfigured}
          />
        </div>
        <div className="actions">
          <button
            className="button secondary"
            disabled={isSubmittingMagicLink || !isSupabaseConfigured}
            type="submit"
          >
            {isSubmittingMagicLink ? "Sending..." : "Send Magic Link Instead"}
          </button>
        </div>
      </form>
      <div className="field">
        <label>Important Supabase setup</label>
        <div className="hint">
          In Supabase Auth, set the Site URL to your Render domain and add
          `https://hisstaffduty.onrender.com/auth/callback` to the redirect URLs.
        </div>
      </div>
      {status ? <div className="banner">{status}</div> : null}
      {error ? <div className="banner error-banner">{error}</div> : null}
    </div>
  );
}
