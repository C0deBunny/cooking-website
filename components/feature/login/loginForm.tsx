"use client";

//import hooks
import { useActionState } from "react";

// import actions
import { login } from "@/Actions/auth/login";

// import lib
import { LoginState } from "@/Actions/auth/login";

const initialState: LoginState = {};

export default function Loginform() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {/* Email */}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
          className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={pending}
          className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {/* Error message */}
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      {/* Submit */}
      <button type="submit" disabled={pending} className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
