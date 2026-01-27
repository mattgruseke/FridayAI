import { Suspense } from "react";
import Login from "@/pages/Login";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}
