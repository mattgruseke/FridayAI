import { redirect } from "next/navigation";

// Household tasks moved into Tasks, as the Home area.
export default function Page() {
  redirect("/tasks?area=home");
}
