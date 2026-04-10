const BASE_URL = "https://www.courtlistener.com";

export async function courtListenerFetch<T = any>(
  path: string,
): Promise<T> {
  const token = process.env.COURTLISTENER_API_TOKEN;
  if (!token) {
    throw new Error(
      "COURTLISTENER_API_TOKEN not configured. Get one at courtlistener.com",
    );
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `CourtListener API error ${response.status} for ${url}: ${body.slice(0, 200)}`,
    );
  }

  return response.json();
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// CourtListener API response types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Docket {
  id: number;
  case_name: string;
  date_filed: string;
  assigned_to_str: string;
  court: string;
  docket_number: string;
  nature_of_suit: string;
  cause: string;
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

export interface Party {
  name: string;
  party_type: { name: string };
  attorneys: Array<{
    name: string;
    firms: Array<{ name: string }>;
  }>;
}

export interface OpinionSearchResult {
  id: number;
  cluster_id: number;
  caseName: string;
  dateFiled: string;
  court: string;
}

export interface Opinion {
  id: number;
  plain_text: string | null;
  html: string | null;
  html_with_citations: string | null;
}
