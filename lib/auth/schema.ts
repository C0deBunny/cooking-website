// import lib
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

/** State object returned to useActionState by the login action. */
export type LoginState = {
  error?: string;
};
