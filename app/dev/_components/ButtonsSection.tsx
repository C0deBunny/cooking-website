// import components
import { Section, Specimen } from "./Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@/components/ui/button-group";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, BoldIcon, ChefHatIcon, ItalicIcon, PlusIcon, TrashIcon, UnderlineIcon } from "lucide-react";

const BUTTON_VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const;
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;
const BADGE_VARIANTS = ["default", "secondary", "destructive", "outline", "ghost", "link"] as const;

export default function ButtonsSection() {
  return (
    <Section id="buttons" title="Buttons & toggles" hint="Variant and size names come straight from each component's cva definition, so this list is exhaustive rather than a selection.">
      <Specimen label="Button — variant">
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Specimen>

      <Specimen label="Button — size">
        {BUTTON_SIZES.map((size) => (
          <Button key={size} size={size} variant="outline">
            {size}
          </Button>
        ))}
      </Specimen>

      <Specimen label="Button — icon sizes" note="square, for a lone icon">
        {ICON_SIZES.map((size) => (
          <Button key={size} size={size} variant="outline" aria-label={`Add recipe (${size})`}>
            <PlusIcon />
          </Button>
        ))}
      </Specimen>

      <Specimen label="Button — with icons" note="data-icon tightens the padding on that side">
        <Button>
          <ChefHatIcon data-icon="inline-start" />
          New recipe
        </Button>
        <Button variant="destructive">
          <TrashIcon data-icon="inline-start" />
          Delete
        </Button>
        <Button variant="outline" disabled>
          <Spinner />
          Saving
        </Button>
        <Button disabled>Disabled</Button>
      </Specimen>

      <Specimen label="ButtonGroup" note="strips the inner radii and shared borders">
        <ButtonGroup>
          <Button variant="outline">Breakfast</Button>
          <Button variant="outline">Lunch</Button>
          <Button variant="outline">Dinner</Button>
        </ButtonGroup>
        <ButtonGroup>
          <ButtonGroupText>Servings</ButtonGroupText>
          <ButtonGroupSeparator />
          <Button variant="outline" size="icon" aria-label="Fewer servings">
            &minus;
          </Button>
          <Button variant="outline" size="icon" aria-label="More servings">
            <PlusIcon />
          </Button>
        </ButtonGroup>
        <ButtonGroup orientation="vertical">
          <Button variant="outline">Top</Button>
          <Button variant="outline">Bottom</Button>
        </ButtonGroup>
      </Specimen>

      <Specimen label="Toggle">
        <Toggle aria-label="Bold">
          <BoldIcon />
        </Toggle>
        <Toggle variant="outline" aria-label="Italic">
          <ItalicIcon />
        </Toggle>
        <Toggle size="sm" aria-label="Underline">
          <UnderlineIcon />
        </Toggle>
        <Toggle size="lg" defaultPressed>
          Pressed
        </Toggle>
      </Specimen>

      <Specimen label="ToggleGroup" note="single vs multiple selection">
        <ToggleGroup type="single" defaultValue="left" variant="outline">
          <ToggleGroupItem value="left" aria-label="Align left">
            <AlignLeftIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Align center">
            <AlignCenterIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Align right">
            <AlignRightIcon />
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="multiple" defaultValue={["vegan"]}>
          <ToggleGroupItem value="vegan">Vegan</ToggleGroupItem>
          <ToggleGroupItem value="quick">Quick</ToggleGroupItem>
          <ToggleGroupItem value="spicy">Spicy</ToggleGroupItem>
        </ToggleGroup>
      </Specimen>

      <Specimen label="Badge — variant">
        {BADGE_VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
        <Badge>
          <ChefHatIcon data-icon="inline-start" />
          30 min
        </Badge>
      </Specimen>

      <Specimen label="Spinner" note="a Loader2Icon with animate-spin — size it with size-*">
        <Spinner />
        <Spinner className="size-6" />
        <Spinner className="size-8 text-primary" />
      </Specimen>
    </Section>
  );
}
