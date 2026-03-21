"use client";

// import lib
import { createClient } from "@/lib/supabase/browser-client";
import { useState, useEffect } from "react";

// import components
import RecipeCard from "@/components/shared/RecipeCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// import types
import type { Recipe, Recipes } from "@/types/recipes";

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipes>([]);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchRecipes = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("recipes").select("*").order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching recipes:", error);
        return;
      }

      if (data) {
        setRecipes(data);
      }
    };

    fetchRecipes();
  }, []);

  const handleCreateRecipe = async () => {
    setErrorMessage("");

    if (!title.trim() || !description.trim()) {
      setErrorMessage("Please fill in both title and description.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("recipes")
      .insert([
        {
          title: title.trim(),
          description: description.trim(),
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error("Error creating recipe:", error);
      setErrorMessage("Failed to create recipe.");
      return;
    }

    if (data) {
      setRecipes((prev) => [data as Recipe, ...prev]);
      setTitle("");
      setDescription("");
      setOpen(false);
    }
  };

  return (
    <section className="w-full text-foreground">
      <div className="bg-foreground/5 w-full">
        <div className="w-full max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-4xl font-bold">Recipes</h1>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>New Recipe</Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Recipe</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="recipe-title">Recipe Title</Label>
                    <Input id="recipe-title" placeholder="Enter recipe title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="recipe-description">Description</Label>
                    <Textarea id="recipe-description" placeholder="Enter recipe description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
                  </div>

                  {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      setTitle("");
                      setDescription("");
                      setErrorMessage("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRecipe} disabled={loading}>
                    {loading ? "Creating..." : "Create Recipe"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* TODO Search functionality with filter and sort */}
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.length > 0 ? recipes.map((recipe) => <RecipeCard key={recipe.id} title={recipe.title} description={recipe.description} />) : <p className="text-gray-500">No recipes found.</p>}
        </div>
      </div>
    </section>
  );
}
