/**
 * CourtListener API client.
 *
 * Endpoints used:
 *   - Dockets:   GET /api/rest/v4/dockets/?docket_number=X&court=Y
 *   - Search:    GET /api/rest/v4/search/?type=o&q=X&court=Y  (opinion search)
 *   - Opinions:  GET /api/rest/v4/opinions/{id}/               (full text)
 *   - People:    GET /api/rest/v4/people/{id}/                  (judge bio)
 *   - Positions: GET /api/rest/v4/positions/{id}/               (appointment info)
 *   - Parties:   GET /api/rest/v4/parties/?docket={id}          (may 403 on free tier)
 *
 * Auth: Token header. Free tier gets ~5,000 req/hour.
 * Some endpoints (docket-entries, attorneys, parties) restricted on free tier.
 */

const BASE_URL = "https://www.courtlistener.com";

export function canUseCourtListener(): boolean {
  return Boolean(process.env.COURTLISTENER_API_TOKEN);
}

async function clFetch<T = any>(path: string): Promise<T> {
  const token = process.env.COURTLISTENER_API_TOKEN;
  if (!token) {
    throw new Error("COURTLISTENER_API_TOKEN not configured");
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `CourtListener ${res.status} for ${url}: ${body.slice(0, 200)}`,
    );
  }

  return res.json();
}

// Re-export for backward compat with ingest.ts / opinionDownloader.ts
export const courtListenerFetch = clFetch;

// ─── Dockets ────────────────────────────────────────────────────────

export interface Docket {
  id: number;
  case_name: string;
  date_filed: string;
  assigned_to_str: string;
  assigned_to: string | null; // URL to People API
  court: string;
  docket_number: string;
  nature_of_suit: string;
  cause: string;
}

export async function findDocket(
  caseNumber: string,
  courtId: string,
): Promise<Docket | null> {
  const data = await clFetch<PaginatedResponse<Docket>>(
    `/api/rest/v4/dockets/?docket_number=${encodeURIComponent(caseNumber)}&court=${courtId}`,
  );
  return data.results[0] ?? null;
}

// ─── Parties (may 403 on free tier) ─────────────────────────────────

export interface Party {
  name: string;
  party_type: { name: string };
  attorneys: Array<{
    name: string;
    firms: Array<{ name: string }>;
  }>;
}

export async function getParties(
  docketId: number,
): Promise<Array<{ name: string; role: string; attorneys: Array<{ name: string; firm?: string }> }>> {
  try {
    const data = await clFetch<PaginatedResponse<Party>>(
      `/api/rest/v4/parties/?docket=${docketId}`,
    );
    return data.results.map((p) => ({
      name: p.name,
      role: p.party_type?.name ?? "unknown",
      attorneys: (p.attorneys ?? []).map((a) => ({
        name: a.name,
        firm: a.firms?.[0]?.name,
      })),
    }));
  } catch {
    return []; // 403 on free tier
  }
}

// ─── Opinion Search ─────────────────────────────────────────────────

export interface OpinionSearchResult {
  cluster_id: number;
  caseName: string;
  dateFiled: string;
  court: string;
  court_id: string;
  judge: string;
  opinions: Array<{
    id: number;
    snippet: string;
    type: string;
  }>;
}

/**
 * Search for opinions by judge name in a court.
 * Returns one page at a time. Pass `nextUrl` to paginate.
 */
export async function searchOpinions(
  judgeName: string,
  courtId: string,
  nextUrl?: string,
): Promise<{ results: OpinionSearchResult[]; next: string | null; count: number }> {
  const url =
    nextUrl ??
    `/api/rest/v4/search/?type=o&q=${encodeURIComponent(judgeName)}&court=${courtId}&order_by=score+desc`;
  const data = await clFetch<any>(url);
  return {
    results: data.results ?? [],
    next: data.next ?? null,
    count: data.count ?? 0,
  };
}

// ─── Opinion Full Text ──────────────────────────────────────────────

export interface OpinionFull {
  id: number;
  plain_text: string | null;
  html: string | null;
  html_with_citations: string | null;
}

export async function getOpinionText(
  opinionId: number,
): Promise<{ text: string; html: string | null }> {
  const full = await clFetch<OpinionFull>(
    `/api/rest/v4/opinions/${opinionId}/`,
  );

  const html = full.html_with_citations || full.html || null;
  const text =
    full.plain_text ||
    (html ? stripHtml(html) : null);

  if (!text || text.length < 100) {
    throw new Error(`Opinion ${opinionId} has no usable text`);
  }

  return { text, html };
}

// ─── Judge Bio (People API) ─────────────────────────────────────────

export interface JudgeBio {
  name: string;
  birthYear?: number;
  appointedBy?: string;
  confirmationVote?: string;
  education: Array<{ school: string; degree: string; year: number }>;
  abaRating?: string;
  politicalAffiliation?: string;
}

/**
 * Get judge biographical data from a People API URL.
 * The URL comes from docket.assigned_to field.
 */
export async function getJudgeBio(personUrl: string): Promise<JudgeBio | null> {
  try {
    const person = await clFetch<any>(personUrl);

    const education = (person.educations ?? []).map((e: any) => ({
      school: e.school?.name ?? "Unknown",
      degree: e.degree_detail ?? e.degree_level ?? "Unknown",
      year: e.degree_year,
    }));

    const abaRatings = person.aba_ratings ?? [];
    const abaRating = abaRatings[0]?.rating
      ? formatAbaRating(abaRatings[0].rating)
      : undefined;

    const politicalAffiliation = person.political_affiliations?.[0]?.political_party
      ? formatParty(person.political_affiliations[0].political_party)
      : undefined;

    const name = [person.name_first, person.name_middle, person.name_last]
      .filter(Boolean)
      .join(" ");

    const birthYear = person.date_dob
      ? parseInt(person.date_dob.split("-")[0]) || undefined
      : undefined;

    // Get appointment info from positions
    let appointedBy: string | undefined;
    let confirmationVote: string | undefined;
    const positions = person.positions ?? [];
    for (const posUrl of positions) {
      if (typeof posUrl !== "string") continue;
      try {
        const pos = await clFetch<any>(posUrl);
        if (pos.position_type === "jud" && pos.appointer) {
          try {
            const appointer = await clFetch<any>(pos.appointer);
            if (appointer?.person?.name_first) {
              appointedBy = `${appointer.person.name_first} ${appointer.person.name_last}`;
            }
          } catch { /* skip */ }
          if (pos.votes_yes != null && pos.votes_no != null) {
            confirmationVote = `${pos.votes_yes}-${pos.votes_no}`;
          }
          break;
        }
      } catch { /* skip */ }
    }

    return {
      name,
      birthYear,
      appointedBy,
      confirmationVote,
      education,
      abaRating,
      politicalAffiliation,
    };
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DocketEntry {
  id: number;
  entry_number: number;
  date_filed: string;
  description: string;
  recap_documents: Array<{
    id: number;
    plain_text: string | null;
    document_type: string;
  }>;
}

function formatAbaRating(code: string): string {
  const ratings: Record<string, string> = {
    "ewq": "Exceptionally Well Qualified",
    "wq": "Well Qualified",
    "q": "Qualified",
    "nq": "Not Qualified",
    "nqa": "Not Qualified by Reason of Age",
  };
  return ratings[code] ?? code;
}

function formatParty(code: string): string {
  const parties: Record<string, string> = {
    "d": "Democratic",
    "r": "Republican",
    "i": "Independent",
  };
  return parties[code] ?? code;
}
