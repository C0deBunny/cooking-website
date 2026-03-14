// import types
import type { Metadata } from "next";

//import fonts
import { Alan_Sans } from "next/font/google";

//import styles
import "./globals.css";

// import components
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ThemeProvider from "@/components/Atoms/NextThemesProvider";
import { ThemeToggle } from "@/components/Atoms/Theme-toggle";

const fontSans = Alan_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Mom's Cooking Website",
  description: "Author: C0deBunny",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} antialiased`}>
        <ThemeProvider>
          {children}
          <ThemeToggle />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
