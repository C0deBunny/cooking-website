// import lib
import { z } from "zod";

export const createRecipeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
});

/**
 * State object returned to useActionState by createRecipe.
 *
 * `ok` exists because this action cannot signal success by redirecting — the owner stays on
 * /admin. The dialog watches it to close itself.
 */
export type CreateRecipeState = {
  error?: string;
  ok?: boolean;
};
