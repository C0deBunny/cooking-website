// import types
import type { Metadata } from "next";

//import fonts
import { Alan_Sans } from "next/font/google";

//import styles
import "./globals.css";

// import components
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ThemeProvider from "@/components/feature/layout/NextThemesProvider";
import NavbarServer from "@/components/feature/layout/NavbarServer";
import FooterServer from "@/components/feature/layout/FooterServer";

const fontSans = Alan_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Chique's Swiet Mofo",
  description: "Author: C0deBunny",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} antialiased min-h-screen flex flex-col`}>
        <ThemeProvider>
          <NavbarServer />
          <main className="mx-auto w-full max-w-7xl px-6 py-10 flex-1">{children}</main>
          <FooterServer />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
