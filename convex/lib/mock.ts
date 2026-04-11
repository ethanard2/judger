// Mock/fallback pipeline — enables the app to run without external API keys.
// Adapted from judger-codex implementation.

import { safeJsonParse, hashString } from "./utils";

type MockCaseArgs = {
  caseNumber: string;
  courtId: string;
  courtName: string;
};

const JUDGE_NAMES = [
  "Jesse M. Furman",
  "Analisa Torres",
  "Katherine Polk Failla",
  "Lewis J. Liman",
  "Jennifer H. Rearden",
  "John G. Koeltl",
];

const MATTERS = [
  "Breach of contract over software migration services",
  "Trade secret dispute tied to a failed enterprise rollout",
  "Employment retaliation claim after internal reporting",
  "Consumer class action over recurring billing practices",
  "Licensing dispute involving delayed milestone payments",
];

export function buildMockCaseBundle(args: MockCaseArgs) {
  const seed = hashString(`${args.caseNumber}:${args.courtId}`);
  const judgeName = JUDGE_NAMES[seed % JUDGE_NAMES.length];
  const matter = MATTERS[seed % MATTERS.length];
  const plaintiff = `North River ${seed % 7 === 0 ? "Holdings" : "Capital"}`;
  const defendant = `Beacon ${seed % 2 === 0 ? "Systems" : "Advisors"}`;

  return {
    caseName: `${plaintiff} v. ${defendant}`,
    dateFiled: "2026-02-14",
    caseType: "civil",
    natureOfSuit: matter,
    courtListenerDocketId: 900000 + (seed % 1000),
    judgeName,
    judgeBio: {
      courtListenerPersonId: 70000 + (seed % 1000),
      birthYear: 1968 + (seed % 9),
      activeStatus: "active",
      appointedBy: seed % 2 === 0 ? "Barack Obama" : "Joe Biden",
    },
    parties: [
      {
        name: plaintiff,
        role: "plaintiff",
        attorneys: [{ name: "Jordan Hale", firm: "Barton Trial Group" }],
      },
      {
        name: defendant,
        role: "defendant",
        attorneys: [{ name: "Riley Chen", firm: "Meyer & Cole LLP" }],
      },
    ],
    docketEntries: [
      {
        entryNumber: 1,
        dateFiled: "2026-02-14",
        description: `Complaint filed alleging ${matter.toLowerCase()}.`,
        rawText:
          "Plaintiff alleges that defendant missed delivery milestones, concealed implementation defects, and withheld key transition materials.",
        documentType: "complaint",
      },
      {
        entryNumber: 9,
        dateFiled: "2026-03-03",
        description: "Answer and affirmative defenses.",
        rawText:
          "Defendant denies material breach, invokes limitation-of-liability provisions, and argues the dispute is governed by a change-order process.",
        documentType: "answer",
      },
      {
        entryNumber: 18,
        dateFiled: "2026-03-28",
        description: "Motion to compel production of implementation logs.",
        rawText:
          "Defendant seeks source audit trails, vendor communications, and board updates reflecting plaintiff's internal knowledge of the rollout failure.",
        documentType: "motion_to_compel",
      },
      {
        entryNumber: 24,
        dateFiled: "2026-04-05",
        description: "Order setting expedited discovery conference.",
        rawText:
          "The Court directs the parties to arrive with a narrowed list of disputed custodians and a concrete sequencing proposal.",
        documentType: "order",
      },
    ],
    opinions: Array.from({ length: 8 }).map((_, i) => ({
      courtListenerClusterId: 880000 + seed + i,
      caseName: `${judgeName.split(" ")[0]} sample matter ${i + 1}`,
      dateFiled: `2025-${String((i % 9) + 1).padStart(2, "0")}-1${i % 9}`,
      caseType: "civil",
      opinionText:
        i % 3 === 0
          ? `${judgeName} denied a motion to compel after finding the requested discovery overbroad and disproportionate to the needs of the case.`
          : i % 3 === 1
            ? `${judgeName} granted in part a motion to dismiss, narrowing the complaint but preserving the contract theory where contemporaneous emails plausibly supported reliance.`
            : `${judgeName} granted summary judgment on damages issues after focusing on record citations, evidentiary gaps, and the moving party's disciplined statement of undisputed facts.`,
    })),
  };
}

function detectMotionType(text: string): string {
  const s = text.toLowerCase();
  if (s.includes("summary judgment")) return "Summary Judgment";
  if (s.includes("dismiss")) return "Motion to Dismiss";
  if (s.includes("compel")) return "Motion to Compel";
  if (s.includes("injunction")) return "Injunctive Relief";
  return "General Motion Practice";
}

function detectOutcome(text: string): string {
  const s = text.toLowerCase();
  if (s.includes("granted in part")) return "Granted in part";
  if (s.includes("denied")) return "Denied";
  if (s.includes("granted")) return "Granted";
  return "Mixed";
}

export function buildNoDataProfile(judgeName: string, courtName?: string) {
  return {
    judgeName,
    courtName,
    overview: `We were unable to find sufficient opinion data for ${judgeName} in public court records. This may mean the judge's opinions are not yet available in the CourtListener database, or the judge is relatively new to the bench. The chat companion can still answer general questions, but judge-specific behavioral analysis is not available.`,
  };
}

export function buildFallbackCaseAnalysis(args: {
  caseName?: string;
  caseNumber: string;
  courtName: string;
}) {
  return `Analysis for ${args.caseName ?? args.caseNumber} in ${args.courtName} could not be generated. This is typically because:

- The AI analysis service is temporarily unavailable
- Insufficient judge opinion data was found in public records

Please try again later, or use the chat to ask specific questions about your case.`;
}

export function buildFallbackChatResponse() {
  return "I'm sorry, I wasn't able to generate a response. The AI service may be temporarily unavailable. Please try again in a moment.";
}
