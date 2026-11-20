import { NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/local";

// Home inspection report upload for the Home Manager intake. Files go in the
// private `inspection-reports` storage bucket under <user id>/ (see
// supabase/schema.sql), or .local-data/intake/files/ in local mode. The intake
// form saves the returned name and path in its answers.

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

const BUCKET = "inspection-reports";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
};

const localDir = path.join(process.cwd(), ".local-data", "intake", "files");

// POST /api/intake/report — multipart form with a `file` field
// Returns { name, path }
export async function POST(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return jsonResponse({ message: "No file uploaded" }, 400);

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return jsonResponse({ message: "Upload a PDF or a photo (JPG, PNG, HEIC)" }, 400);
  if (file.size > MAX_BYTES) return jsonResponse({ message: "File must be under 25 MB" }, 400);

  const storagePath = `${user!.id}/inspection-report-${Date.now()}.${ext}`;
  const name = file.name.slice(0, 200) || `inspection-report.${ext}`;

  if (isLocalMode) {
    const target = path.join(localDir, storagePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    return jsonResponse({ name, path: storagePath }, 201);
  }

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse({ name, path: storagePath }, 201);
}

// DELETE /api/intake/report?path=xxx
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const storagePath = new URL(request.url).searchParams.get("path") ?? "";
  // Only the user's own folder, and no path tricks.
  if (!storagePath.startsWith(`${user!.id}/`) || storagePath.includes("..")) {
    return jsonResponse({ message: "Invalid path" }, 400);
  }

  if (isLocalMode) {
    await unlink(path.join(localDir, storagePath)).catch(() => {});
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);

  if (error) return jsonResponse({ message: error.message }, 500);

  return new NextResponse(null, { status: 204 });
}
