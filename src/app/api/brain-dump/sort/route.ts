import { NextResponse } from "next/server";
import { SORT_TARGETS, type SortTarget } from "@/api/client";
import { requireUser } from "@/lib/auth";
import { dumpStore, entryStore, moveLinks } from "@/lib/listRecords";
import { createTask, deleteTask } from "@/lib/taskStore";
import { splitDumpText } from "@/config/lists";

const jsonResponse = (data: unknown, status = 200) => NextResponse.json(data, { status });

// POST /api/brain-dump/sort  Body: { id, as: "task" | "goal" | "idea" | "note" }
// Makes the item into that kind of thing, marks it sorted, and carries its links over.
// A task lands with no area and no box, so it waits in Tasks' Not categorized.
export async function POST(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;
  const userId = user!.id;

  const { id, as } = await request.json();
  if (!SORT_TARGETS.includes(as as SortTarget)) return jsonResponse({ message: "Pick a list to sort it into" }, 400);
  const item = (await dumpStore.list(userId)).find((d) => d.id === id);
  if (!item) return jsonResponse({ message: "Not found" }, 404);
  if (item.state !== "open") return jsonResponse({ message: "That's already been sorted" }, 400);

  try {
    const { title, details } = splitDumpText(item.text);
    const target =
      as === "task"
        ? { type: "task" as const, row: await createTask(userId, { title, category: "none", box: null, notes: details }) }
        : {
            type: "entry" as const,
            row: await entryStore.create(userId, { kind: as, title, details, archived: false }),
          };

    try {
      const sorted = await dumpStore.update(userId, item.id, {
        text: item.text,
        state: "sorted",
        sorted_as: as,
        sorted_id: target.row.id,
        sorted_at: new Date().toISOString(),
      });
      await moveLinks(userId, { type: "dump", id: item.id }, { type: target.type, id: target.row.id });
      return jsonResponse({ item: sorted, target: target.row });
    } catch (err) {
      // Marking it sorted failed, so take back what was made rather than leave a copy.
      if (target.type === "task") await deleteTask(userId, target.row.id);
      else await entryStore.remove(userId, target.row.id);
      throw err;
    }
  } catch (err) {
    return jsonResponse({ message: (err as { message?: string })?.message || "Something went wrong" }, 500);
  }
}
