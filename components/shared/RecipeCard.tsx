import { Card, CardContent, CardTitle, CardDescription } from "../ui/card";

export default function RecipeCard({ title, description }: { title: string; description?: string | null }) {
  return (
    <Card>
      <CardContent>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
