import ProtectedLayout from "@/components/ProtectedLayout";
import Layout from "@/components/Layout";
import type { ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProtectedLayout>
      <Layout>{children}</Layout>
    </ProtectedLayout>
  );
}
