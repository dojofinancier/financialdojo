import diagnostic from "@/docs/questionnaire_investor.json";

export type InvestisseurAnswer = {
  id: string;
  text: string;
};

export type InvestisseurQuestion = {
  id: string;
  label: string;
  prompt: string;
  type: "single_choice";
  answers: InvestisseurAnswer[];
};

export type InvestisseurArchetype = {
  id: string;
  name: string;
  one_liner: string;
};

export type InvestisseurScores = Record<string, number>;

export type InvestisseurResult = {
  scores: InvestisseurScores;
  ranked: Array<{ id: string; name: string; score: number }>;
  primary: { id: string; name: string; score: number; one_liner: string };
  secondary: { id: string; name: string; score: number; one_liner: string } | null;
  confidence: "low" | "medium" | "high";
};

export const INVESTISSEUR_DIAGNOSTIC_META = {
  diagnosticId: (diagnostic as any).diagnostic_id as string,
  version: (diagnostic as any).version as string,
  language: (diagnostic as any).language as string,
} as const;

const PROMPTS_BY_ID: Record<string, string> = {
  q1_goal: "Quel est ton objectif principal en tant qu’investisseur aujourd’hui ?",
  q2_horizon: "Sur quel horizon prends-tu la majorité de tes décisions d’investissement ?",
  q3_drawdown_reaction:
    "Quand tes placements baissent fortement pendant quelques mois, ta réaction la plus probable est :",
  q4_structure: "Laquelle de ces phrases décrit le mieux ta situation actuelle ?",
  q5_info_source: "D’où provient la majorité de l’information qui influence tes décisions ?",
  q6_time_energy:
    "Par rapport au temps et à l’énergie que tu consacres à l’investissement, tu dirais que :",
};

export const INVESTISSEUR_QUESTIONS: InvestisseurQuestion[] = (
  (diagnostic.questions as Array<{ id: string; label: string; type: "single_choice"; answers: InvestisseurAnswer[] }>) ||
  []
).map((q) => ({
  ...q,
  prompt: PROMPTS_BY_ID[q.id] ?? q.label,
}));

export const INVESTISSEUR_ARCHETYPES: InvestisseurArchetype[] =
  ((diagnostic.archetypes as Array<{ id: string; name: string; one_liner: string }>) || []).map((a) => ({
    id: a.id,
    name: a.name,
    one_liner: a.one_liner,
  }));

export const INVESTISSEUR_WEIGHTS_BY_ANSWER: Record<string, Record<string, number>> =
  (diagnostic.weights as any)?.by_answer ?? {};

export const INVESTISSEUR_SECONDARY_ELIGIBILITY: {
  minScore: number;
  maxGapFromPrimary: number;
  minGapFromPrimary: number;
} = {
  minScore: (diagnostic.classification as any)?.secondary_eligibility?.min_score ?? 4,
  maxGapFromPrimary: (diagnostic.classification as any)?.secondary_eligibility?.max_gap_from_primary ?? 4,
  minGapFromPrimary: (diagnostic.classification as any)?.secondary_eligibility?.min_gap_from_primary ?? -2,
};

function createEmptyScores(): InvestisseurScores {
  const scores: InvestisseurScores = {};
  for (const a of INVESTISSEUR_ARCHETYPES) scores[a.id] = 0;
  return scores;
}

function addScore(scores: InvestisseurScores, archetypeId: string, delta: number) {
  scores[archetypeId] = (scores[archetypeId] ?? 0) + delta;
}

function scoreFromAnswer(answerId: string | undefined | null, archetypeId: string): number {
  if (!answerId) return 0;
  const weights = INVESTISSEUR_WEIGHTS_BY_ANSWER[answerId];
  if (!weights) return 0;
  return weights[archetypeId] ?? 0;
}

function pickPrimaryWithTieBreakers(ranked: Array<{ id: string; score: number; idx: number }>, responses: Record<string, string>) {
  if (ranked.length === 0) return null;
  const topScore = ranked[0].score;
  const tied = ranked.filter((r) => r.score === topScore);
  if (tied.length === 1) return tied[0];

  const tieBreakerQuestionOrder: Array<keyof typeof responses> = ["q4_structure", "q3_drawdown_reaction", "q2_horizon"];
  let candidates = tied;

  for (const qId of tieBreakerQuestionOrder) {
    const answerId = responses[qId as string];
    if (!answerId) continue;

    let best = -Infinity;
    const scored = candidates.map((c) => {
      const s = scoreFromAnswer(answerId, c.id);
      best = Math.max(best, s);
      return { ...c, tieScore: s };
    });
    const next = scored.filter((c) => c.tieScore === best);
    candidates = next;
    if (candidates.length === 1) return candidates[0];
  }

  // Final deterministic fallback: keep original archetype order
  candidates.sort((a, b) => a.idx - b.idx);
  return candidates[0] ?? null;
}

function confidenceFromGap(primaryScore: number, runnerUpScore: number | null): InvestisseurResult["confidence"] {
  if (runnerUpScore === null) return "high";
  const gap = primaryScore - runnerUpScore;
  if (gap >= 5) return "high";
  if (gap >= 2) return "medium";
  return "low";
}

export function computeInvestisseurResult(responses: Record<string, string>): InvestisseurResult | null {
  if (!INVESTISSEUR_ARCHETYPES.length) return null;

  const scores = createEmptyScores();
  for (const answerId of Object.values(responses)) {
    const weights = INVESTISSEUR_WEIGHTS_BY_ANSWER[answerId];
    if (!weights) continue;
    for (const [archetypeId, delta] of Object.entries(weights)) {
      addScore(scores, archetypeId, Number(delta) || 0);
    }
  }

  const indexed = INVESTISSEUR_ARCHETYPES.map((a, idx) => ({
    id: a.id,
    name: a.name,
    one_liner: a.one_liner,
    score: scores[a.id] ?? 0,
    idx,
  }));

  // Base ranking is deterministic (score desc, then original order)
  const baseRanked = [...indexed].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });

  const primaryPick = pickPrimaryWithTieBreakers(
    baseRanked.map((r) => ({ id: r.id, score: r.score, idx: r.idx })),
    responses
  );
  const primaryFull = primaryPick ? indexed.find((a) => a.id === primaryPick.id) : baseRanked[0];
  if (!primaryFull) return null;

  // Secondary candidate = best remaining by score (deterministic by idx)
  const remaining = baseRanked.filter((r) => r.id !== primaryFull.id);
  const secondaryCandidate = remaining[0] ?? null;

  let secondary: InvestisseurResult["secondary"] = null;
  if (secondaryCandidate) {
    const gap = primaryFull.score - secondaryCandidate.score;
    const eligible =
      secondaryCandidate.score >= INVESTISSEUR_SECONDARY_ELIGIBILITY.minScore &&
      gap <= INVESTISSEUR_SECONDARY_ELIGIBILITY.maxGapFromPrimary &&
      gap >= INVESTISSEUR_SECONDARY_ELIGIBILITY.minGapFromPrimary;

    if (eligible) {
      secondary = {
        id: secondaryCandidate.id,
        name: secondaryCandidate.name,
        score: secondaryCandidate.score,
        one_liner: secondaryCandidate.one_liner,
      };
    }
  }

  const confidence = confidenceFromGap(primaryFull.score, secondaryCandidate ? secondaryCandidate.score : null);

  return {
    scores,
    ranked: baseRanked.map((r) => ({ id: r.id, name: r.name, score: r.score })),
    primary: {
      id: primaryFull.id,
      name: primaryFull.name,
      score: primaryFull.score,
      one_liner: primaryFull.one_liner,
    },
    secondary,
    confidence,
  };
}

