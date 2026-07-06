"use client";

import { useState } from "react";
import type { PortalPageAccessSetting } from "@/lib/types";

type PortalPageAccessPanelProps = {
  initialSettings: PortalPageAccessSetting[];
};

export function PortalPageAccessPanel({ initialSettings }: PortalPageAccessPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");

  async function toggleSetting(pageKey: string) {
    const nextSettings = settings.map((setting) =>
      setting.pageKey === pageKey ? { ...setting, isEnabled: !setting.isEnabled } : setting
    );

    setSettings(nextSettings);
    setStatus("");
    setError("");
    setSavingKey(pageKey);

    try {
      const response = await fetch("/api/portal/page-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ settings: nextSettings })
      });

      const result = (await response.json()) as {
        settings?: PortalPageAccessSetting[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Could not save page access settings.");
      }

      setSettings(result.settings ?? nextSettings);
      setStatus("Staff page access updated.");
    } catch (saveError) {
      setSettings(settings);
      setError(saveError instanceof Error ? saveError.message : "Could not save page access settings.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Staff Access</p>
          <h2 className="panel-title">Turn pages and student-tab links on or off</h2>
        </div>
        <p className="hint">
          Admins still keep access. These switches control what staff can open in the navigation and
          which quick links appear on the Students tab.
        </p>
      </div>

      <div className="page-access-grid">
        {settings.map((setting) => {
          const isSaving = savingKey === setting.pageKey;

          return (
            <article key={setting.pageKey} className="page-access-card">
              <div>
                <p className="page-access-label">{setting.label}</p>
                <p className={`page-access-state ${setting.isEnabled ? "enabled" : "disabled"}`}>
                  {setting.isEnabled ? "Visible to staff" : "Hidden from staff"}
                </p>
              </div>
              <button className="button secondary" type="button" onClick={() => toggleSetting(setting.pageKey)} disabled={isSaving}>
                {isSaving ? "Saving..." : setting.isEnabled ? "Turn Off" : "Turn On"}
              </button>
            </article>
          );
        })}
      </div>

      {status ? <div className="status-banner success">{status}</div> : null}
      {error ? <div className="status-banner error">{error}</div> : null}
    </section>
  );
}
