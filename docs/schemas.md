# BenchMemo Data Schemas

## Data Flow

```
CourtListener opinions (raw text)
        │
        ▼
  LLM structured extraction (per opinion)
        │
        ▼
  OpinionExtraction[]              ← Schema A (LLM classifies)
        │
        ├──► Our code aggregates   ← motionStats, precedent counts, timelines
        │
        ▼
  LLM qualitative synthesis
        │
        ▼
  JudgeAnalysis                    ← Schema B (LLM synthesizes prose)
        │
        ▼
  JudgeProfile = bio (CourtListener) + stats (computed) + analysis (Schema B)
```

**Who does what:**
- LLM: reads opinions, classifies facts (Schema A), synthesizes behavioral insights (Schema B)
- Our code: counts, averages, sorts, computes grant rates from Schema A data
- CourtListener: provides bio data (education, appointment, ABA rating)

---

## Schema A: OpinionExtraction

One per motion addressed in an opinion. If an opinion rules on three motions, we get three extractions. This is classification, not synthesis.

```typescript
type OpinionExtraction = {
  // Identity
  caseName: string;
  docketNumber: string;
  dateFiled: string;                // YYYY-MM-DD

  // Classification (LLM decides)
  motionType: MotionType;
  outcome: Outcome;
  subjectMatter: SubjectMatter;
  movingParty: "plaintiff" | "defendant" | "third_party" | "unclear";

  // What the judge did
  keyIssues: string[];              // 2-4 legal issues addressed
  reasoningSummary: string;         // 2-3 sentences: how the judge analyzed this
  precedentsCited: PrecedentRef[];  // citations found in the opinion

  // Behavioral signals
  suaSponte: boolean;
  opinionLengthPages: number;
  proceduralNotes: string | null;   // procedural requirements enforced, or null

  // Tone
  tone: "formal" | "informal" | "mixed";
  detailLevel: "terse" | "moderate" | "detailed";
};

type PrecedentRef = {
  caseName: string;                 // "Ashcroft v. Iqbal"
  citation: string;                 // "556 U.S. 662 (2009)"
};

type MotionType =
  | "MTD_12b6"
  | "MTD_12b1"
  | "MTD_other"
  | "MSJ"
  | "MSJ_partial"
  | "MTC"                           // motion to compel
  | "MTA"                           // motion to amend
  | "TRO"
  | "PI"                            // preliminary injunction
  | "MIL"                           // motion in limine
  | "MTS"                           // motion to seal
  | "MTR"                           // motion to reconsider
  | "sanctions"
  | "class_cert"
  | "default_judgment"
  | "other";

type Outcome =
  | "granted"
  | "denied"
  | "granted_in_part"
  | "moot"
  | "withdrawn"
  | "not_applicable";

type SubjectMatter =
  | "contract"
  | "employment_discrimination"
  | "employment_other"
  | "ip_trademark"
  | "ip_patent"
  | "ip_copyright"
  | "securities"
  | "antitrust"
  | "civil_rights"
  | "tort"
  | "insurance"
  | "bankruptcy"
  | "immigration"
  | "criminal"
  | "habeas"
  | "other";
```

---

## Schema B: JudgeAnalysis

One per judge. Qualitative synthesis only — no stats, no counts, no percentages. Those are computed by our code from Schema A.

The LLM receives the full set of OpinionExtractions and writes behavioral observations grounded in what it sees.

```typescript
type JudgeAnalysis = {
  overview: string;                 // 2-3 sentence summary of this judge

  analyticalStyle: string[];        // 4-6 observations about reasoning approach
                                    // MUST cite specific case names as evidence

  summaryJudgment: string[];        // 4-5 observations specific to MSJ
                                    // reference actual outcomes from the data

  proceduralPreferences: string[];  // 4-6 things lawyers MUST know
                                    // things that will trip you up if you don't follow them

  discoveryApproach: string[];      // 3-4 observations on discovery handling

  tonalNotes: string[];             // 2-3 observations on writing style, temperament

  topPrecedents: PrecedentInsight[];// most-cited cases with HOW the judge uses them
                                    // counts computed by our code, context by LLM
};

type PrecedentInsight = {
  caseName: string;
  citation: string;
  context: string;                  // how this judge applies this precedent
};
```

### What Schema B does NOT include (computed by our code from Schema A):
- motionStats (granted/denied/partial counts, grant rates)
- avgOpinionLengthPages
- suaSponteRate
- dateRange
- opinionsAnalyzed count
- avgDecisionTimeDays
- precedent citation counts

---

## Computed Stats (our code, not LLM)

```typescript
type ComputedStats = {
  opinionsAnalyzed: number;
  dateRange: string;                // "2019–2026"

  motionStats: Array<{
    type: string;                   // human-readable label from MotionType
    granted: number;
    denied: number;
    partial: number;
    total: number;
    grantRate: string;              // "47%"
  }>;

  // Sliced by subject matter
  grantRateBySubject?: Array<{
    subjectMatter: string;
    motionType: string;
    grantRate: string;
    sampleSize: number;
  }>;

  avgOpinionLengthPages: number;
  suaSponteRate: string;            // "23%"

  precedentCounts: Array<{
    caseName: string;
    citation: string;
    count: number;                  // how many opinions cite this
  }>;

  movingPartyStats?: {
    plaintiffGrantRate: string;
    defendantGrantRate: string;
  };
};
```

---

## Final JudgeProfile (what gets stored and rendered)

```typescript
type JudgeProfile = {
  schemaVersion: 2;

  // From CourtListener People API (not LLM)
  bio: {
    judgeName: string;
    courtId: string;
    courtName: string;
    appointedBy?: string;
    confirmationVote?: string;
    birthYear?: number;
    education?: Array<{
      school: string;
      degree: string;
      year: number;
    }>;
    abaRating?: string;
  };

  // Computed from OpinionExtraction[] (deterministic)
  stats: ComputedStats;

  // LLM synthesis (Schema B)
  analysis: JudgeAnalysis;

  // Raw extractions (kept for recomputation and transparency)
  extractions: OpinionExtraction[];
};
```

---

## Test Plan

Run the same set of ~75 Seibel opinions through three models:
1. Gemini 2.5 Flash ($0.21)
2. Gemini 2.5 Pro ($1.69)
3. Claude Opus (this conversation — free for testing)

Each model gets the same prompt and must return Schema A (per-opinion extractions). We then:
- Compute stats identically for all three
- Run Schema B synthesis through each model
- Compare quality against the Furman example as floor
