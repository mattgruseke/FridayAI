import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMediaKind } from "@/config/entertainment";
import { searchMedia } from "@/lib/mediaSearch";

// GET /api/media/search?q=slow+horses[&kind=tv] — matches with posters for the
// Entertainment list. See lib/mediaSearch.ts for where they come from.
export async function GET(request: Request) {
  const { errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const kind = params.get("kind");
  if (kind && !isMediaKind(kind)) return NextResponse.json({ message: "Invalid type" }, { status: 400 });
  if (query.length < 2) return NextResponse.json([]);

  return NextResponse.json(await searchMedia(query, kind && isMediaKind(kind) ? kind : null));
}
