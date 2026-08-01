// import lib
import { Suspense } from "react";

// import components
import RecipeForm from "@/app/admin/_components/RecipeForm";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The form lives in app/admin/_components/ rather than under this route because editing will
 * reuse it from a sibling route later — decision 19 keeps this slice create-only, but the
 * placement avoids a move when edit lands.
 *
 * The Suspense boundary is required, not stylistic. With `cacheComponents: true` the server
 * action bound to `<form action={…}>` counts as request data, and reaching it while prerendering
 * the shell fails the build. There is no route-level escape — `export const dynamic` is rejected
 * outright under cacheComponents — so the boundary is the mechanism.
 */
export default function CreateRecipesPage() {
  return (
    <div className="flex-1">
      <Suspense fallback={<CreateFormFallback />}>
        <RecipeForm />
      </Suspense>
    </div>
  );
}

function CreateFormFallback() {
  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-12 space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
