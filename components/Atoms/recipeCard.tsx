import { Card, CardContent, CardTitle, CardDescription } from "../ui/card";

export default function RecipeCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
