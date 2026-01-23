import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default function InvestorReportPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f6ede4] text-neutral-900">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-10">
              <p className="text-sm font-semibold text-neutral-700">Chargement du rapport…</p>
            </div>
          </div>
        </main>
      }
    >
      <InvestorReportPageContent {...props} />
    </Suspense>
  );
}

async function InvestorReportPageContent(props: PageProps) {
  const { token } = await props.params;
  if (!token) return notFound();

  const report = await prisma.investorReportInstance.findUnique({
    where: { token },
    include: {
      assessment: {
        include: {
          lead: true,
        },
      },
    },
  });

  if (!report) return notFound();
  if (report.expiresAt && report.expiresAt.getTime() < Date.now()) return notFound();

  const firstName = report.assessment.lead.firstName || "investor";

  return (
    <main className="min-h-screen bg-[#f6ede4] text-neutral-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Financial Dojo — Personalized report
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Hello {firstName}
          </h1>

          <div className="prose prose-neutral mt-8 max-w-none prose-headings:font-black prose-h2:mt-10 prose-h3:mt-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.renderedMd}</ReactMarkdown>
          </div>

          <div className="mt-10 border-t border-black/10 pt-6 text-xs text-neutral-600">
            <p>Education only. No personalized investment advice.</p>
          </div>
        </div>
      </div>
    </main>
  );
}


