"use client";

import Link from "next/link";
import { useEffect } from "react";

export function NotFoundClient() {
  useEffect(() => {
    // Ensure standard navbar is hidden while the not-found UI is mounted.
    const root = document.documentElement;
    const prev = root.dataset.chrome;
    root.dataset.chrome = "brutalist";
    return () => {
      if (prev) root.dataset.chrome = prev;
      else delete root.dataset.chrome;
    };
  }, []);

  return (
    <>
      {/* Main content */}
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4 sm:px-8 pt-32 pb-20">
        <div className="max-w-[1400px] mx-auto w-full text-center">
          {/* Hard grid pattern */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(white 2px, transparent 2px),
                linear-gradient(90deg, white 2px, transparent 2px)
              `,
              backgroundSize: "80px 80px"
            }}
          />

          {/* Error number */}
          <div className="mb-8">
            <span className="text-primary font-mono text-sm uppercase tracking-[0.3em] block mb-4">
              [ERREUR]
            </span>
            <h1 className="text-[20vw] sm:text-[15vw] md:text-[12vw] font-black uppercase leading-[0.85] tracking-tighter text-primary">
              404
            </h1>
          </div>

          {/* Message */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="border-l-4 border-primary pl-6 py-2 text-left">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
                PAGE NOT FOUND
              </h2>
              <p className="text-xl sm:text-2xl font-light leading-relaxed opacity-80">
                The page you are looking for does not exist or has been moved.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/"
              className="inline-block bg-white text-black font-black uppercase text-lg tracking-wider px-10 py-5 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors shadow-[8px_8px_0_0_hsl(var(--primary))]"
            >
              Back to home →
            </Link>
            <Link 
              href="/courses"
              className="inline-block bg-transparent text-white font-black uppercase text-lg tracking-wider px-10 py-5 border-4 border-white hover:bg-white hover:text-black transition-colors"
            >
              View courses
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

