import { NextResponse } from "next/server";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { createClient } from "@/lib/supabase/server";

const ses = new SESClient({
  region: process.env.AWS_SES_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const FROM_ADDRESS = "noreply@gigfrog.io";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { to: string; subject: string; message: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const { to, subject, message } = body;
  if (!to || !subject || !message) {
    return NextResponse.json({ message: "to, subject, and message are required" }, { status: 400 });
  }

  // Build a friendly display name — user_profiles.full_name takes priority
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const rawName: string =
    (profile?.full_name as string) ||
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "Someone";
  const displayName = `${rawName} via GigFrog`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: `${displayName} <${FROM_ADDRESS}>`,
        ReplyToAddresses: [user.email!],
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: message, Charset: "UTF-8" },
          },
        },
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[send-email] SES error:", err);
    return NextResponse.json({ message: "Failed to send email" }, { status: 500 });
  }
}
