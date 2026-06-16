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
      <p className="hint">
        Use your school Google account and select the <strong>Sign In With Google</strong> button.
        Email magic-link login is not enabled for staff.
      </p>
      {status ? <div className="banner">{status}</div> : null}
      {error ? <div className="banner error-banner">{error}</div> : null}
    </div>
  );
}
