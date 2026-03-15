"use client";

// import lib
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

// import components
import HeroSection from "@/components/feature/layout/hero/hero";

//import types
import { Recipes } from "@/types/recipes";

export default function Home() {
  const [recipes, setRecipes] = useState<Recipes>([]);

  useEffect(() => {
    const fetchRecipes = async () => {
      const { data, error } = await createClient().from("recipes").select("*");

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

  return (
    <div>
      <HeroSection />
    </div>
  );
}
