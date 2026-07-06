import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { sendGoogleWorkspaceEmail, type EmailSenderKey } from "@/lib/email";

export async function POST(request: Request) {
  const session = await getCurrentStaffAccessOrNull();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.access.isFullAccess) {
    return NextResponse.json({ error: "Only admins can send email from the workspace." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      senderKey?: EmailSenderKey;
      to?: string;
      subject?: string;
      message?: string;
    };

    const result = await sendGoogleWorkspaceEmail({
      senderKey: body.senderKey ?? "workspace",
      to: String(body.to ?? ""),
      subject: String(body.subject ?? ""),
      message: String(body.message ?? ""),
      replyTo: session.user.email ?? null
    });

    return NextResponse.json({
      ok: true,
      message: `Email sent from ${result.senderLabel} to ${result.recipients.join(", ")}.`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send email." },
      { status: 400 }
    );
  }
}
