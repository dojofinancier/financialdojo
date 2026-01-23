"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { formatCurrency } from "@/lib/utils/format";
import { 
  BookOpen, 
  Clock, 
  Users, 
  CheckCircle2, 
  ShoppingCart,
  Play,
  FileText,
  HelpCircle,
  Award,
  Target,
  Zap,
  Shield,
  Star,
  Trophy,
  GraduationCap,
  Brain,
  Lightbulb,
  Rocket,
  Heart,
  MessageCircle,
  Calendar,
  BarChart,
  Headphones,
  Download,
  Video,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { addToCart, isInCart } from "@/lib/utils/cart";
import { toast } from "sonner";
import { TestimonialCarousel } from "../courses/testimonial-carousel";
import { StickyBottomCTA } from "../courses/sticky-bottom-cta";
import Image from "next/image";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";

// Icon mapping for dynamic features
const iconMap: Record<string, any> = {
  BookOpen, Video, FileText, HelpCircle, Award, Clock,
  Users, CheckCircle: CheckCircle2, Target, Zap, Shield, Star,
  Trophy, GraduationCap, Brain, Lightbulb, Rocket, Heart,
  MessageCircle, Calendar, BarChart, Headphones, Download, Play,
  CheckCircle2
};

interface Feature {
  id: string;
  icon: string;
  text: string;
}

interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  avatar?: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  order: number;
  contentItems: Array<{
    id: string;
    contentType: string;
    order: number;
  }>;
}

interface Cohort {
  id: string;
  slug: string | null;
  title: string;
  shortDescription: string | null;
  description: string | null;
  aboutText: string | null;
  features: Feature[];
  testimonials: Testimonial[];
  heroImages: string[];
  price: number;
  maxStudents: number;
  enrollmentClosingDate: Date;
  accessDuration: number;
  instructor: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  cohortModules: Array<{
    id: string;
    order: number;
    module: Module;
  }>;
  faqs: FAQ[];
  _count: {
    enrollments: number;
  };
  isEnrollmentOpen: boolean;
  spotsRemaining: number;
  totalQuestions?: number;
  totalFlashcards?: number;
}

interface CohortProductPageProps {
  cohort: Cohort;
  isEnrolled: boolean;
}

export function CohortProductPage({ cohort, isEnrolled }: CohortProductPageProps) {
  const router = useRouter();
  const [inCart, setInCart] = useState(false);
  const heroGridRef = useRef<HTMLDivElement | null>(null);
  const heroAccentRef = useRef<HTMLDivElement | null>(null);
  const heroMediaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInCart(isInCart(cohort.id, "cohort"));
    
    const handleCartUpdate = () => {
      setInCart(isInCart(cohort.id, "cohort"));
    };
    window.addEventListener("cartUpdated", handleCartUpdate);
    return () => window.removeEventListener("cartUpdated", handleCartUpdate);
  }, [cohort.id]);

  useEffect(() => {
    let raf = 0;
    let ticking = false;
    const reduceMotion = typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      : false;
    if (reduceMotion) return;

    const update = () => {
      ticking = false;
      raf = 0;
      const y = window.scrollY || 0;
      const gridY = Math.min(y * 0.30, 170);
      const accentY = Math.min(y * 0.16, 120);
      const mediaY = Math.min(y * 0.22, 140);

      // Use requestAnimationFrame for smooth updates
      if (heroGridRef.current) heroGridRef.current.style.setProperty("--parallax-y", `${gridY}px`);
      if (heroAccentRef.current) heroAccentRef.current.style.setProperty("--parallax-y", `${accentY}px`);
      if (heroMediaRef.current) heroMediaRef.current.style.setProperty("--parallax-y", `${mediaY}px`);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        if (raf) window.cancelAnimationFrame(raf);
        raf = window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!cohort.isEnrollmentOpen) {
      toast.error("Registrations are closed for this cohort");
      return;
    }
    if (cohort.spotsRemaining <= 0) {
      toast.error("This cohort is full");
      return;
    }
    
    addToCart({
      id: cohort.id,
      type: "cohort",
      slug: cohort.slug,
      title: cohort.title,
      price: cohort.price,
    });
    toast.success("Added to cart");
    setInCart(true);
    window.location.href = "/cart";
  }, [cohort.id, cohort.slug, cohort.title, cohort.price, cohort.isEnrollmentOpen, cohort.spotsRemaining]);

  const handleGoToCart = useCallback(() => {
    window.location.href = "/cart";
  }, []);

  const handleContinue = useCallback(() => {
    router.push(`/cohorts/${cohort.slug || cohort.id}/learn`);
  }, [router, cohort.slug, cohort.id]);

  // Memoize arrays to prevent unnecessary re-renders
  const features = useMemo(() => Array.isArray(cohort.features) ? cohort.features : [], [cohort.features]);
  const testimonials = useMemo(() => Array.isArray(cohort.testimonials) ? cohort.testimonials : [], [cohort.testimonials]);
  const faqs = useMemo(() => Array.isArray(cohort.faqs) ? cohort.faqs : [], [cohort.faqs]);
  const heroImages = useMemo(() => Array.isArray(cohort.heroImages) ? cohort.heroImages : [], [cohort.heroImages]);

  // Get stats for display - memoized
  const totalQuestions = useMemo(() => cohort.totalQuestions || 0, [cohort.totalQuestions]);
  const totalFlashcards = useMemo(() => cohort.totalFlashcards || 0, [cohort.totalFlashcards]);
  const coachingSessions = useMemo(() => 8, []); // Default number of coaching sessions

  const instructorName = useMemo(() => 
    cohort.instructor
      ? `${cohort.instructor.firstName || ""} ${cohort.instructor.lastName || ""}`.trim() || cohort.instructor.email
      : "Instructor not assigned",
    [cohort.instructor]
  );

  // Memoize hero image source for preloading
  const heroImageSrc = useMemo(() => 
    heroImages.length > 0 ? heroImages[0] : "/screenshots1.png",
    [heroImages]
  );

  // Preload hero image for LCP improvement
  useEffect(() => {
    if (heroImageSrc) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = heroImageSrc;
      document.head.appendChild(link);
      return () => {
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      };
    }
  }, [heroImageSrc]);

  return (
    <>
      <StickyBottomCTA
        price={cohort.price}
        isEnrolled={isEnrolled}
        inCart={inCart}
        onAddToCart={handleAddToCart}
        onGoToCart={handleGoToCart}
        onContinue={handleContinue}
      />
      <div className="min-h-screen bg-black text-white">
      {/* ============================================ */}
      {/* SECTION 1: HERO - Above the Fold */}
      {/* ============================================ */}
      <section className="relative overflow-hidden bg-black pt-28 sm:pt-32 border-b-4 border-white">
        {/* Hard grid */}
        <div
          ref={heroGridRef}
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
          ref={heroAccentRef}
          className="absolute top-0 right-0 w-1/2 h-full bg-primary transform origin-top-right skew-x-[-12deg] translate-x-1/3"
          style={{
            transform: "translate3d(0, var(--parallax-y, 0px), 0) skewX(-12deg) translateX(33.3333%)",
            willChange: "transform",
          }}
        />

        <div className="relative px-4 sm:px-8 py-16 md:py-24">
          <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="space-y-8">
              {/* Category badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center border-2 border-white px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-white/80">
                  Professional cohort
                </div>
                {cohort.instructor && (
                  <div className="inline-flex items-center border-2 border-white px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-white/80">
                    {instructorName}
                  </div>
                )}
                {!cohort.isEnrollmentOpen && (
                  <div className="inline-flex items-center border-2 border-white px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-white/80 bg-orange-500">
                    Enrollment closed
                  </div>
                )}
                {cohort.isEnrollmentOpen && cohort.spotsRemaining <= 0 && (
                  <div className="inline-flex items-center border-2 border-white px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-white/80 bg-red-500">
                    Full
                  </div>
                )}
                {cohort.isEnrollmentOpen && cohort.spotsRemaining > 0 && (
                  <div className="inline-flex items-center border-2 border-white px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-white/80 bg-primary text-black">
                    {cohort.spotsRemaining} spot{cohort.spotsRemaining !== 1 ? "s" : ""} available
                  </div>
                )}
              </div>

              {/* Title */}
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
                {cohort.title}
              </h1>

              {/* Short description */}
              {cohort.shortDescription && (
                <div className="max-w-2xl">
                  <div className="border-l-4 border-primary pl-6 py-2">
                    <p className="text-xl sm:text-2xl font-light leading-relaxed opacity-80">
                      {cohort.shortDescription}
                    </p>
                  </div>
                </div>
              )}

              {/* Enrollment Status Alerts */}
              {!cohort.isEnrollmentOpen && (
                <div className="border-4 border-orange-500 bg-orange-500/20 p-4">
                  <div className="flex items-center gap-2 text-orange-300">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">Enrollment is closed</span>
                  </div>
                  <p className="text-sm text-orange-200 mt-2">
                    Enrollment deadline was {format(new Date(cohort.enrollmentClosingDate), "d MMMM yyyy", { locale: enCA })}
                  </p>
                </div>
              )}

              {cohort.isEnrollmentOpen && cohort.spotsRemaining <= 0 && (
                <div className="border-4 border-red-500 bg-red-500/20 p-4">
                  <div className="flex items-center gap-2 text-red-300">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">Cohort full</span>
                  </div>
                  <p className="text-sm text-red-200 mt-2">
                    All {cohort.maxStudents} spots are taken
                  </p>
                </div>
              )}

              {/* CTA buttons */}
              <div className="flex flex-col gap-4 max-w-xl">
                {isEnrolled ? (
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="bg-white text-black font-black uppercase tracking-wider px-10 py-5 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors shadow-[8px_8px_0_0_hsl(var(--primary))]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      Access cohort →
                    </span>
                  </button>
                ) : !cohort.isEnrollmentOpen || cohort.spotsRemaining <= 0 ? (
                  <button
                    type="button"
                    disabled
                    className="bg-white/50 text-white/50 font-black uppercase tracking-wider px-10 py-5 border-4 border-white/50 cursor-not-allowed"
                  >
                    Enrollment closed
                  </button>
                ) : inCart ? (
                  <button
                    type="button"
                    onClick={handleGoToCart}
                    className="bg-white text-black font-black uppercase tracking-wider px-10 py-5 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors shadow-[8px_8px_0_0_hsl(var(--primary))]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      View cart →
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="bg-white text-black font-black uppercase tracking-wider px-10 py-5 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors shadow-[8px_8px_0_0_hsl(var(--primary))]"
                    >
                      Enroll now →
                    </button>
                    <div className="border-4 border-white p-6">
                      <div className="text-4xl font-black text-primary">{formatCurrency(cohort.price)}</div>
                      <div className="font-mono text-xs uppercase tracking-[0.25em] text-white/70 mt-2">
                        for {cohort.accessDuration} day{cohort.accessDuration !== 1 ? "s" : ""} of access
                      </div>
                      <div className="font-mono text-xs uppercase tracking-[0.25em] text-white/70 mt-1">
                        Closes: {format(new Date(cohort.enrollmentClosingDate), "d MMMM yyyy", { locale: enCA })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Features grid */}
              {features.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                  {features.slice(0, 8).map((feature) => {
                    const IconComponent = iconMap[feature.icon] || CheckCircle2;
                    return (
                      <div key={feature.id} className="flex items-center gap-3 border-2 border-white/30 px-4 py-3">
                        <IconComponent className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="text-white/85 text-base">{feature.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Screen captures / Product screenshot */}
            <div className="relative hidden lg:block">
              <div
                ref={heroMediaRef}
                className="relative border-4 border-white overflow-hidden aspect-[4/3] shadow-[10px_10px_0_0_hsl(var(--primary))]"
                style={{
                  transform: "translate3d(0, var(--parallax-y, 0px), 0)",
                  willChange: "transform",
                }}
              >
                <Image
                  src={heroImageSrc}
                  alt={`${cohort.title} - Screenshot`}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 1024px) 0vw, 50vw"
                />
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 2 & 3: About & Cohort Content */}
      {/* ============================================ */}
      <section className="py-16 md:py-24 bg-white text-black">
        <div className="px-4 sm:px-8">
          <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* About Section */}
            <div className="space-y-6">
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-black/60 block">
                [ABOUT]
              </span>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                Everything you need to know
              </h2>
              {cohort.aboutText ? (
                <div 
                  className="prose max-w-none leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: cohort.aboutText }}
                />
              ) : cohort.description ? (
                <div 
                  className="prose max-w-none leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: cohort.description }}
                />
              ) : (
                <p className="opacity-80">
                  Discover this professional cohort that will help you reach your goals with personalized support.
                </p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-0 pt-6 border-4 border-black">
                <div className="text-center p-4 border-r-4 border-black">
                  <div className="text-4xl font-black text-primary">{totalQuestions}</div>
                  <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60 mt-1">Questions</div>
                </div>
                <div className="text-center p-4 border-r-4 border-black">
                  <div className="text-4xl font-black text-primary">{totalFlashcards}</div>
                  <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60 mt-1">Flashcards</div>
                </div>
                <div className="text-center p-4">
                  <div className="text-4xl font-black text-primary">{coachingSessions}</div>
                  <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60 mt-1">Coaching sessions</div>
                </div>
              </div>
            </div>

            {/* Cohort Content */}
            <div className="space-y-6">
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-black/60 block">
                [PROGRAMME]
              </span>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                Detailed curriculum
              </h2>
              
              <div className="space-y-0 border-4 border-black max-h-[520px] overflow-y-auto">
                {cohort.cohortModules.map((cohortModule, index) => (
                  <div 
                    key={cohortModule.id} 
                    className="group p-5 bg-white border-b-4 border-black last:border-b-0 hover:bg-primary hover:text-black transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs uppercase tracking-[0.25em] opacity-60">
                          Module {index + 1}
                        </div>
                        <h3 className="font-black uppercase tracking-tight">
                          {cohortModule.module.title}
                        </h3>
                      </div>
                      <ChevronRight className="h-5 w-5 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 4: Testimonials */}
      {/* ============================================ */}
      {testimonials.length > 0 && (
        <section className="py-16 md:py-24 bg-black text-white border-t-4 border-white">
          <div className="px-4 sm:px-8">
            <div className="max-w-[1400px] mx-auto">
            <div className="text-center mb-12">
              <span className="text-primary font-mono text-xs uppercase tracking-[0.3em] block mb-4">
                [TESTIMONIALS]
              </span>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                What participants say
              </h2>
            </div>
            
            <div className="max-w-6xl mx-auto">
              <TestimonialCarousel testimonials={testimonials} />
            </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* SECTION 5: FAQ */}
      {/* ============================================ */}
      {faqs.length > 0 && (
        <section className="py-16 md:py-24 bg-white text-black border-t-4 border-black">
          <div className="px-4 sm:px-8">
            <div className="max-w-[1400px] mx-auto">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <span className="font-mono text-xs uppercase tracking-[0.3em] text-black/60 block mb-4">
                  [FAQ]
                </span>
                <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                  Frequently asked questions
                </h2>
              </div>

              <Accordion type="single" collapsible className="space-y-4">
                {faqs.map((faq, index) => (
                  <AccordionItem 
                    key={faq.id} 
                    value={faq.id}
                    className="border-4 border-black px-6 bg-white data-[state=open]:bg-primary transition-colors"
                  >
                    <AccordionTrigger className="text-left font-black uppercase tracking-tight py-5">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 opacity-80">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* SECTION 6: Final CTA */}
      {/* ============================================ */}
      <section className="py-16 md:py-24 bg-black text-white border-t-4 border-white">
        <div className="px-4 sm:px-8 text-center">
          <div className="max-w-[1400px] mx-auto">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-6">
            Ready to join this cohort?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Join the {cohort._count.enrollments} participant{cohort._count.enrollments !== 1 ? "s" : ""} who already trusted this cohort.
          </p>
          
          <div className="flex flex-col items-center gap-4">
            {isEnrolled ? (
              <button
                type="button"
                onClick={handleContinue}
                className="bg-white text-black font-black uppercase tracking-wider px-10 py-5 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors shadow-[8px_8px_0_0_hsl(var(--primary))]"
              >
                <span className="inline-flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Access cohort →
                </span>
              </button>
            ) : !cohort.isEnrollmentOpen || cohort.spotsRemaining <= 0 ? (
              <button
                type="button"
                disabled
                className="bg-white/50 text-white/50 font-black uppercase tracking-wider px-10 py-5 border-4 border-white/50 cursor-not-allowed"
              >
                Enrollment closed
              </button>
            ) : inCart ? (
              <button
                type="button"
                onClick={handleGoToCart}
                className="bg-white text-black font-black uppercase tracking-wider px-10 py-5 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors shadow-[8px_8px_0_0_hsl(var(--primary))]"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  View cart →
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="bg-white text-black font-black uppercase tracking-wider px-10 py-5 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors shadow-[8px_8px_0_0_hsl(var(--primary))]"
                >
                  Enroll now →
                </button>
                <div className="border-4 border-white p-6">
                  <p className="text-3xl font-black text-primary">{formatCurrency(cohort.price)}</p>
                  <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/70 mt-2">
                    for {cohort.accessDuration} day{cohort.accessDuration !== 1 ? "s" : ""} of access
                  </p>
                  <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/70 mt-1">
                    Closes: {format(new Date(cohort.enrollmentClosingDate), "d MMMM yyyy", { locale: enCA })}
                  </p>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
