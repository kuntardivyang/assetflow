"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

// App-group error boundary — a DB hiccup shows this instead of Next's
// unstyled default error page.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-warning" />
          <p className="font-medium">Something went wrong loading this screen</p>
          <p className="text-sm text-muted-foreground">
            The error has been logged. Try again — if it keeps happening, check the server console.
          </p>
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
