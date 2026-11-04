import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/local";
import {
  isOwnReceiptPath,
  jsonResponse,
  localReceiptsDir,
  MAX_RECEIPT_BYTES,
  RECEIPT_TYPES,
  RECEIPTS_BUCKET,
  removeReceiptFiles,
} from "@/lib/homeRecords";

// Receipts for home improvements and maintenance services. Files go in the private
// `home-records` storage bucket under <user id>/ (see supabase/schema.sql), or
// .local-data/home-records/ in local mode. Records save the returned name and path.

// POST /api/home/receipts — multipart form with a `file` field
// Returns { name, path }
export async function POST(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return jsonResponse({ message: "No file uploaded" }, 400);

  const ext = Object.keys(RECEIPT_TYPES).find((key) => RECEIPT_TYPES[key] === file.type);
  if (!ext) return jsonResponse({ message: `${file.name}: upload a PDF or a photo (JPG, PNG, HEIC)` }, 400);
  if (file.size > MAX_RECEIPT_BYTES) return jsonResponse({ message: `${file.name}: must be under 25 MB` }, 400);

  const storagePath = `${user!.id}/${randomUUID()}.${ext}`;
  const name = file.name.slice(0, 200) || `receipt.${ext}`;

  if (isLocalMode) {
    const target = path.join(localReceiptsDir, storagePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    return jsonResponse({ name, path: storagePath }, 201);
  }

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(storagePath, file, { contentType: file.type });

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse({ name, path: storagePath }, 201);
}

// GET /api/home/receipts?path=xxx — opens the file
export async function GET(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const storagePath = new URL(request.url).searchParams.get("path") ?? "";
  if (!isOwnReceiptPath(storagePath, user!.id)) {
    return jsonResponse({ message: "Invalid path" }, 400);
  }

  if (isLocalMode) {
    try {
      const contents = await readFile(path.join(localReceiptsDir, storagePath));
      return new NextResponse(contents, {
        headers: {
          "Content-Type": RECEIPT_TYPES[storagePath.split(".").pop() as string],
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return jsonResponse({ message: "Not found" }, 404);
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error) return jsonResponse({ message: error.message }, 404);

  return NextResponse.redirect(data.signedUrl);
}

// DELETE /api/home/receipts?path=xxx
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const storagePath = new URL(request.url).searchParams.get("path") ?? "";
  if (!isOwnReceiptPath(storagePath, user!.id)) {
    return jsonResponse({ message: "Invalid path" }, 400);
  }

  await removeReceiptFiles([storagePath]);

  return new NextResponse(null, { status: 204 });
}
