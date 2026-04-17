import ProtectedLayout from "@/components/ProtectedLayout";
import Layout from "@/components/Layout";
import OnboardingGate from "@/components/OnboardingGate";
import TourGate from "@/components/TourGate";
import type { ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProtectedLayout>
      <Layout>{children}</Layout>
      <OnboardingGate />
      <TourGate />
    </ProtectedLayout>
  );
}
