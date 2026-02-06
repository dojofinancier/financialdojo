"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// ============================================
// SECTION 2: HERO - BRUTALIST
// ============================================
function HeroSection() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const accentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;

    // Respect user preferences
    const reduceMotion = typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      : false;
    if (reduceMotion) return;

    const update = () => {
      raf = 0;
      const y = window.scrollY || 0;

      // Subtle parallax (clamped) so it feels “alive” but not gimmicky.
      // (Slightly increased so it's actually perceptible.)
      const gridY = Math.min(y * 0.35, 180);
      const accentY = Math.min(y * 0.18, 120);

      if (gridRef.current) gridRef.current.style.setProperty("--parallax-y", `${gridY}px`);
      if (accentRef.current) accentRef.current.style.setProperty("--parallax-y", `${accentY}px`);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="relative min-h-screen bg-black text-white overflow-hidden" data-nav-hero>
      {/* Hard grid pattern */}
      <div
        ref={gridRef}
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(white 2px, transparent 2px),
            linear-gradient(90deg, white 2px, transparent 2px)
          `,
          backgroundSize: "80px 80px",
          transform: "translate3d(0, var(--parallax-y, 0px), 0)",
          willChange: "transform",
        }}
      />

      {/* Diagonal accent */}
      <div
        ref={accentRef}
        className="absolute top-0 right-0 w-1/3 h-full bg-primary transform origin-top-right skew-x-[-12deg] translate-x-1/4"
        style={{
          transform: "translate3d(0, var(--parallax-y, 0px), 0) skewX(-12deg) translateX(25%)",
          willChange: "transform",
        }}
      />

      <div className="relative pt-32 pb-20 px-4 sm:px-8 min-h-screen flex flex-col justify-center">
        {/* Main content - asymmetric layout */}
        <div className="max-w-[1400px] mx-auto w-full">
          {/* Oversized headline */}
          <div className="mb-8">
            <span className="text-primary font-mono text-sm uppercase tracking-[0.3em] block mb-4">
              [FINANCIAL COURSES]
            </span>
            <h1 className="text-[12vw] sm:text-[10vw] md:text-[8vw] font-black uppercase leading-[0.85] tracking-tighter">
              MASTER
              <br />
              <span className="text-primary">FINANCE</span>
            </h1>
          </div>

          {/* Subtext with hard box */}
          <div className="max-w-xl mb-12">
            <div className="border-l-4 border-primary pl-6 py-2">
              <p className="text-xl sm:text-2xl font-light leading-relaxed">
                OCRI, AMF, CSI certifications.
                <span className="font-bold"> Pass your exams with confidence.</span>
              </p>
            </div>
          </div>

          {/* CTA - Brutalist buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="#qui-etes-vous"
              className="inline-block bg-white text-black font-black uppercase text-lg tracking-wider px-10 py-5 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors shadow-[8px_8px_0_0_hsl(var(--primary))]"
            >
              Get started →
            </Link>
            <Link
              href="/courses"
              className="inline-block bg-transparent text-white font-black uppercase text-lg tracking-wider px-10 py-5 border-4 border-white hover:bg-white hover:text-black transition-colors"
            >
              View courses
            </Link>
          </div>

          {/* Stats row - hard borders */}
          <div className="mt-20 flex flex-wrap gap-0 border-4 border-white inline-flex">
            <div className="px-8 py-6 border-r-4 border-white">
              <div className="text-5xl font-black text-primary">2500+</div>
              <div className="text-sm uppercase tracking-wider mt-1 font-mono">Students</div>
            </div>
            <div className="px-8 py-6 border-r-4 border-white">
              <div className="text-5xl font-black text-primary">95%</div>
              <div className="text-sm uppercase tracking-wider mt-1 font-mono">Success</div>
            </div>
            <div className="px-8 py-6">
              <div className="text-5xl font-black text-primary">15+</div>
              <div className="text-sm uppercase tracking-wider mt-1 font-mono">Years</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// SECTION 3: CLIENT PATHS - THE DECISION
// ============================================
function ClientPathsSection() {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  const paths = [
    {
      id: "pro",
      number: "01",
      title: "PROFESSIONALS",
      subtitle: "FINANCIAL INDUSTRY",
      description: "Advisors, representatives, managers, assistants. Get your OCRI, AMF and CSI certifications.",
      features: ["CCVM / CSC", "ERCI / CIRE", "Securities examination"],
      color: "bg-primary",
      textColor: "text-black",
      link: "/courses?category=professionnels",
    },
    {
      id: "inv",
      number: "02",
      title: "INVESTORS",
      subtitle: "INDIVIDUALS",
      description: "Manage your wealth. Understand the markets. Make informed decisions.",
      features: ["Portfolio management", "Fundamental analysis", "Strategies"],
      color: "bg-white",
      textColor: "text-black",
      link: "/investor/waitlist",
    },
    {
      id: "ent",
      number: "03",
      title: "ENTREPRENEURS",
      subtitle: "& EXECUTIVES",
      description: "Corporate finance, financial planning, growth.",
      features: ["Corporate finance", "Planning", "Fundraising"],
      color: "bg-black",
      textColor: "text-white",
      link: "/entrepreneur/waitlist",
    },
  ];

  return (
    <section id="qui-etes-vous" className="relative bg-white py-24 sm:py-32">
      <div className="px-4 sm:px-8 mb-16">
        <div className="max-w-[1400px] mx-auto">
          <span className="font-mono text-sm uppercase tracking-[0.3em] text-black/50 block mb-4">
            [CHOOSE YOUR PATH]
          </span>
          <h2 className="text-6xl sm:text-7xl md:text-8xl font-black uppercase tracking-tighter text-black leading-[0.9]">
            WHO<br />ARE YOU?
          </h2>
        </div>
      </div>

      <div className="px-4 sm:px-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid md:grid-cols-3 gap-0 border-4 border-black">
            {paths.map((path, index) => (
              <Link
                key={path.id}
                href={path.link}
                className={`group relative ${path.color} ${path.textColor} p-8 sm:p-10 ${index < 2 ? 'md:border-r-4 border-black' : ''} border-b-4 md:border-b-0 border-black last:border-b-0 transition-all duration-200 hover:scale-[1.02] hover:z-10`}
                style={{
                  boxShadow: hoveredPath === path.id ? '12px 12px 0 0 black' : 'none',
                }}
                onMouseEnter={() => setHoveredPath(path.id)}
                onMouseLeave={() => setHoveredPath(null)}
              >
                <div className="font-mono text-sm opacity-50 mb-8">{path.number}</div>
                <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-2">
                  {path.title}
                </h3>
                <div className="text-sm font-mono uppercase tracking-wider opacity-70 mb-6">
                  {path.subtitle}
                </div>
                <p className="text-lg leading-relaxed mb-8 opacity-90">
                  {path.description}
                </p>
                <ul className="space-y-2 mb-8">
                  {path.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-mono uppercase tracking-wide">
                      <span className="w-2 h-2 bg-current" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 font-black uppercase tracking-wider group-hover:gap-4 transition-all">
                  DISCOVER
                  <span className="text-2xl">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 mt-12">
        <div className="max-w-[1400px] mx-auto">
          <p className="font-mono text-sm text-black/50 uppercase tracking-wider">
            Not sure? <Link href="/courses" className="underline hover:text-primary">See all courses</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================
// SECTION 4: ABOUT
// ============================================
function AboutSection() {
  return (
    <section className="relative bg-black text-white py-24 sm:py-32 overflow-hidden">
      <div className="absolute bottom-0 left-0 w-1/2 h-32 bg-primary transform origin-bottom-left skew-y-[-3deg]" />

      <div className="relative px-4 sm:px-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="font-mono text-sm uppercase tracking-[0.3em] text-white/50 block mb-4">
                [ABOUT]
              </span>
              <h2 className="text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] mb-8">
                FIELD
                <br />
                <span className="text-primary">EXPERTISE</span>
              </h2>

              <div className="space-y-6 text-lg leading-relaxed max-w-xl">
                <p>
                  Financial Dojo was born from the desire to democratize access to high-quality financial training.
                </p>
                <p className="opacity-70">
                  Founded by industry professionals, our approach combines academic rigor and practical experience. Our unique method has helped hundreds of professionals earn their certifications.
                </p>
              </div>

              <Link
                href="/about"
                className="inline-block mt-10 bg-white text-black font-black uppercase text-sm tracking-wider px-8 py-4 border-4 border-white hover:bg-primary hover:border-primary transition-colors shadow-[6px_6px_0_0_hsl(var(--primary))]"
              >
                Learn more →
              </Link>
            </div>

            <div className="relative">
              <div className="border-4 border-white p-8 sm:p-12">
                <div className="space-y-8">
                  <div className="border-b-4 border-white/20 pb-8">
                    <div className="text-8xl sm:text-9xl font-black text-primary leading-none">95%</div>
                    <div className="font-mono text-sm uppercase tracking-wider mt-2">Exam pass rate</div>
                  </div>
                  <div className="border-b-4 border-white/20 pb-8">
                    <div className="text-8xl sm:text-9xl font-black text-primary leading-none">2500+</div>
                    <div className="font-mono text-sm uppercase tracking-wider mt-2">Students trained</div>
                  </div>
                  <div>
                    <div className="text-8xl sm:text-9xl font-black text-primary leading-none">15+</div>
                    <div className="font-mono text-sm uppercase tracking-wider mt-2">Years of expertise</div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-full h-full border-4 border-primary -z-10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// SECTION 5: FOOTER
// ============================================
function HomeFooter() {
  const [currentYear, setCurrentYear] = useState(2025);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="home-footer bg-white text-black border-t-4 border-black">
      <div className="px-4 sm:px-8 py-16 sm:py-20">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="lg:col-span-1">
              <Link href="/" className="inline-block mb-6">
                <Image
                  src="/FinanceDojo-black.png"
                  alt="Financial Dojo"
                  width={200}
                  height={50}
                  className="h-auto w-auto max-h-12"
                />
              </Link>
              <p className="text-sm leading-relaxed opacity-70 font-mono">
                World-class financial training.
                <br />
                Professionals. Investors. Entrepreneurs.
              </p>
            </div>

            <div>
              <h3 className="font-black uppercase tracking-wider text-sm mb-6 border-b-4 border-black pb-2 inline-block">
                Courses
              </h3>
              <ul className="space-y-3">
                <li><Link href="/courses/ccvm-pcvm" className="text-sm font-mono hover:text-primary transition-colors">CCVM / CSC</Link></li>
                <li><Link href="/courses/pdg-ciro" className="text-sm font-mono hover:text-primary transition-colors">ERCI / CIRE</Link></li>
                <li><Link href="/courses" className="text-sm font-mono hover:text-primary transition-colors">All courses →</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-black uppercase tracking-wider text-sm mb-6 border-b-4 border-black pb-2 inline-block">
                Company
              </h3>
              <ul className="space-y-3">
                <li><Link href="/about" className="text-sm font-mono hover:text-primary transition-colors">About</Link></li>
                <li><Link href="/article" className="text-sm font-mono hover:text-primary transition-colors">Publications</Link></li>
                <li><Link href="/contact" className="text-sm font-mono hover:text-primary transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-black uppercase tracking-wider text-sm mb-6 border-b-4 border-black pb-2 inline-block">
                Legal
              </h3>
              <ul className="space-y-3">
                <li><Link href="/privacy-policy" className="text-sm font-mono hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link href="/terms-and-conditions" className="text-sm font-mono hover:text-primary transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t-4 border-black">
        <div className="px-4 sm:px-8 py-6">
          <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm font-mono opacity-50">
              © {currentYear} FINANCIAL DOJO. ALL RIGHTS RESERVED.
            </p>
            <p className="text-sm font-mono opacity-50">
              MONTREAL, QUEBEC
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================
// MAIN CLIENT COMPONENT
// ============================================
export function HomePageClient() {
  return (
    <>
      <main>
        <HeroSection />
        <ClientPathsSection />
        <AboutSection />
      </main>
      <HomeFooter />
    </>
  );
}
