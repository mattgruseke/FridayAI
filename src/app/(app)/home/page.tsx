import { redirect } from "next/navigation";

// Household tasks moved into Tasks, which no longer splits tasks by area.
export default function Page() {
  redirect("/tasks");
}
