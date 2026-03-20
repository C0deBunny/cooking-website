// import types
import type { Metadata } from "next";

// import fonts
import { Alan_Sans } from "next/font/google";

// import styles
import "./globals.css";

// import components
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ThemeProvider from "@/components/feature/layout/navbar/theme/NextThemesProvider";
import Navbar from "@/components/feature/layout/navbar/Navbar";
import Footer from "@/components/feature/layout/footer/Footer";

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
          <Navbar />
          <main className="w-full flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
