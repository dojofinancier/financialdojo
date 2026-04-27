
const fs = require("fs");
const path = require("path");

const filePath = path.join("c:", "Users", "User", "Desktop", "financial_dojo", "app", "home-page-client.tsx");
let content = fs.readFileSync(filePath, "utf8");

// 1. Add EXAM_HREF right after imports
if (!content.includes("EXAM_HREF")) {
  const importsEnd = content.indexOf("// ============================================");
  const newHeader = `
/** Product URLs — align slugs with published courses in admin if a link 404s. */
const EXAM_HREF = {
  erci: "/courses/erci",
  evmcd: "/courses/evmcd",
  ccvmVol1: "/courses/ccvm-1",
  ccvmVol2: "/courses/ccvm-2",
  negp: "/courses/negp",
} as const;

`;
  content = content.slice(0, importsEnd) + newHeader + content.slice(importsEnd);
}

// 2. Replace href="#qui-etes-vous" with href="#choose-your-exam" in HeroSection
content = content.replace(/href="#qui-etes-vous"/g, `href="#choose-your-exam"`);

// 3. Replace ClientPathsSection with ExamChoiceSection, HowItWorksSection, WaitlistStripSection
const newSections = `
// ============================================
// CHOOSE YOUR EXAM
// ============================================
function ExamChoiceSection() {
  return (
    <section id="choose-your-exam" className="relative bg-white py-24 sm:py-32">
      <div className="px-4 sm:px-8 mb-16">
        <div className="max-w-[1400px] mx-auto">
          <span className="font-mono text-sm uppercase tracking-[0.3em] text-black/50 block mb-4">
            [YOUR GOAL]
          </span>
          <h2 className="text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter text-black leading-[0.9]">
            CHOOSE
            <br />
            YOUR EXAM
          </h2>
        </div>
      </div>

      <div className="px-4 sm:px-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-0 border-4 border-black">
            <Link
              href={EXAM_HREF.erci}
              className="group relative bg-primary text-black p-8 sm:p-10 border-b-4 border-black sm:border-r-4 sm:border-b-4 xl:border-b-0 xl:border-r-4 transition-all duration-200 hover:scale-[1.02] hover:z-10 hover:shadow-[12px_12px_0_0_black]"
            >
              <div className="font-mono text-sm opacity-50 mb-6">01</div>
              <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-2">CIRE</h3>
              <p className="text-lg leading-relaxed mb-8 opacity-90">
                Canadian Investment Regulatory Exam. Prepare for the CIRE exam.
              </p>
              <div className="flex items-center gap-2 font-black uppercase tracking-wider group-hover:gap-4 transition-all">
                START
                <span className="text-2xl">→</span>
              </div>
            </Link>

            <Link
              href={EXAM_HREF.evmcd}
              className="group relative bg-white text-black p-8 sm:p-10 border-b-4 border-black sm:border-b-4 xl:border-b-0 xl:border-r-4 transition-all duration-200 hover:scale-[1.02] hover:z-10 hover:shadow-[12px_12px_0_0_black]"
            >
              <div className="font-mono text-sm opacity-50 mb-6">02</div>
              <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-2">RCSE</h3>
              <p className="text-lg leading-relaxed mb-8 opacity-90">
                Retail Client Securities Examination. Pass the exam quickly.
              </p>
              <div className="flex items-center gap-2 font-black uppercase tracking-wider group-hover:gap-4 transition-all">
                START
                <span className="text-2xl">→</span>
              </div>
            </Link>

            <div className="relative bg-black text-white p-8 sm:p-10 border-b-4 border-black sm:border-r-4 sm:border-b-0 xl:border-r-4 xl:border-b-0">
              <div className="font-mono text-sm opacity-50 mb-6">03</div>
              <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-2">CSC</h3>
              <p className="text-lg leading-relaxed mb-8 opacity-90">
                Canadian Securities Course — two-volume training.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href={EXAM_HREF.ccvmVol1}
                  className="inline-flex items-center justify-center bg-primary text-black font-black uppercase text-sm tracking-wider px-6 py-4 border-4 border-primary hover:bg-white hover:border-white transition-colors"
                >
                  Volume 1 →
                </Link>
                <Link
                  href={EXAM_HREF.ccvmVol2}
                  className="inline-flex items-center justify-center bg-transparent text-white font-black uppercase text-sm tracking-wider px-6 py-4 border-4 border-white hover:bg-white hover:text-black transition-colors"
                >
                  Volume 2 →
                </Link>
              </div>
            </div>

            <Link
              href={EXAM_HREF.negp}
              className="group relative bg-primary text-black p-8 sm:p-10 border-black border-b-0 transition-all duration-200 hover:scale-[1.02] hover:z-10 hover:shadow-[12px_12px_0_0_black]"
            >
              <div className="font-mono text-sm opacity-50 mb-6">04</div>
              <h3 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-2">PMPE</h3>
              <p className="text-lg leading-relaxed mb-8 opacity-90">
                Portfolio Management Principles Exam — targeted preparation.
              </p>
              <div className="flex items-center gap-2 font-black uppercase tracking-wider group-hover:gap-4 transition-all">
                START
                <span className="text-2xl">→</span>
              </div>
            </Link>
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
// HOW IT WORKS
// ============================================
function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      title: "Diagnostic & study plan",
      body: "We start from your current level and target date to build a realistic, week-by-week plan.",
    },
    {
      n: "02",
      title: "Structured learning",
      body: "Ordered modules, clear objectives, and measurable progress — no scattered content or random review.",
    },
    {
      n: "03",
      title: "MCQs & mock exams",
      body: "Multiple-choice question banks and timed mock exams to replicate real conditions.",
    },
    {
      n: "04",
      title: "Coaching & support",
      body: "Questions, clarifications, and coaching to stay motivated and course-correct before the exam.",
    },
  ];

  return (
    <section className="relative bg-black text-white py-24 sm:py-32 border-t-4 border-white">
      <div className="px-4 sm:px-8 mb-16">
        <div className="max-w-[1400px] mx-auto">
          <span className="font-mono text-sm uppercase tracking-[0.3em] text-white/50 block mb-4">
            [METHODOLOGY]
          </span>
          <h2 className="text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] mb-4">
            HOW IT
            <br />
            <span className="text-primary">WORKS</span>
          </h2>
        </div>
      </div>

      <div className="px-4 sm:px-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid md:grid-cols-2 gap-0 border-4 border-white">
            {steps.map((step, i) => (
              <div
                key={step.n}
                className={"p-8 sm:p-10 border-white " + (i < 3 ? "border-b-4 " : "") + (i % 2 === 0 ? "md:border-r-4 " : "") + (i < 2 ? "md:border-b-4" : "")}
              >
                <div className="font-mono text-sm text-primary mb-4">{step.n}</div>
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-4">
                  {step.title}
                </h3>
                <p className="text-lg leading-relaxed opacity-85 max-w-xl">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// INVESTORS & ENTREPRENEURS — SOON
// ============================================
function WaitlistStripSection() {
  return (
    <section className="relative bg-white py-16 sm:py-20 border-t-4 border-black">
      <div className="px-4 sm:px-8">
        <div className="max-w-[1400px] mx-auto">
          <span className="font-mono text-sm uppercase tracking-[0.3em] text-black/50 block mb-8 text-center">
            [COMING SOON]
          </span>
          <div className="grid md:grid-cols-2 gap-0 border-4 border-black">
            <Link
              href="/investor/waitlist"
              className="group relative bg-white text-black p-8 sm:p-10 border-b-4 md:border-b-0 md:border-r-4 border-black transition-all duration-200 hover:scale-[1.01] hover:z-10 hover:shadow-[8px_8px_0_0_hsl(var(--primary))]"
            >
              <div className="font-mono text-sm opacity-50 mb-4">01</div>
              <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2">
                INVESTORS
              </h3>
              <div className="text-xs font-mono uppercase tracking-wider opacity-70 mb-4">
                INDIVIDUALS
              </div>
              <p className="text-base leading-relaxed mb-6 opacity-90">
                Manage your wealth. Understand the markets. Make informed decisions.
              </p>
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-sm group-hover:gap-3 transition-all">
                Waitlist →
              </div>
            </Link>

            <Link
              href="/entrepreneur/waitlist"
              className="group relative bg-black text-white p-8 sm:p-10 transition-all duration-200 hover:scale-[1.01] hover:z-10 hover:shadow-[8px_8px_0_0_hsl(var(--primary))]"
            >
              <div className="font-mono text-sm opacity-50 mb-4">02</div>
              <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2">
                ENTREPRENEURS
              </h3>
              <div className="text-xs font-mono uppercase tracking-wider opacity-70 mb-4">
                & EXECUTIVES
              </div>
              <p className="text-base leading-relaxed mb-6 opacity-90">
                Corporate finance, financial planning, growth.
              </p>
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-sm group-hover:gap-3 transition-all">
                Waitlist →
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
`;

const oldSectionRegex = /\/\/ ============================================\n\/\/ SECTION 3: CLIENT PATHS - THE DECISION\n\/\/ ============================================[\s\S]*?\/\/ ============================================\n\/\/ SECTION 4: ABOUT\n\/\/ ============================================/g;
content = content.replace(oldSectionRegex, newSections + "\n// ============================================\n// SECTION 4: ABOUT\n// ============================================");

// 4. Update the HomePageClient main render
const oldRender = `<ClientPathsSection />`;
const newRender = `<ExamChoiceSection />
        <HowItWorksSection />
        <WaitlistStripSection />`;
content = content.replace(oldRender, newRender);

fs.writeFileSync(filePath, content);
console.log("Updated home-page-client.tsx successfully!");

