"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { BrutalistUserMenu } from "./brutalist-user-menu";

interface BrutalistNavbarClientProps {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  } | null | undefined;
  variant?: "transparent" | "solid";
  dashboardUrl: string | null;
}

export function BrutalistNavbarClient({ user, variant = "transparent", dashboardUrl }: BrutalistNavbarClientProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (variant !== "transparent") return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const heroElement = document.querySelector("[data-nav-hero]") as HTMLElement | null;
      if (!heroElement) {
        // Fallback: check window height or just default to short scroll
        const fallbackThreshold = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight - 80 : 50;
        setScrolled(window.scrollY > fallbackThreshold);
        return;
      }
      const heroHeight = heroElement.offsetHeight || 0;
      const triggerPoint = Math.max(0, heroHeight - 80);
      setScrolled(window.scrollY >= triggerPoint);
    };

    const handleScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [variant]);



  // Don't use bg-black class when transparent - use inline styles only
  const bgClass = variant === "solid"
    ? "bg-black"
    : scrolled
      ? "bg-black"
      : "bg-transparent";


  // Loading state (used as a Suspense fallback): avoid showing the wrong logged-out UI briefly.
  if (user === undefined) {
    const loadingBgStyle = variant === "transparent"
      ? {
        backgroundColor: "#000",
        backgroundImage: "linear-gradient(white 2px, transparent 2px), linear-gradient(90deg, white 2px, transparent 2px)",
        backgroundSize: "80px 80px",
      }
      : variant === "solid"
        ? { backgroundColor: "#000", background: "#000" }
        : undefined;

    return (
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${bgClass}`}
        style={loadingBgStyle}
        data-transparent-nav
      >
        <nav className="border-b-4 border-white bg-transparent" style={{ backgroundColor: "transparent" }} data-transparent-nav>
          <div className="flex h-20 items-center justify-between px-4 sm:px-8">
            <Link href="/" className="flex items-center hover:opacity-70 transition-opacity">
              <Image
                src="/FinanceDojo-white.png"
                alt="Financial Dojo"
                width={200}
                height={50}
                className="h-auto w-auto max-h-12"
                priority
              />
            </Link>

            <div className="flex items-center gap-4">
              <div
                className="h-10 w-44 border-4 border-white bg-white/10 animate-pulse"
                aria-hidden="true"
              />
              <div
                className="h-10 w-32 border-4 border-white bg-white/10 animate-pulse"
                aria-hidden="true"
              />
            </div>
          </div>
        </nav>
      </div>
    );
  }


  const containerStyle = variant === "solid"
    ? { backgroundColor: "#000", background: "#000" }
    : scrolled
      ? { backgroundColor: "#000", background: "#000" }
      : variant === "transparent"
        ? { backgroundColor: "transparent", background: "transparent" }
        : { backgroundColor: "transparent", background: "transparent" };


  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${bgClass}`}
      style={containerStyle}
      data-transparent-nav
    >
      <nav className="border-b-4 border-white bg-transparent" style={{ backgroundColor: "transparent" }} data-transparent-nav>
        <div className="flex h-20 items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center hover:opacity-70 transition-opacity">
            <Image
              src="/FinanceDojo-white.png"
              alt="Financial Dojo"
              width={200}
              height={50}
              className="h-auto w-auto max-h-12"
              priority
            />
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  href={dashboardUrl || "/dashboard"}
                  className="bg-white text-black font-black uppercase text-sm tracking-wider px-4 py-2 border-4 border-white hover:bg-black hover:text-white transition-colors flex items-center gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
                <BrutalistUserMenu user={user} />
              </>
            ) : (
              <Link
                href="/login"
                className="bg-white text-black font-black uppercase text-sm tracking-wider px-6 py-3 border-4 border-white hover:bg-black hover:text-white transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
