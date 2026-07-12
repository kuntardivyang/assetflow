"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

// App-wide client providers: theme (dark mode) + toast host.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster richColors position="top-right" closeButton />
    </ThemeProvider>
  );
}
