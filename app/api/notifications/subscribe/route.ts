import { NextResponse } from "next/server";
import { getCurrentStaffAccessOrNull } from "@/lib/auth";
import { getStaffProfileByEmail } from "@/lib/data";
import { removePushSubscription, savePushSubscription } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      subscription?: {
        endpoint?: string;
        expirationTime?: number | null;
        keys?: {
          p256dh?: string;
          auth?: string;
        };
      };
    };
    const subscription = body.subscription;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      throw new Error("Browser push subscription payload is incomplete.");
    }

    const profile = session.user.email ? await getStaffProfileByEmail(session.user.email) : null;

    await savePushSubscription({
      subscription: {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime ?? null,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      },
      staffEmail: session.user.email ?? null,
      staffName: profile?.name ?? null,
      teamLabel: profile?.department ?? profile?.designation ?? profile?.role ?? null,
      userAgent: request.headers.get("user-agent")
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save push subscription." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getCurrentStaffAccessOrNull();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { endpoint?: string };
    await removePushSubscription(String(body.endpoint ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove push subscription." },
      { status: 400 }
    );
  }
}
