// import components
import { Section, Specimen } from "./Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronsUpDownIcon } from "lucide-react";

const INGREDIENTS = [
  { item: "Cassava", amount: "1 kg", note: "grated" },
  { item: "Chicken thighs", amount: "600 g", note: "bone-in" },
  { item: "Orange juice", amount: "200 ml", note: "fresh" },
  { item: "Onion", amount: "2", note: "diced" },
];

export default function DataSection() {
  return (
    <Section id="data" title="Data & layout" hint="The pieces that hold content. Table, Card and Carousel are the ones most likely to end up on a recipe page.">
      <Specimen label="Card" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pom</CardTitle>
            <CardDescription>Surinamese oven dish · 90 min</CardDescription>
            <CardAction>
              <Badge variant="secondary">Main</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/70">Grated pomtajer with chicken, citrus and onion, baked until the top catches.</p>
          </CardContent>
          <CardFooter>
            <Button size="sm">Open recipe</Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Header only</CardTitle>
            <CardDescription>Every slot is optional — CardAction pins to the top right.</CardDescription>
          </CardHeader>
        </Card>
      </Specimen>

      <Specimen label="Table" className="block">
        <Table>
          <TableCaption>Ingredients for four servings.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Ingredient</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Prep</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INGREDIENTS.map((row) => (
              <TableRow key={row.item}>
                <TableCell className="font-medium">{row.item}</TableCell>
                <TableCell>{row.amount}</TableCell>
                <TableCell className="text-right text-foreground/60">{row.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className="text-right">{INGREDIENTS.length} items</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Specimen>

      <Specimen label="Tabs" note="variant default and line" className="block">
        <Tabs defaultValue="ingredients">
          <TabsList>
            <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
            <TabsTrigger value="method">Method</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="ingredients" className="pt-4 text-sm text-foreground/70">
            Cassava, chicken, citrus, onion.
          </TabsContent>
          <TabsContent value="method" className="pt-4 text-sm text-foreground/70">
            Layer, bake at 180°C for an hour.
          </TabsContent>
          <TabsContent value="notes" className="pt-4 text-sm text-foreground/70">
            Better the next day.
          </TabsContent>
        </Tabs>
        <Separator className="my-6" />
        <Tabs defaultValue="a">
          <TabsList variant="line">
            <TabsTrigger value="a">Line variant</TabsTrigger>
            <TabsTrigger value="b">Second</TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="pt-4 text-sm text-foreground/70">
            Underlined instead of filled.
          </TabsContent>
          <TabsContent value="b" className="pt-4 text-sm text-foreground/70">
            Second panel.
          </TabsContent>
        </Tabs>
      </Specimen>

      <Specimen label="Carousel" note="embla — drag or use the arrows" className="block px-12">
        <Carousel>
          <CarouselContent>
            {Array.from({ length: 6 }).map((_, index) => (
              <CarouselItem key={index} className="basis-1/2 md:basis-1/3">
                <div className="flex aspect-video items-center justify-center rounded-lg border border-foreground/10 bg-foreground/5 text-sm text-foreground/50">Slide {index + 1}</div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </Specimen>

      <Specimen label="Collapsible" className="block">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost">
              Substitutions
              <ChevronsUpDownIcon data-icon="inline-end" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 text-sm text-foreground/70">Swap pomtajer for taro root, or half taro and half potato at a pinch.</CollapsibleContent>
        </Collapsible>
      </Specimen>

      <Specimen label="ScrollArea" note="fixed height, styled scrollbar" className="block">
        <ScrollArea className="h-40 rounded-lg border border-foreground/10 p-4">
          <div className="flex flex-col gap-2 text-sm text-foreground/70">
            {Array.from({ length: 20 }).map((_, index) => (
              <p key={index}>Step {index + 1} — keep stirring.</p>
            ))}
          </div>
        </ScrollArea>
      </Specimen>

      <Specimen label="Pagination" className="block">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#data" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#data">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#data" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#data">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#data" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Specimen>

      <Specimen label="Separator" className="block">
        <p className="text-sm text-foreground/70">Above</p>
        <Separator className="my-3" />
        <p className="text-sm text-foreground/70">Below</p>
        <div className="mt-4 flex h-10 items-center gap-3 text-sm text-foreground/70">
          <span>Left</span>
          <Separator orientation="vertical" />
          <span>Right</span>
        </div>
      </Specimen>
    </Section>
  );
}
