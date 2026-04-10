export type MotionStat = {
  type: string;
  granted: number;
  denied: number;
  partial: number;
  total: number;
  rate: string;
};

export type PrecedentCitation = {
  case: string;
  count: number;
  context: string;
};

export type JudgeProfile = {
  overview?: string;
  atAGlance?: {
    avgOpinionLengthPages?: number;
    msjGrantRate?: string;
    mtdGrantRate?: string;
    opinionsAnalyzed?: number;
    dateRange?: string;
    suaSponteRate?: string;
  };
  motionStats?: MotionStat[];
  analyticalStyle?: string[];
  proceduralPreferences?: string[];
  discoveryApproach?: string[];
  summaryJudgment?: string[];
  tonalNotes?: string[];
  topPrecedents?: PrecedentCitation[];
  timeline?: {
    avgMotionToDecision?: string;
    avgMTDDecision?: string;
    avgMSJDecision?: string;
  };
  // Legacy/heuristic fields
  judgeName?: string;
  courtName?: string;
  grantRates?: Array<{
    motionType: string;
    sampleSize?: number;
    grantRate?: number;
    granted?: number;
    denied?: number;
    mixed?: number;
  }>;
  keyTendencies?: string[];
  redFlags?: string[];
  citedPrecedents?: string[];
  bio?: {
    appointedBy?: string;
    birthYear?: number;
    activeStatus?: string;
  } | null;
};

export function parseJudgeProfile(input?: string | null): JudgeProfile | null {
  if (!input) return null;
  try {
    return JSON.parse(input) as JudgeProfile;
  } catch {
    return null;
  }
}
