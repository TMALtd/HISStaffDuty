"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TimetablePreviewStaffOption } from "@/lib/types";

type AccessPreviewSwitcherProps = {
  options: TimetablePreviewStaffOption[];
  selectedEmail?: string | null;
};

export function AccessPreviewSwitcher({
  options,
  selectedEmail
}: AccessPreviewSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updatePreview(email: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (email) {
      params.set("viewAs", email);
    } else {
      params.delete("viewAs");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div style={{ minWidth: "18rem" }}>
      <label className="field-label" htmlFor="access-preview-switcher">
        View As
      </label>
      <select
        id="access-preview-switcher"
        className="field-select"
        value={selectedEmail ?? ""}
        onChange={(event) => updatePreview(event.target.value)}
      >
        <option value="">Admin full view</option>
        {options.map((option) => (
          <option key={option.email} value={option.email}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
