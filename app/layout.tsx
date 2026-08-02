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
      <body className={`${fontSans.variable} antialiased min-h-dvh flex flex-col`}>
        <ThemeProvider>
          <Navbar />
          {/* A single 1fr row, so the page's root element is stretched to the region's height without
              having to opt in. A flex column would not do this: in a column, stretch applies to the
              cross axis (width), so the child would still collapse to its content height and leave a
              dead band above the footer. The row grows past 1fr when the page is taller than the
              viewport, so long pages are unaffected. */}
          <main className="w-full flex-1 grid grid-rows-[1fr]">{children}</main>
          <Footer />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
