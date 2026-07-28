// import components
import Loginform from "@/components/feature/login/loginForm";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Admin Login</h1>

      <Suspense fallback={<p>Loading...</p>}>
        <Loginform />
      </Suspense>
    </section>
  );
}
