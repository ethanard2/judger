export function classifyDocumentType(description: string | null | undefined): string {
  const s = description?.toLowerCase() ?? "";
  if (s.includes("summary judgment")) return "summary_judgment";
  if (s.includes("motion to dismiss")) return "motion_to_dismiss";
  if (s.includes("motion to compel")) return "motion_to_compel";
  if (s.includes("temporary restraining order")) return "tro";
  if (s.includes("preliminary injunction")) return "preliminary_injunction";
  if (s.includes("order")) return "order";
  if (s.includes("brief") || s.includes("memorandum")) return "brief";
  if (s.includes("opinion")) return "opinion";
  if (s.includes("complaint")) return "complaint";
  if (s.includes("answer")) return "answer";
  return "filing";
}

export function extractJsonPayload(input: string): string {
  const fenced = input.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced) return fenced[1].trim();
  const first = input.indexOf("{");
  const last = input.lastIndexOf("}");
  if (first !== -1 && last > first) return input.slice(first, last + 1);
  return input;
}

export function safeJsonParse<T>(input: string | null | undefined, fallback: T): T {
  if (!input) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function truncate(input: string | null | undefined, length: number): string | undefined {
  if (!input) return undefined;
  if (input.length <= length) return input;
  return input.slice(0, length - 1) + "…";
}
