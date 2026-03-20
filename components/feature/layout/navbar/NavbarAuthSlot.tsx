// import actions
import { getCurrentUser } from "@/Actions/Auth";

// import components
import AuthButton from "./AuthButton";

export default async function NavbarAuthSlot() {
  const user = await getCurrentUser();
  return <AuthButton isLoggedIn={!!user} />;
}
