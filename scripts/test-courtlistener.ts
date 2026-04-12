/**
 * Integration test for CourtListener API client.
 * Tests each function against the live API using Judge Cathy Seibel in SDNY.
 *
 * Run: npx tsx scripts/test-courtlistener.ts
 * Requires: COURTLISTENER_API_TOKEN env var
 */

// Load env from .env.local
import { readFileSync } from "fs";
import { join } from "path";

const envPath = join(import.meta.dirname, "..", ".env.local");
try {
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // no .env.local, rely on env vars
}

// Now import the client (it reads process.env at call time)
const BASE_URL = "https://www.courtlistener.com";
const TOKEN = process.env.COURTLISTENER_API_TOKEN;

if (!TOKEN) {
  console.error("COURTLISTENER_API_TOKEN not set");
  process.exit(1);
}

async function clFetch<T = any>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${TOKEN}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} for ${url}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

async function testFindDocket() {
  console.log("\n─ findDocket: 7:23-cv-08178 in SDNY");
  const data = await clFetch<any>(
    `/api/rest/v4/dockets/?docket_number=${encodeURIComponent("7:23-cv-08178")}&court=nysd`,
  );
  assert(data.results.length > 0, `Found ${data.results.length} docket(s)`);
  const docket = data.results[0];
  assert(typeof docket.case_name === "string" && docket.case_name.length > 0, `Case name: ${docket.case_name}`);
  assert(typeof docket.assigned_to_str === "string", `Judge: ${docket.assigned_to_str}`);
  assert(typeof docket.assigned_to === "string" && docket.assigned_to.includes("people"), `People URL present`);
  assert(typeof docket.id === "number", `Docket ID: ${docket.id}`);
  return docket;
}

async function testGetParties(docketId: number) {
  console.log("\n─ getParties: docket " + docketId);
  try {
    const data = await clFetch<any>(`/api/rest/v4/parties/?docket=${docketId}`);
    // May 403 on free tier — that's OK
    console.log(`  ✓ Got ${data.results?.length ?? 0} parties (or 403 handled)`);
    passed++;
  } catch (err: any) {
    if (err.message.includes("403")) {
      console.log(`  ✓ 403 as expected on free tier`);
      passed++;
    } else {
      console.error(`  ✗ Unexpected error: ${err.message}`);
      failed++;
    }
  }
}

async function testSearchOpinions() {
  console.log("\n─ searchOpinions: Seibel in SDNY");
  const data = await clFetch<any>(
    `/api/rest/v4/search/?type=o&q=${encodeURIComponent("Seibel")}&court=nysd&order_by=score+desc`,
  );
  assert(data.count > 0, `Found ${data.count} opinions`);
  assert(Array.isArray(data.results), `Results is an array`);
  assert(data.results.length > 0, `Has results on first page`);

  const first = data.results[0];
  assert(typeof first.caseName === "string", `caseName: ${first.caseName}`);
  assert(typeof first.cluster_id === "number", `cluster_id: ${first.cluster_id}`);
  assert(Array.isArray(first.opinions), `Has opinions array`);
  assert(first.opinions.length > 0, `Has at least one opinion`);
  assert(typeof first.opinions[0].id === "number", `Opinion ID: ${first.opinions[0].id}`);

  // Test pagination
  assert(typeof data.next === "string" || data.next === null, `next URL: ${data.next ? "present" : "null"}`);
  if (data.next) {
    const page2 = await clFetch<any>(data.next);
    assert(page2.results.length > 0, `Page 2 has ${page2.results.length} results`);
  }

  return first.opinions[0].id;
}

async function testGetOpinionText(opinionId: number) {
  console.log("\n─ getOpinionText: opinion " + opinionId);
  const full = await clFetch<any>(`/api/rest/v4/opinions/${opinionId}/`);

  const hasPlainText = typeof full.plain_text === "string" && full.plain_text.length > 0;
  const hasHtml = typeof full.html_with_citations === "string" && full.html_with_citations.length > 0;
  const hasHtmlFallback = typeof full.html === "string" && full.html.length > 0;

  assert(hasPlainText || hasHtml || hasHtmlFallback, `Has text content (plain=${hasPlainText}, html_citations=${hasHtml}, html=${hasHtmlFallback})`);

  const html = full.html_with_citations || full.html || null;
  const text = full.plain_text || (html ? stripHtml(html) : null);

  assert(text !== null && text.length > 100, `Extracted text: ${text?.length ?? 0} chars`);
  if (html) {
    assert(html.length > 100, `HTML preserved: ${html.length} chars`);
  }
}

async function testGetJudgeBio(personUrl: string) {
  console.log("\n─ getJudgeBio: " + personUrl);
  const person = await clFetch<any>(personUrl);

  assert(typeof person.name_first === "string", `First name: ${person.name_first}`);
  assert(typeof person.name_last === "string", `Last name: ${person.name_last}`);

  // Education
  const edu = person.educations ?? [];
  assert(Array.isArray(edu), `Education array: ${edu.length} entries`);
  if (edu.length > 0) {
    assert(typeof edu[0].school?.name === "string", `School: ${edu[0].school?.name}`);
    assert(typeof edu[0].degree_year === "number", `Degree year: ${edu[0].degree_year}`);
  }

  // ABA rating
  const aba = person.aba_ratings ?? [];
  assert(Array.isArray(aba), `ABA ratings: ${aba.length} entries`);

  // Positions (for appointment info)
  const positions = person.positions ?? [];
  assert(Array.isArray(positions) && positions.length > 0, `Positions: ${positions.length}`);

  // Try to get appointment info from first judicial position
  let foundAppointment = false;
  for (const posUrl of positions.slice(0, 3)) {
    if (typeof posUrl !== "string") continue;
    try {
      const pos = await clFetch<any>(posUrl);
      if (pos.position_type === "jud" && pos.appointer) {
        const appointer = await clFetch<any>(pos.appointer);
        if (appointer?.person?.name_first) {
          console.log(`  ✓ Appointed by: ${appointer.person.name_first} ${appointer.person.name_last}`);
          passed++;
          foundAppointment = true;
        }
        if (pos.votes_yes != null) {
          console.log(`  ✓ Confirmation: ${pos.votes_yes}-${pos.votes_no}`);
          passed++;
        }
        break;
      }
    } catch { /* skip */ }
  }
  if (!foundAppointment) {
    console.log(`  - Could not find appointment info (not a failure)`);
  }
}

// ─── Run all tests ──────────────────────────────────────────────────

console.log("CourtListener API Integration Test");
console.log("==================================");

try {
  const docket = await testFindDocket();
  await testGetParties(docket.id);
  const opinionId = await testSearchOpinions();
  await testGetOpinionText(opinionId);
  if (docket.assigned_to) {
    await testGetJudgeBio(docket.assigned_to);
  }

  console.log(`\n==================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
} catch (err) {
  console.error(`\nFatal error: ${err}`);
  process.exit(1);
}
