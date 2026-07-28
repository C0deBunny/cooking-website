// import lib
import { getCurrentUser } from "@/lib/auth/queries";

// import components
import AuthButton from "./AuthButton";

export default async function NavbarAuthSlot() {
  const user = await getCurrentUser();
  return <AuthButton isLoggedIn={!!user} />;
}
