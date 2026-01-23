import {
  INVESTISSEUR_ARCHETYPES,
  INVESTISSEUR_QUESTIONS,
  type InvestisseurResult,
} from "@/lib/constants/investor-diagnostic";

export type GenerateInvestorReportInput = {
  firstName: string;
  email: string;
  responses: Record<string, string>;
  result: InvestisseurResult;
  reportVersion: string;
};

export type GeneratedInvestorReport = {
  renderedMd: string;
  reportTitle: string;
  version: string;
};

type ProfileId =
  | "architecte"
  | "stratege"
  | "delegateur"
  | "navigateur"
  | "optimiseur"
  | "prudent"
  | "explorateur";

const PROFILE_CONTENT: Record<
  ProfileId,
  {
    whatItMeans: string;
    strengths: string[];
    blindSpot: string;
    topMistakes: Array<{ title: string; fix: string }>;
    next7Days: string[];
  }
> = {
  architecte: {
    whatItMeans:
      "You invest with a systems mindset: rules, discipline, long-term horizon. Your advantage is consistency. Your risk is becoming too rigid (or too confident in \"the plan\" without re-examining the assumptions).",
    strengths: [
      "Ability to stay the course when things move",
      "Vision long terme et patience",
      "Structure (written, rules, process)",
    ],
    blindSpot:
      "Rigidity: refusing to adjust a strategy even when the context or your objectives have changed.",
    topMistakes: [
      {
        title: "Optimizing details before optimizing the fundamentals",
        fix: "Return to the 3 pillars: allocation, costs, behavior. Everything else comes after.",
      },
      {
        title: "Sous-estimer le risque de concentration",
        fix: "Check your 5 largest positions and your sector/country exposure. Set a simple limit.",
      },
      {
        title: "Confusing discipline with stubbornness",
        fix: "Plan a quarterly review: objectives, horizon, risks, and allowed adjustments (in advance).",
      },
    ],
    next7Days: [
      "Write your \"Investor Policy Statement\" in 10 lines (objectives, horizon, tolerance for declines, rules).",
      "Set a target allocation (e.g., equities/bonds/cash) + a rebalancing band.",
      "Remove 1 unnecessary complexity (opaque product, duplicate, strategy not understood).",
      "Active une routine de revue (15 min/semaine) et une revue trimestrielle (45 min).",
    ],
  },
  stratege: {
    whatItMeans:
      "You have a good direction and you think well, but your framework is not yet explicit enough. Your main lever: transform a “good intuition” into simple rules, to avoid decisions based on feeling.",
    strengths: ["Bon jugement global", "Re-evaluate without panicking", "Ability to learn quickly"],
    blindSpot:
      "Lack of formalization: you know where you want to go, but you don't yet have a system that protects you from yourself when emotions rise.",
    topMistakes: [
      {
        title: "Changing strategy without realizing it",
        fix: "Define 3 immutable rules (e.g.: target allocation, rebalancing frequency, “experiment” budget).",
      },
      {
        title: "Too much information, not enough decisions",
        fix: "Reduce your sources to 2-3 maximum and turn them into checklists (not impulses).",
      },
      {
        title: "Underestimating the role of behavior",
        fix: "Write your plan “when it drops 20%” (what to do / what not to do).",
      },
    ],
    next7Days: [
      "Write your strategy on 1 page (objective, horizon, allocation, contribution rules).",
      "Create a decision checklist (before buying: why, horizon, risk, alternative).",
      "Set an “opportunities” budget (small %) to avoid contaminating the core of the portfolio.",
      "Choose 1 simple tracking metric (e.g.: % equities, total cost, savings rate).",
    ],
  },
  delegateur: {
    whatItMeans:
      "You delegate a lot — sometimes out of trust, sometimes to avoid complexity. The real risk here is not “the advisor”: it's information asymmetry. Your lever: understand enough to steer.",
    strengths: ["Simplicity", "Less impulsivity", "Can save time if well structured"],
    blindSpot:
      "You may be invested in a portfolio you don't really understand (products, fees, risks).",
    topMistakes: [
      {
        title: "Not knowing your total fees",
        fix: "Demande noir sur blanc : frais de gestion + frais des produits + frais de transaction, en $/an et en %.",
      },
      {
        title: "Confusing “delegate” and “abandon”",
        fix: "Define your framework (objective, horizon, limits) and demand simple, regular explanations.",
      },
      {
        title: "Not checking alignment of interests",
        fix: "Clarify how your advisor is compensated and compare 1 alternative (ETF/model portfolio).",
      },
    ],
    next7Days: [
      "Obtiens un “snapshot” de ton portefeuille (allocation, produits, frais, rendement).",
      "Ask 5 essential questions (fees, risks, -20% scenario, rebalancing plan, justification).",
      "Write your goals in 5 lines and share them with your advisor.",
      "Decide on a review cadence (quarterly) and a standard report format.",
    ],
  },
  navigateur: {
    whatItMeans:
      "You progress with the flow of information. The danger: the news drives your portfolio. Your lever: a simple compass (goals + rules) to filter the info.",
    strengths: ["Curiosity", "Responsiveness", "Ability to spot ideas"],
    blindSpot:
      "Strategy volatility: you can be right about ideas, but lose on execution (timing, inconsistency, rotation).",
    topMistakes: [
      { title: "Surconsommer l’info", fix: "Switch from a daily stream to a weekly review + an action checklist." },
      { title: "Buying narratives", fix: "Demand a simple thesis: why it works, when it fails, time horizon." },
      { title: "Lacking a portfolio core", fix: "Build a stable core (80-90%), and keep exploration separate." },
    ],
    next7Days: [
      "Create your core (e.g., 2-4 diversified ETFs) + an automatic contribution rule.",
      "Reduce your sources to 2 (1 long format + 1 summary), the rest = 'bonus'.",
      "Separate 'core' and 'satellites' (small ideas budget).",
      "Write 3 anti-impulsivity rules (48h delay, max position size, validation checklist).",
    ],
  },
  optimiseur: {
    whatItMeans:
      "You are very involved and you try to do better… but you sometimes optimize in the wrong place (too early). Your lever: simplify and measure what matters.",
    strengths: ["Energy", "Apprentissage", "Willingness to improve results"],
    blindSpot:
      "You can confuse activity with progress. More actions ≠ better results (and it increases errors).",
    topMistakes: [
      { title: "Trop de transactions", fix: "Reduce the frequency. Put effort into allocation and contributions." },
      { title: "Optimiser pour le court terme", fix: "Choisis 1 horizon principal, et aligne le portefeuille sur cet horizon." },
      { title: "Overcomplicating (products/strategies)", fix: "Si tu ne peux pas l’expliquer en 30 secondes, ce n’est pas un “core holding”." },
    ],
    next7Days: [
      "Measure your costs (fees + turnover). Choose 1 high-impact improvement.",
      "Define your simple core + your experimentation budget (small %).",
      "Create a “less but better” rule: 1 decision/week max, if checklist validated.",
      "Schedule a monthly review: allocation, contributions, errors, lessons.",
    ],
  },
  prudent: {
    whatItMeans:
      "Safety and capital protection are central. Your risk: letting emotion dictate decisions, especially during downturns. Your leverage: a clear risk plan (in advance).",
    strengths: ["Prudence", "Sens du risque", "Seeking stability"],
    blindSpot:
      "Risk of selling at the wrong time (or staying too sidelined) and missing the growth needed for your goals.",
    topMistakes: [
      { title: "Vendre en panique", fix: "Write a rule: no selling under stress without 72h + checklist." },
      { title: "Too much cash by default", fix: "Decide on a target cash buffer (e.g.: 3-6 months) and invest the surplus systematically." },
      { title: "Confusing volatility and risk", fix: "Link your horizon and your liquidity needs to the acceptable level of risk." },
    ],
    next7Days: [
      "Write your “market -20%” plan (what to do / what not to do).",
      "Define a cash buffer and automate your contributions (small amount).",
      "Choisis 1 portefeuille simple qui respecte ton risque (ex: mix actions/obligations).",
      "Reduce anxiety-inducing sources (news) and replace them with 1 structured weekly review.",
    ],
  },
  explorateur: {
    whatItMeans:
      "You are curious and opportunistic. Your risk: inconsistency over time. Your leverage: frame exploration so that it serves your goals (instead of replacing them).",
    strengths: ["Ouverture", "Flexibility", "Ability to seize opportunities"],
    blindSpot:
      "You can jump from one idea to another without capitalizing (no repetition, no system, no measurement).",
    topMistakes: [
      { title: "Changer trop souvent", fix: "Impose un horizon minimum par position (sauf invalidation claire)." },
      { title: "Absence de noyau", fix: "Build a stable core, then explore with a limited budget." },
      { title: "Decisions guided by narrative", fix: "Use a written thesis: why / when / how much / exit." },
    ],
    next7Days: [
      "Define your “playing field” (explorer budget) and protect the rest.",
      "Create an investment journal (decision, thesis, horizon, exit criteria).",
      "Establish a simple allocation for the core and automate contributions.",
      "Choose 1 structured learning theme (not 5 in parallel).",
    ],
  },
};

function mdEscape(text: string): string {
  // Minimal escaping to avoid breaking markdown headings/links
  return text.replace(/\r?\n/g, " ").trim();
}

function getArchetypeName(id: string): string {
  return INVESTISSEUR_ARCHETYPES.find((a) => a.id === id)?.name ?? id;
}

function getAnswerText(questionId: string, answerId: string | undefined): string | null {
  if (!answerId) return null;
  const q = INVESTISSEUR_QUESTIONS.find((qq) => qq.id === questionId);
  const a = q?.answers.find((aa) => aa.id === answerId);
  return a?.text ?? null;
}

function confidenceLabel(confidence: InvestisseurResult["confidence"]): string {
  switch (confidence) {
    case "high":
      return "High";
    case "medium":
      return "Moyenne";
    default:
      return "Faible";
  }
}

export function generateInvestorReport(input: GenerateInvestorReportInput): GeneratedInvestorReport {
  const primaryId = input.result.primary.id as ProfileId;
  const secondaryId = (input.result.secondary?.id ?? null) as ProfileId | null;

  const primaryContent = PROFILE_CONTENT[primaryId] ?? null;
  const secondaryContent = secondaryId ? PROFILE_CONTENT[secondaryId] ?? null : null;

  const reportTitle = `Rapport Investisseur — ${mdEscape(input.firstName)}`;

  const answersSummary = [
    ["Objectif", getAnswerText("q1_goal", input.responses["q1_goal"])],
    ["Horizon", getAnswerText("q2_horizon", input.responses["q2_horizon"])],
    ["Reaction to downturns", getAnswerText("q3_drawdown_reaction", input.responses["q3_drawdown_reaction"])],
    ["Structure", getAnswerText("q4_structure", input.responses["q4_structure"])],
    ["Source d’info", getAnswerText("q5_info_source", input.responses["q5_info_source"])],
    ["Time/energy", getAnswerText("q6_time_energy", input.responses["q6_time_energy"])],
  ]
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `- **${k}**: ${v}`);

  const lines: string[] = [];
  lines.push(`# ${reportTitle}`);
  lines.push("");
  lines.push(`Bonjour **${mdEscape(input.firstName)}**,`);
  lines.push("");
  lines.push(
    "This report is designed to give you a clear reading of your investing approach, your strengths, your typical pitfalls, and a simple plan to progress quickly."
  );
  lines.push("");
  lines.push("> Education only. This is not personalized investment advice.");
  lines.push("");

  lines.push("## 1) Your result");
  lines.push("");
  lines.push(`- **Profil principal**: ${getArchetypeName(primaryId)} (${input.result.primary.score} pts)`);
  if (secondaryId) {
    lines.push(`- **Secondary profile**: ${getArchetypeName(secondaryId)} (${input.result.secondary?.score ?? 0} pts)`);
  } else {
    lines.push(`- **Secondary profile**: None (according to the assessment eligibility rules)`);
  }
  lines.push(`- **Confidence**: ${confidenceLabel(input.result.confidence)}`);
  lines.push("");

  if (answersSummary.length) {
    lines.push("### Your answers (summary)");
    lines.push("");
    lines.push(...answersSummary);
    lines.push("");
  }

  lines.push("## 2) Quick read (what it means)");
  lines.push("");
  if (primaryContent) {
    lines.push(primaryContent.whatItMeans);
  } else {
    lines.push("Your profile indicates a specific way of investing. The full report will be enhanced over future versions.");
  }
  lines.push("");

  if (secondaryId && secondaryContent) {
    lines.push("### How your two profiles combine");
    lines.push("");
    lines.push(
      `Your secondary profile (${getArchetypeName(secondaryId)}) colors your main style: it can be a strength if it is structured, or a source of friction if you lack simple rules.`
    );
    lines.push("");
  }

  lines.push("## 3) Your strengths (to keep)");
  lines.push("");
  if (primaryContent) {
    for (const s of primaryContent.strengths) lines.push(`- ${s}`);
  } else {
    lines.push("- Ability to learn and adapt.");
  }
  lines.push("");

  lines.push("## 4) Your blind spot (to watch)");
  lines.push("");
  lines.push(primaryContent?.blindSpot ?? "A behavioral risk can harm your results if you don't have a framework.");
  lines.push("");

  lines.push("## 5) Your three most likely mistakes (and how to fix them)");
  lines.push("");
  if (primaryContent) {
    primaryContent.topMistakes.forEach((m, idx) => {
      lines.push(`### ${idx + 1}. ${m.title}`);
      lines.push("");
      lines.push(`**Correctif**: ${m.fix}`);
      lines.push("");
    });
  } else {
    lines.push("- Clarifier objectif/horizon.\n- Simplifier.\n- Automatiser.");
    lines.push("");
  }

  lines.push("## 6) Simple 7-day plan");
  lines.push("");
  if (primaryContent) {
    for (const step of primaryContent.next7Days) lines.push(`- [ ] ${step}`);
  } else {
    lines.push("- [ ] Write your goal and time horizon.\n- [ ] Choose a simple allocation.\n- [ ] Automate your contributions.");
  }
  lines.push("");

  lines.push("## 7) A golden rule (to print)");
  lines.push("");
  lines.push(
    "Your return depends less on \"the best idea\" than on your ability to repeat a simple strategy, over a long horizon, without sabotaging yourself when the market moves."
  );
  lines.push("");

  lines.push("---");
  lines.push(`Report version: ${input.reportVersion}`);
  lines.push("");

  return {
    renderedMd: lines.join("\n"),
    reportTitle,
    version: input.reportVersion,
  };
}


