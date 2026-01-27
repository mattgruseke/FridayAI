import "./globals.css";
import Providers from "./providers";
import type { ReactNode } from "react";

export const metadata = {
  title: "JobFinder",
  description: "Find your next gig faster.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
