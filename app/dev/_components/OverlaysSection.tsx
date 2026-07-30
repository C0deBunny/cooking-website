// import components
import { Section, Specimen } from "./Section";
import ToastDemo from "./ToastDemo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";

export default function OverlaysSection() {
  return (
    <Section
      id="overlays"
      title="Overlays & feedback"
      hint="Tooltip needs a TooltipProvider ancestor and Toaster has to be mounted for toasts to appear — both live in this route's layout rather than the root one, so remember that before using them on a real page."
    >
      <Specimen label="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a recipe</DialogTitle>
              <DialogDescription>This is the same shell NewRecipeDialog uses.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dev-dialog-title">Title</Label>
              <Input id="dev-dialog-title" placeholder="Pom" />
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">No close button</Button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>showCloseButton={"{false}"}</DialogTitle>
              <DialogDescription>Escape and the overlay still dismiss it.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </Specimen>

      <Specimen label="AlertDialog" note="no dismiss on overlay click — for destructive confirmations">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete recipe</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone. The recipe and its photo are removed for good.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Specimen>

      <Specimen label="Tooltip" note="sides">
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <Tooltip key={side}>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label={`Tooltip on ${side}`}>
                <InfoIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={side}>Opens on the {side}</TooltipContent>
          </Tooltip>
        ))}
      </Specimen>

      <Specimen label="Toaster (sonner)" note="click to fire — position and theme come from the Toaster in layout.tsx">
        <ToastDemo />
      </Specimen>
    </Section>
  );
}
