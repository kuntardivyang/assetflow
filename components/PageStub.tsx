import { Card, CardContent } from "@/components/ui/card";

/**
 * Placeholder for screens still under construction. Each owner replaces their
 * screen's page.tsx with the real implementation (see planning task sheets).
 */
export function PageStub({
  title,
  screen,
  owner,
  description,
}: {
  title: string;
  screen: number;
  owner: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-1 py-16 text-center">
          <p className="text-sm font-medium">Screen {screen} — under construction</p>
          <p className="text-xs text-muted-foreground">Owner: {owner}</p>
        </CardContent>
      </Card>
    </div>
  );
}
