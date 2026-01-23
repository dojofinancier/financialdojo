import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Investor Assessment | Financial Dojo",
  description: "A short, structured assessment to clarify how you make investment decisions.",
};

export default function InvestisseurLandingPage() {
  const resonance = [
    "You already invest, but you consume too much conflicting information",
    "You no longer know what is really important in the long term",
    "You trust an advisor, without always understanding your decisions",
    "You spend time optimizing details, without a big-picture view",
    "You want to invest seriously, without falling for the noise and promises",
  ];

  const helps = [
    "Identify how you make your investment decisions",
    "Identify your main point of friction",
    "Understand what deserves your attention now",
    "Know what to ignore, at least for now",
  ];

  const notThis = ["A personality quiz", "Investment advice", "A promise of returns"];

  const forWho = [
    "Have already started investing",
    "Have a university education or an analytical mind",
    "Want to understand before optimizing",
    "Prefer rigor to promises",
    "Invest in Quebec or Canada",
  ];

  const notForWho = ["Quick hacks", "Market predictions", "Guaranteed returns"];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#fbf7f2] text-neutral-900">
      {/* Simple standalone header (default navbar is hidden via RouteChrome) */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[#fbf7f2]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="font-black tracking-tight">
            FINANCIAL DOJO
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="font-semibold">
              <Link href="/courses">Courses</Link>
            </Button>
            <Button asChild className="font-semibold">
              <Link href="/investor/questionnaire">Take the diagnostic</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="px-4 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
              <div>
                <p className="mb-4 inline-flex items-center rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-semibold tracking-wide">
                  Investor clarity diagnostic (≈ 5 minutes)
                </p>
                <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                  You do not need more information to invest better.
                  <br />
                  <span className="underline decoration-primary/60 decoration-4 underline-offset-4">You need a framework.</span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-800">
                  Most smart investors do not fail for lack of knowledge, but because they
                  optimize too early... without a clear structure.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="font-semibold">
                    <Link href="/investor/questionnaire">👉 Take the Investor Diagnostic</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-black/15 bg-white/60 font-semibold">
                    <Link href="#how-it-works">How it works</Link>
                  </Button>
                </div>
                <p className="mt-3 text-sm text-neutral-700">Free · educational only · no promises</p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/70 p-6 shadow-sm sm:p-8">
                <h2 className="text-xl font-bold tracking-tight">What you will get</h2>
                <ul className="mt-4 space-y-3 text-neutral-800">
                  {helps.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-xl border border-black/10 bg-[#fbf7f2] p-4">
                  <p className="font-semibold">This is not:</p>
                  <ul className="mt-2 space-y-1 text-sm text-neutral-800">
                    {notThis.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm font-semibold text-neutral-900">It is a clarity tool.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RESONANCE */}
        <section className="px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-6 sm:p-10">
              <h2 className="text-2xl font-black tracking-tight">If you recognize yourself here, this diagnostic is for you</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {resonance.map((item) => (
                  <div key={item} className="rounded-xl border border-black/10 bg-white p-4">
                    <p className="text-neutral-900">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-xl bg-[#fbf7f2] p-5">
                <p className="font-semibold">👉 The problem is not your intelligence.</p>
                <p className="font-semibold">👉 The problem is the lack of a clear decision framework.</p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="px-4 pb-14 sm:px-6 sm:pb-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-black/10 bg-white/70 p-6 sm:p-8">
                <h3 className="text-lg font-black tracking-tight">How it works</h3>
                <ol className="mt-4 space-y-3 text-neutral-800">
                  <li className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      1
                    </span>
                    <span>You answer 6 simple questions</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      2
                    </span>
                    <span>We analyze how you decide (not your products)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      3
                    </span>
                    <span>You get clear, actionable recommendations</span>
                  </li>
                </ol>
                <p className="mt-5 text-sm text-neutral-700">⏱ Time required: about 5 minutes.</p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/70 p-6 sm:p-8 lg:col-span-2">
                <h3 className="text-lg font-black tracking-tight">Who it is for</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-black/10 bg-white p-5">
                    <p className="font-semibold">Ideal if you:</p>
                    <ul className="mt-3 space-y-2 text-sm text-neutral-800">
                      {forWho.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-black/10 bg-white p-5">
                    <p className="font-semibold">If you are looking for:</p>
                    <ul className="mt-3 space-y-2 text-sm text-neutral-800">
                      {notForWho.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm font-semibold text-neutral-900">👉 This diagnostic is probably not for you.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-black/10 bg-white/70 p-6 sm:p-10">
              <h3 className="text-lg font-black tracking-tight">Credibility (without ego)</h3>
              <p className="mt-3 text-neutral-800">
                This site is designed by a finance instructor specialized in rigorous financial education, decision-making
                under uncertainty, and real risk understanding.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-neutral-800">
                <span className="rounded-full border border-black/10 bg-white px-3 py-1">No affiliation</span>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1">No commissions</span>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1">No conflict of interest</span>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-2xl border border-black/10 bg-neutral-900 p-8 text-white sm:p-12">
              <h2 className="text-3xl font-black tracking-tight">Before optimizing your investments, clarify how you decide.</h2>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="font-semibold">
                  <Link href="/investor/questionnaire">👉 Start the Investor Diagnostic</Link>
                </Button>
                <p className="text-sm text-white/70">(free · educational · no promises)</p>
              </div>
              <div className="mt-8 rounded-xl bg-white/5 p-5 text-sm text-white/80">
                <p className="font-semibold text-white">Important</p>
                <p className="mt-2">
                  The Investor Diagnostic is an educational tool. It does not constitute investment advice, a personalized
                  recommendation, or an opinion on a security, product, or specific strategy.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

