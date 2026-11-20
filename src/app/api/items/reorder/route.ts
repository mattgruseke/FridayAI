import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode, localStore } from "@/lib/local";
import { loadLocalTasks, saveLocalTasks } from "@/lib/localTasks";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// PUT /api/items/reorder
// Body: { ids: string[] } — items in their new order, highest priority first.
// The listed items trade sort_order values among themselves, so reordering one
// category leaves the other categories' places in "All items" alone.
export async function PUT(request: Request) {
  const { errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { ids } = await request.json();
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id) => typeof id === "string") ||
    new Set(ids).size !== ids.length
  ) {
    return jsonResponse({ message: "ids must be a list of unique item ids" }, 400);
  }

  if (isLocalMode) {
    await loadLocalTasks();
    const items = localStore.items
      .filter((i) => ids.includes(i.id))
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    const slots = items.map((i) => i.sort_order).sort((a, b) => a - b);
    items.forEach((item, index) => {
      item.sort_order = slots[index];
    });
    await saveLocalTasks();
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_items", { p_ids: ids });

  if (error) return jsonResponse({ message: error.message }, 500);

  return new NextResponse(null, { status: 204 });
}
