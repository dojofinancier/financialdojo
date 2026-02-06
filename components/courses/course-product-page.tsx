"use client";

import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
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
  ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { addToCart, isInCart } from "@/lib/utils/cart";
import { toast } from "sonner";
import { TestimonialCarousel } from "./testimonial-carousel";
import { StickyBottomCTA } from "./sticky-bottom-cta";
import Image from "next/image";

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

interface AboutAccordionItem {
  id: string;
  title: string;
  subtitle: string;
  richText: string;
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

interface Course {
  id: string;
  code: string | null;
  slug: string | null;
  title: string;
  shortDescription: string | null;
  description: string | null;
  aboutText: string | null;
  features: Feature[];
  testimonials: Testimonial[];
  aboutAccordionItems: AboutAccordionItem[];
  heroImages: string[];
  price: number;
  paymentType: string;
  accessDuration: number;
  category: {
    id: string;
    name: string;
  };
  modules: Module[];
  faqs: FAQ[];
  _count: {
    enrollments: number;
    modules: number;
    flashcards: number;
  };
  statsVideos?: number | null;
  statsQuestions?: number | null;
  statsFlashcards?: number | null;
  statsVideosLabel?: string | null;
  statsQuestionsLabel?: string | null;
  statsFlashcardsLabel?: string | null;
  totalQuizQuestions?: number;
  totalQuestionBankQuestions?: number;
  totalLearningActivities?: number;
}

interface CourseProductPageProps {
  course: Course;
  isEnrolled: boolean;
}

export function CourseProductPage({ course, isEnrolled }: CourseProductPageProps) {
  const router = useRouter();
  const [inCart, setInCart] = useState(false);
  const [aboutAccordionValue, setAboutAccordionValue] = useState<string>("");
  const [aboutAccordionProgress, setAboutAccordionProgress] = useState(0);
  const heroGridRef = useRef<HTMLDivElement | null>(null);
  const heroAccentRef = useRef<HTMLDivElement | null>(null);
  const heroMediaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInCart(isInCart(course.id, "course"));

    const handleCartUpdate = () => {
      setInCart(isInCart(course.id, "course"));
    };
    window.addEventListener("cartUpdated", handleCartUpdate);
    return () => window.removeEventListener("cartUpdated", handleCartUpdate);
  }, [course.id]);

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
      // Slightly stronger so it's noticeable.
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
    addToCart({
      id: course.id,
      type: "course",
      slug: course.slug,
      title: course.title,
      price: course.price,
    });
    toast.success("Added to cart");
    setInCart(true);
    // Use window.location for full page reload to ensure navbar renders
    window.location.href = "/cart";
  }, [course.id, course.slug, course.title, course.price]);

  const handleGoToCart = useCallback(() => {
    // Use window.location for full page reload to ensure navbar renders
    window.location.href = "/cart";
  }, []);

  const handleContinue = useCallback(() => {
    router.push(`/learn/${course.slug || course.id}`);
  }, [router, course.slug, course.id]);

  // Memoize arrays to prevent unnecessary re-renders
  // Memoize arrays to prevent unnecessary re-renders
  const features = useMemo(() => Array.isArray(course.features) ? course.features : [], [course.features]);
  const testimonials = useMemo(() => Array.isArray(course.testimonials) ? course.testimonials : [], [course.testimonials]);
  const faqs = useMemo(() => Array.isArray(course.faqs) ? course.faqs : [], [course.faqs]);

  const aboutAccordionItems = useMemo(
    () => Array.isArray(course.aboutAccordionItems)
      ? course.aboutAccordionItems.filter((item) => item && (item.title || item.subtitle || item.richText))
      : [],
    [course.aboutAccordionItems]
  );

  const activeAccordionItem = useMemo(
    () => aboutAccordionItems.find((item) => item.id === aboutAccordionValue) || null,
    [aboutAccordionItems, aboutAccordionValue]
  );

  const activeAccordionIndex = useMemo(
    () => Math.max(0, aboutAccordionItems.findIndex((item) => item.id === aboutAccordionValue)),
    [aboutAccordionItems, aboutAccordionValue]
  );

  useEffect(() => {
    if (!aboutAccordionItems.length) return;
    if (!aboutAccordionValue) {
      setAboutAccordionValue(aboutAccordionItems[0].id);
      setAboutAccordionProgress(0);
    }
  }, [aboutAccordionItems, aboutAccordionValue]);

  useEffect(() => {
    if (aboutAccordionItems.length <= 1) return;
    const interval = setInterval(() => {
      setAboutAccordionProgress((prev) => {
        if (prev >= 100) {
          const nextIndex = (activeAccordionIndex + 1) % aboutAccordionItems.length;
          setAboutAccordionValue(aboutAccordionItems[nextIndex].id);
          return 0;
        }
        return prev + 2;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [aboutAccordionItems, activeAccordionIndex]);

  // Memoize expensive calculations
  const totalVideos = useMemo(() =>
    course.modules.reduce((acc, m) =>
      acc + m.contentItems.filter(c => c.contentType === "VIDEO").length, 0),
    [course.modules]
  );

  const totalQuizzes = useMemo(() =>
    course.modules.reduce((acc, m) =>
      acc + m.contentItems.filter(c => c.contentType === "QUIZ").length, 0),
    [course.modules]
  );

  // Calculate total questions (quiz questions + question bank questions + learning activities)
  const totalQuestions = useMemo(() =>
    (course.totalQuizQuestions || 0) +
    (course.totalQuestionBankQuestions || 0) +
    (course.totalLearningActivities || 0),
    [course.totalQuizQuestions, course.totalQuestionBankQuestions, course.totalLearningActivities]
  );

  // Stats to display (use manual overrides if set, otherwise use calculated values)
  const displayStats = useMemo(() => ({
    videos: {
      count: course.statsVideos !== null && course.statsVideos !== undefined ? course.statsVideos : totalVideos,
      label: course.statsVideosLabel || "Videos"
    },
    questions: {
      count: course.statsQuestions !== null && course.statsQuestions !== undefined ? course.statsQuestions : totalQuestions,
      label: course.statsQuestionsLabel || "Questions"
    },
    flashcards: {
      count: course.statsFlashcards !== null && course.statsFlashcards !== undefined ? course.statsFlashcards : (course._count.flashcards || 0),
      label: course.statsFlashcardsLabel || "Flashcards"
    },
  }), [course.statsVideos, course.statsQuestions, course.statsFlashcards, course.statsVideosLabel, course.statsQuestionsLabel, course.statsFlashcardsLabel, totalVideos, totalQuestions, course._count.flashcards]);

  // Memoize hero image source for preloading
  const heroImageSrc = useMemo(() =>
    course.heroImages && course.heroImages.length > 0
      ? course.heroImages[0]
      : "/screenshots1.png",
    [course.heroImages]
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
        document.head.removeChild(link);
      };
    }
  }, [heroImageSrc]);

  return (
    <>
      <StickyBottomCTA
        price={course.price}
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
        <section className="relative overflow-hidden bg-black pt-28 sm:pt-32 border-b-4 border-white" data-nav-hero>
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
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center border-2 border-white px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-white/80">
                      {course.category.name}
                    </div>
                    {course.code && (
                      <div className="inline-flex items-center border-2 border-white px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-white/80">
                        {course.code}
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className="text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
                    {course.title}
                  </h1>

                  {/* Short description */}
                  {course.shortDescription && (
                    <div className="max-w-2xl">
                      <div className="border-l-4 border-primary pl-6 py-2">
                        <p className="text-xl sm:text-2xl font-light leading-relaxed opacity-80">
                          {course.shortDescription}
                        </p>
                      </div>
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
                          Continue learning →
                        </span>
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
                          <div className="text-4xl font-black text-primary">{formatCurrency(course.price)}</div>
                          <div className="font-mono text-xs uppercase tracking-[0.25em] text-white/70 mt-2">
                            for 12 months of unlimited access
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
                {/* MATCHING FRENCH VERSION: wrapped in hero-float and styled identically */}
                <div className="relative hidden lg:block max-w-[550px] w-full">
                  <div className="hero-float">
                    <div
                      ref={heroMediaRef}
                      className="relative overflow-hidden aspect-[3/4] shadow-[10px_10px_0_0_hsl(var(--primary))]"
                      style={{
                        transform: "translate3d(0, var(--parallax-y, 0px), 0)",
                        willChange: "transform",
                      }}
                    >
                      <Image
                        src={heroImageSrc}
                        alt={`${course.title} - Screenshot`}
                        fill
                        className="object-contain"
                        priority
                        sizes="(max-width: 1024px) 0vw, 50vw"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* SECTION 2: Clientele Accordion */}
        {/* ============================================ */}
        {aboutAccordionItems.length > 0 && (
          <section className="py-16 md:py-24 bg-white text-black border-b border-black/10">
            <div className="px-4 sm:px-8">
              <div className="max-w-[1400px] mx-auto">
                <div className="mb-10">
                  <span className="font-mono text-xs uppercase tracking-[0.3em] text-black/60 block">
                    [OUR CLIENTELE]
                  </span>
                  <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mt-3">
                    Ideal for...
                  </h2>
                  <p className="text-black/70 mt-4 max-w-2xl">
                    Select your profile to see how this preparatory course can help you.
                  </p>
                </div>

                <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-stretch">
                  <div className="divide-y divide-black/10 border-y border-black/10 h-full">
                    {aboutAccordionItems.map((item) => {
                      const isOpen = aboutAccordionValue === item.id;
                      return (
                        <div key={item.id} className="py-6 relative pl-6">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-black/10">
                            <div
                              className="bg-black transition-all"
                              style={{ height: isOpen ? `${aboutAccordionProgress}%` : "0%" }}
                            />
                          </div>
                          <button
                            type="button"
                            className="w-full text-left flex items-start justify-between gap-6"
                            aria-expanded={isOpen}
                            onClick={() => {
                              setAboutAccordionValue(item.id);
                              setAboutAccordionProgress(0);
                            }}
                          >
                            <div className="space-y-2">
                              <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
                                {item.title}
                              </h3>
                              {isOpen && item.subtitle && (
                                <p className="text-sm md:text-base text-black/70">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="h-full border-4 border-black bg-white p-6 md:p-8 shadow-[8px_8px_0_0_rgba(0,0,0,0.2)] flex items-center justify-center text-left">
                    {activeAccordionItem?.richText ? (
                      <div
                        className="prose prose-lg max-w-none leading-relaxed font-semibold"
                        dangerouslySetInnerHTML={{ __html: activeAccordionItem.richText }}
                      />
                    ) : (
                      <p className="text-black/50">Select an item.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ============================================ */}
        {/* SECTION 2 & 3: About & Course Content */}
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
                  {course.aboutText ? (
                    <div
                      className="prose max-w-none leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: course.aboutText }}
                    />
                  ) : course.description ? (
                    <div
                      className="prose max-w-none leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: course.description }}
                    />
                  ) : (
                    <p className="opacity-80">
                      Discover this comprehensive course to help you reach your professional goals.
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-0 pt-6 border-4 border-black">
                    <div className="text-center p-4 border-r-4 border-black">
                      <div className="text-4xl font-black text-primary">{displayStats.videos.count}</div>
                      <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60 mt-1">{displayStats.videos.label}</div>
                    </div>
                    <div className="text-center p-4 border-r-4 border-black">
                      <div className="text-4xl font-black text-primary">{displayStats.questions.count}</div>
                      <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60 mt-1">{displayStats.questions.label}</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-4xl font-black text-primary">{displayStats.flashcards.count}</div>
                      <div className="font-mono text-xs uppercase tracking-[0.25em] text-black/60 mt-1">{displayStats.flashcards.label}</div>
                    </div>
                  </div>
                </div>

                {/* Course Content */}
                <div className="space-y-6">
                  <span className="font-mono text-xs uppercase tracking-[0.3em] text-black/60 block">
                    [PROGRAMME]
                  </span>
                  <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                    Detailed curriculum
                  </h2>

                  <div className="space-y-0 border-4 border-black max-h-[520px] overflow-y-auto">
                    {course.modules.map((module, index) => (
                      <div
                        key={module.id}
                        className="group p-5 bg-white border-b-4 border-black last:border-b-0 hover:bg-primary hover:text-black transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs uppercase tracking-[0.25em] opacity-60">
                              Module {index + 1}
                            </div>
                            <h3 className="font-black uppercase tracking-tight">
                              {module.title}
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
                    What our students say
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
                Ready to start your preparation?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                Join the {856 + course._count.enrollments} students who have already trusted this course.
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
                      Continue learning →
                    </span>
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
                      <p className="text-3xl font-black text-primary">{formatCurrency(course.price)}</p>
                      <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/70 mt-2">
                        for 12 months of unlimited access
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


