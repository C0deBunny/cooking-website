// import lib
import { notFound } from "next/navigation";

// import components
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DevLayout({ children }: { children: React.ReactNode }) {
  // The gallery is a development tool, so it 404s on the deployed site. NODE_ENV is inlined at
  // build time — this is not request data, so it needs no Suspense boundary the way requireUser() does.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <TooltipProvider>
      {children}
      {/* Neither of these is mounted in the root layout. Scoping them here means the tooltip and
          toast specimens work without changing what every other route renders. */}
      <Toaster />
    </TooltipProvider>
  );
}
