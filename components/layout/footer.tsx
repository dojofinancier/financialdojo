"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export function Footer() {
  const pathname = usePathname();
  const [currentYear, setCurrentYear] = useState(2025);

  // Update year on client side after hydration to avoid mismatch
  // Must be called before any early returns to follow Rules of Hooks
  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // The homepage has its own detailed footer (brutalist). Avoid rendering the standard one there.
  if (pathname === "/") return null;
  // The investor diagnostic pages are designed as standalone flows.
  if (pathname.startsWith("/investor")) return null;

  return (
    <footer className="border-t bg-muted/40 py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link 
              href="/about" 
              prefetch={true}
              className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              About
            </Link>
            <span className="text-muted-foreground/50">•</span>
            <Link 
              href="/article" 
              prefetch={true}
              className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Articles
            </Link>
            <span className="text-muted-foreground/50">•</span>
            <Link 
              href="/privacy-policy" 
              prefetch={true}
              className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Privacy policy
            </Link>
            <span className="text-muted-foreground/50">•</span>
            <Link 
              href="/terms-and-conditions" 
              prefetch={true}
              className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Terms and conditions
            </Link>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            © {currentYear} Financial Dojo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
