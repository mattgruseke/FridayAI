import { requireUser } from "@/lib/auth";
import { moveEntertainmentOutOfTasks, watchRoutes } from "@/lib/watchlist";

// The Entertainment list: things to watch, read or listen to.
export const { POST, PUT, DELETE } = watchRoutes;

// Entertainment saved as tasks before this list existed moves here first.
export async function GET(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;
  try {
    await moveEntertainmentOutOfTasks(user!.id);
  } catch {
    // The list still loads; the move is tried again next time.
  }
  return watchRoutes.GET(request);
}
