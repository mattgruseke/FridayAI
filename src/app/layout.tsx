import "./globals.css";
import Providers from "./providers";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Your job search, all in one place. | GigFrog",
  description: "Your job search, all in one place. | GigFrog",
  metadataBase: new URL("https://gigfrog.io"),
  openGraph: {
    title: "Your job search, all in one place. | GigFrog",
    description: "Your job search, all in one place. | GigFrog",
    url: "https://gigfrog.io",
    siteName: "GigFrog",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Your job search, all in one place. | GigFrog",
    description: "Your job search, all in one place. | GigFrog.",
    images: ["/og-image.png"],
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  let user = null;
  let userProfile = null;

  try {
    const supabase = await createClient();

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;

    if (user) {
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      userProfile = data;
    }
  } catch (error) {
    // Auth fetch failed, continue with null user
    console.error("Error fetching user in layout:", error);
  }

  return (
    <html lang="en">
      <body>
        <Providers initialUser={user} initialProfile={userProfile}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
