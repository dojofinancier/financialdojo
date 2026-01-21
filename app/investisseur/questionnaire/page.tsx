import type { Metadata } from "next";
import { QuestionnaireClient } from "./questionnaire-client";

export const metadata: Metadata = {
  title: "Investor Diagnostic — Questionnaire | Financial Dojo",
  description: "Answer 6 questions to clarify your investment decision style.",
};

export default function InvestisseurQuestionnairePage() {
  return <QuestionnaireClient />;
}

