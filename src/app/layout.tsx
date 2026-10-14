import "./globals.css";
import { Inter, Playfair_Display } from "next/font/google";
import Providers from "./providers";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";
import { themeInitScript } from "@/lib/theme";
import { isLocalMode, LOCAL_USER, localStore } from "@/lib/local";

export const metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
  },
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-playfair",
});

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  let user = null;
  let userProfile = null;

  if (isLocalMode) {
    user = LOCAL_USER;
    userProfile = localStore.profile;
  } else try {
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
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers initialUser={user} initialProfile={userProfile}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
