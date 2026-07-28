"use client";

// import lib
import { useActionState, useEffect, useState } from "react";

// import actions
import { createRecipe } from "@/lib/recipes/actions";

// import components
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// import types
import type { CreateRecipeState } from "@/lib/recipes/schema";

const initialState: CreateRecipeState = {};

export default function NewRecipeDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Recipe</Button>
      </DialogTrigger>

      {/* DialogContent unmounts when closed, so the form's action state resets on every open. */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Recipe</DialogTitle>
        </DialogHeader>

        <NewRecipeForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewRecipeForm({ onCreated }: { onCreated: () => void }) {
  const [state, formAction, pending] = useActionState(createRecipe, initialState);

  useEffect(() => {
    if (state.ok) {
      onCreated();
    }
  }, [state.ok, onCreated]);

  return (
    <form action={formAction}>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="recipe-title">Recipe Title</Label>
          <Input id="recipe-title" name="title" placeholder="Enter recipe title" disabled={pending} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recipe-description">Description</Label>
          <Textarea id="recipe-description" name="description" placeholder="Enter recipe description" rows={5} disabled={pending} required />
        </div>

        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Recipe"}
        </Button>
      </DialogFooter>
    </form>
  );
}
