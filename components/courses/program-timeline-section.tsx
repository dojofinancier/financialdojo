import type { ProgramTimelineStep } from "@/lib/types/program-timeline";

interface ProgramTimelineSectionProps {
  steps: ProgramTimelineStep[];
}

function StepCard({
  step,
  className = "",
}: {
  step: ProgramTimelineStep;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 border-4 border-black bg-white p-4 sm:p-5 shadow-[6px_6px_0_0_rgba(0,0,0,1)] xl:p-3 2xl:p-5 ${className}`}
    >
      {step.label && (
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-black/50 block mb-2">
          {step.label}
        </span>
      )}
      <h3 className="break-words text-balance text-base font-black uppercase leading-snug tracking-tight hyphens-auto sm:text-lg xl:text-sm xl:leading-tight 2xl:text-base 2xl:leading-snug">
        {step.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-black/75 xl:text-xs xl:leading-relaxed 2xl:text-sm">
        {step.description}
      </p>
    </div>
  );
}

function NodeBadge({ n }: { n: number }) {
  return (
    <div
      className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center border-4 border-black bg-primary text-sm font-black text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
      aria-hidden
    >
      {n}
    </div>
  );
}

export function ProgramTimelineSection({ steps }: ProgramTimelineSectionProps) {
  return (
    <section
      className="border-t border-black/10 bg-white py-16 text-black md:py-24"
      lang="en"
    >
      <div className="px-4 sm:px-8">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-10 md:mb-14">
            <span className="block font-mono text-xs uppercase tracking-[0.3em] text-black/60">
              [YOUR PROGRAM]
            </span>
            <h2 className="mt-3 text-4xl font-black uppercase tracking-tighter md:text-5xl">
              How does it work?
            </h2>
          </div>

          <div className="relative xl:hidden">
            <div
              className="absolute left-[22px] top-7 bottom-7 w-4 border-x-4 border-black bg-primary"
              aria-hidden
            />
            <ol className="relative m-0 list-none space-y-10 p-0">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-5">
                  <div className="relative flex w-12 shrink-0 justify-center pt-1">
                    <NodeBadge n={i + 1} />
                  </div>
                  <StepCard step={step} className="min-w-0 flex-1" />
                </li>
              ))}
            </ol>
          </div>

          <div className="relative hidden xl:block">
            <div className="relative px-2 lg:px-4">
              <div className="relative mb-8 lg:mb-10">
                <div
                  className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-4 -translate-y-1/2 border-y-4 border-black bg-primary"
                  aria-hidden
                />
                <div className="relative z-10 grid grid-cols-5 gap-3 lg:gap-4">
                  {steps.map((_, i) => (
                    <div
                      key={`badge-${i}`}
                      className="flex h-12 items-center justify-center"
                    >
                      <NodeBadge n={i + 1} />
                    </div>
                  ))}
                </div>
              </div>

              <ol className="m-0 grid list-none grid-cols-5 gap-3 p-0 lg:gap-4">
                {steps.map((step, i) => (
                  <li key={i} className="min-w-0">
                    <StepCard step={step} className="h-full w-full" />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
