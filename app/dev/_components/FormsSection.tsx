// import components
import { Section, Specimen } from "./Section";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SearchIcon, XIcon } from "lucide-react";

export default function FormsSection() {
  return (
    <Section
      id="forms"
      title="Form controls"
      hint="Every control is shown with its Label wired up, plus the disabled and aria-invalid states — those are the ones easiest to forget and hardest to notice missing."
    >
      <Specimen label="Input" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dev-title">Recipe title</Label>
          <Input id="dev-title" placeholder="Pom" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dev-invalid">Invalid</Label>
          <Input id="dev-invalid" defaultValue="nope" aria-invalid />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dev-disabled">Disabled</Label>
          <Input id="dev-disabled" placeholder="Disabled" disabled />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dev-file">File</Label>
          <Input id="dev-file" type="file" />
        </div>
      </Specimen>

      <Specimen label="InputGroup" note="addons sit inside the border; align controls which edge" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search recipes" />
        </InputGroup>
        <InputGroup>
          <InputGroupInput placeholder="Clearable" />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Clear">
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput placeholder="240" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>grams</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupTextarea placeholder="Method…" rows={3} />
          <InputGroupAddon align="block-end" className="border-t">
            <InputGroupText>Markdown supported</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Specimen>

      <Specimen label="Textarea">
        <div className="flex w-full flex-col gap-2">
          <Label htmlFor="dev-notes">Notes</Label>
          <Textarea id="dev-notes" placeholder="Let it rest for 10 minutes." rows={3} />
        </div>
      </Specimen>

      <Specimen label="Select">
        <Select>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Pick a course" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Savoury</SelectLabel>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="main">Main</SelectItem>
              <SelectItem value="side">Side</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Sweet</SelectLabel>
              <SelectItem value="dessert">Dessert</SelectItem>
              <SelectItem value="baking" disabled>
                Baking (disabled)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Specimen>

      <Specimen label="Checkbox">
        <div className="flex items-center gap-2">
          <Checkbox id="dev-check-a" defaultChecked />
          <Label htmlFor="dev-check-a">Checked</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="dev-check-b" />
          <Label htmlFor="dev-check-b">Unchecked</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="dev-check-c" disabled />
          <Label htmlFor="dev-check-c">Disabled</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="dev-check-d" aria-invalid />
          <Label htmlFor="dev-check-d">Invalid</Label>
        </div>
      </Specimen>

      <Specimen label="RadioGroup">
        <RadioGroup defaultValue="medium" className="flex flex-col gap-2">
          {[
            { value: "easy", label: "Easy" },
            { value: "medium", label: "Medium" },
            { value: "hard", label: "Hard" },
          ].map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem value={option.value} id={`dev-radio-${option.value}`} />
              <Label htmlFor={`dev-radio-${option.value}`}>{option.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </Specimen>

      <Specimen label="Switch">
        <div className="flex items-center gap-2">
          <Switch id="dev-switch-a" defaultChecked />
          <Label htmlFor="dev-switch-a">On</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="dev-switch-b" />
          <Label htmlFor="dev-switch-b">Off</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="dev-switch-c" disabled />
          <Label htmlFor="dev-switch-c">Disabled</Label>
        </div>
      </Specimen>
    </Section>
  );
}
