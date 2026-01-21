"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const themeRef = React.useRef(theme);

  // Keep ref in sync with theme
  React.useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Handle mounting to prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = React.useCallback(() => {
    // Always use the current theme value from ref to avoid stale closures
    const currentTheme = themeRef.current;
    if (currentTheme === "light") {
      setTheme("dark");
    } else if (currentTheme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  }, [setTheme]);

  const getIcon = () => {
    if (!mounted) {
      // Default to Sun icon during SSR to match initial state
      return <Sun className="h-4 w-4" />;
    }
    if (theme === "light") return <Sun className="h-4 w-4" />;
    if (theme === "dark") return <Moon className="h-4 w-4" />;
    // System theme - show based on current system preference
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return systemDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  };

  const getLabel = () => {
    if (!mounted) {
      // Default label during SSR to match initial state
      return "Basculer vers le mode sombre";
    }
    if (theme === "light") return "Basculer vers le mode sombre";
    if (theme === "dark") return "Switch to system mode";
    return "Basculer vers le mode clair";
  };

  // Hide theme toggle on the homepage (requested UX).
  // IMPORTANT: this must be after hooks to keep hook order consistent across routes.
  if (pathname === "/") return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="p-2"
      aria-label={getLabel()}
      title={getLabel()}
    >
      {getIcon()}
    </Button>
  );
}

