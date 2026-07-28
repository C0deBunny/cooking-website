// import lib
import { Suspense } from "react";

// import components
import AdminGate from "./_components/AdminGate";

/**
 * One gate for everything under /admin. Put new owner-only routes below this segment rather
 * than repeating the check per page.
 */
export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Suspense fallback={null}>
        <AdminGate />
      </Suspense>

      {children}
    </>
  );
}
