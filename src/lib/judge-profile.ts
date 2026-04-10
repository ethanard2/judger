export type JudgeProfile = {
  judgeName?: string;
  overview?: string;
  grantRates?: Array<{
    motionType: string;
    sampleSize?: number;
    grantRate?: number;
    granted?: number;
    denied?: number;
    mixed?: number;
  }>;
  keyTendencies?: string[];
  analyticalFrameworks?: string[];
  proceduralPreferences?: string[];
  redFlags?: string[];
  citedPrecedents?: string[];
  focusAreas?: string[];
  tone?: {
    style?: string;
    detailLevel?: string;
  };
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
