import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { sendDesktopNotification } from "@/lib/notifications";
import type { NotificationRecipientMode } from "@/lib/types";

export async function POST(request: Request) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session?.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can send desktop notifications." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      message?: string;
      url?: string;
      recipientMode?: NotificationRecipientMode;
      selectedEmails?: string[];
      selectedTeam?: string | null;
    };

    const result = await sendDesktopNotification({
      title: String(body.title ?? ""),
      message: String(body.message ?? ""),
      url: body.url ? String(body.url) : null,
      recipientMode: body.recipientMode ?? "all",
      selectedEmails: Array.isArray(body.selectedEmails) ? body.selectedEmails.map(String) : [],
      selectedTeam: body.selectedTeam ? String(body.selectedTeam) : null
    });

    return NextResponse.json({
      ok: true,
      message: `Notification sent to ${result.sentCount} browser${result.sentCount === 1 ? "" : "s"}${result.failedCount ? ` (${result.failedCount} failed)` : ""}.`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send desktop notification." },
      { status: 400 }
    );
  }
}
