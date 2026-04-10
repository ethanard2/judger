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

export function buildHeuristicJudgeProfile(args: {
  judgeName: string;
  courtName?: string;
  opinions: Array<{ opinionText: string }>;
  bio?: { appointedBy?: string; birthYear?: number; activeStatus?: string } | null;
}) {
  const counts = new Map<
    string,
    { total: number; granted: number; denied: number; mixed: number }
  >();

  for (const op of args.opinions) {
    const motionType = detectMotionType(op.opinionText);
    const outcome = detectOutcome(op.opinionText);
    const c = counts.get(motionType) ?? { total: 0, granted: 0, denied: 0, mixed: 0 };
    c.total += 1;
    if (outcome === "Granted") c.granted += 1;
    if (outcome === "Denied") c.denied += 1;
    if (outcome === "Granted in part" || outcome === "Mixed") c.mixed += 1;
    counts.set(motionType, c);
  }

  const grantRates = [...counts.entries()].map(([motionType, s]) => ({
    motionType,
    sampleSize: s.total,
    granted: s.granted,
    denied: s.denied,
    mixed: s.mixed,
    grantRate: Math.round(((s.granted + s.mixed * 0.5) / s.total) * 100),
  }));

  return {
    judgeName: args.judgeName,
    courtName: args.courtName,
    bio: args.bio ?? null,
    overview: `${args.judgeName} tends to reward disciplined briefing, clear sequencing, and a concrete evidentiary record. Profile built from ${args.opinions.length} opinions.`,
    grantRates,
    keyTendencies: [
      "Prefers targeted, proportional requests over sprawling asks.",
      "Responds well to briefs that front-load procedural posture and requested relief.",
      "Uses orders to narrow disputes before reaching broader merits questions.",
    ],
    proceduralPreferences: [
      "Narrow discovery disputes before conference practice.",
      "Use a tight chronology and cite the record precisely.",
      "Separate threshold defects from fact-intensive arguments.",
    ],
    redFlags: [
      "Overbroad requests without burden analysis.",
      "Arguments that skip the governing standard.",
      "Heavy rhetoric unsupported by citations.",
    ],
    citedPrecedents: [
      "Celotex Corp. v. Catrett",
      "Ashcroft v. Iqbal",
      "Bell Atl. Corp. v. Twombly",
      "Fed. R. Civ. P. 26(b)(1)",
    ],
  };
}

export function buildFallbackCaseAnalysis(args: {
  caseName?: string;
  caseNumber: string;
  courtName: string;
  judgeProfileJson?: string;
  docketEntries: Array<{ description: string }>;
}) {
  const profile = safeJsonParse<any>(args.judgeProfileJson, null);
  const latest = args.docketEntries.at(-1)?.description ?? "recent activity";

  return `Case posture assessment
${args.caseName ?? args.caseNumber} in ${args.courtName} is in the early-to-middle motion phase. Latest docket activity: ${latest}.

Judge-specific risks
${profile?.judgeName ?? "The assigned judge"} appears to punish overbreadth, thin citations, and diffuse narratives.

Strategic recommendations
Lead with procedural posture, frame a limited ask, and attach the record cites that do the work.

Timeline prediction
Expect the next inflection point to be a conference or targeted order before broader merits briefing.

Key issues to watch
- Whether the court narrows discovery before merits briefing
- Whether evidentiary support is mature enough for early dispositive motion`;
}

export function buildFallbackChatResponse(args: {
  question: string;
  caseName?: string;
  judgeProfileJson?: string;
}) {
  const profile = safeJsonParse<any>(args.judgeProfileJson, null);
  const q = args.question.toLowerCase();

  if (q.includes("motion to compel")) {
    return `Based on the stored profile, ${profile?.judgeName ?? "this judge"} is likely to ask whether the request is proportionate, sequenced correctly, and supported by specific relevance showings. Prepare a short matrix tying each category to a concrete claim.`;
  }
  if (q.includes("summary judgment")) {
    return `The profile points toward a judge who expects a disciplined Rule 56 presentation: clean statement of undisputed facts, tight record citations, and a narrow theory of relief.`;
  }
  if (q.includes("draft")) {
    return `Draft structure for ${profile?.judgeName ?? "the assigned judge"}:\n1. One-paragraph procedural posture and precise relief requested.\n2. Governing standard with minimal exposition.\n3. Three tightly bounded argument sections anchored to record citations.\n4. Short prejudice/burden section.\n5. Practical conclusion telling the court exactly what order to enter.`;
  }
  return `The case file for ${args.caseName ?? "this matter"} is live. The working analysis is that ${profile?.judgeName ?? "the assigned judge"} values procedural clarity, narrow asks, and precise citations.`;
}
