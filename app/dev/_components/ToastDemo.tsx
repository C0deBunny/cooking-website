"use client";

// import lib
import { toast } from "sonner";

// import components
import { Button } from "@/components/ui/button";

export default function ToastDemo() {
  return (
    <>
      <Button variant="outline" onClick={() => toast("Recipe saved")}>
        default
      </Button>
      <Button variant="outline" onClick={() => toast.success("Pom added to your recipes")}>
        success
      </Button>
      <Button variant="outline" onClick={() => toast.error("Could not reach Supabase")}>
        error
      </Button>
      <Button variant="outline" onClick={() => toast.warning("Oven still preheating")}>
        warning
      </Button>
      <Button variant="outline" onClick={() => toast.info("Serves 4")}>
        info
      </Button>
      <Button variant="outline" onClick={() => toast.loading("Uploading photo…")}>
        loading
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast("Recipe deleted", {
            description: "Pom · removed just now",
            action: { label: "Undo", onClick: () => toast.success("Restored") },
          })
        }
      >
        with action
      </Button>
    </>
  );
}
