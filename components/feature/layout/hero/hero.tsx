import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="w-full  text-foreground">
      <div className="mx-auto grid  max-w-7xl items-start gap-10 px-6 pt-12 pb-16 md:px-10 lg:grid-cols-2 lg:px-16 lg:pt-16 lg:pb-20">
        <div className="max-w-xl">
          {/* Heading */}
          <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">Delicious recipes made with love, </h1>

          <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">Discover Surinamese/Caribian/Asian cuisine that bring warmth to your table.</p>

          <div className="mt-8">
            <Button size="lg" className="rounded-xl px-6 shadow-md">
              Browse Recipes
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
            <div>
              <span className="block text-2xl font-semibold text-foreground">100+</span>
              Home recipes
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <span className="block text-2xl font-semibold text-foreground">Easy</span>
              Family cooking
            </div>
          </div>
        </div>

        {/* Image Container */}
        <div className="relative flex justify-center lg:justify-end ">
          <div className="relative w-full max-w-sm">
            <div className="overflow-hidden rounded-[28px] border bg-card p-3 shadow-xl">
              <div className="relative aspect-4/5 overflow-hidden rounded-[22px] bg-muted">
                <Image src="/frontPicture.jpg" alt="Portrait of Chiquetha" fill className="object-cover" priority />

                <div className="absolute bottom-4 left-4 ">
                  <div className="max-w-65 rounded-2xl border border-white/50 bg-white/80 px-5 py-4 shadow-lg backdrop-blur-md">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-foreground">Food Creator</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">Chiquetha</p>
                    <p className="text-sm text-foreground">{`Chique's Swiet Mofo`}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
