import { personRoutes } from "@/lib/calendarRecords";

// Who can look after the kid. No DELETE: people are archived instead, because past
// schedules still point at them.
export const { GET, POST, PUT } = personRoutes;
