// import lib
import { Suspense } from "react";

// import components
import RecipeWizard from "@/app/admin/_components/recipe-wizard/RecipeWizard";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The wizard lives in app/admin/_components/ rather than under this route because editing will
 * reuse it from a sibling route later.
 *
 * The Suspense boundary is required, not stylistic. With `cacheComponents: true` the server
 * action bound to `<form action={…}>` counts as request data, and reaching it while prerendering
 * the shell fails the build. There is no route-level escape — `export const dynamic` is rejected
 * outright under cacheComponents — so the boundary is the mechanism.
 *
 * Decision 12 moved the `<form>` element itself down to the wizard's Review panel, but the
 * boundary stays here: `useActionState` is called at the wizard's root, where the draft lives, so
 * the action is referenced the moment anything renders at all.
 */
export default function CreateRecipesPage() {
  return (
    <div className="flex-1">
      <Suspense fallback={<CreateWizardFallback />}>
        <RecipeWizard />
      </Suspense>
    </div>
  );
}

function CreateWizardFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-6 py-8">
      <Skeleton className="h-9 w-52" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(19rem,0.95fr)]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="hidden h-96 w-full lg:block" />
      </div>
    </div>
  );
}
