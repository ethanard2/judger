# CourtCase Companion — MVP Spec (Weekend Build)

## What It Is

A web app where a lawyer enters a federal case number. The system pulls the full docket and the assigned judge's ruling history from public sources, runs AI analysis, and delivers a strategic litigation companion — a conversational interface that knows the judge's patterns AND the user's specific case.

**Not** a dashboard. Not a report generator. A co-pilot for litigation.

-----

## User Flow

1. Lawyer signs up (email + password, or Google OAuth)
1. Enters a federal case number (e.g., `1:24-cv-03821` in `SDNY`)
1. Selects the court from a dropdown (maps to CourtListener court IDs)
1. Hits "Analyze" — sees a progress screen as the system works
1. ~30-60 min later: gets an email notification that their case is ready
1. Opens the case page → sees judge profile + case summary + a chat interface
1. Asks questions like:
   - "How does this judge handle summary judgment motions in contract disputes?"
   - "Opposing counsel just filed a motion to compel. What should I expect?"
   - "Draft my opposition brief structured for how this judge reads arguments."

-----

## Architecture

### Stack

- **Frontend:** TanStack Start
- **Backend/DB:** Convex
- **Hosting:** Vercel
- **Data source:** CourtListener REST API (v4)
- **AI:** Claude API (Sonnet for extraction, Opus for strategic analysis/chat)
- **Auth:** Convex auth (or Clerk)
- **Email notifications:** Resend

### System Diagram

```
User enters case number
        │
        ▼
  Convex mutation: create case record (status: "pending")
        │
        ▼
  Convex action: "ingestCase"
        ├── 1. Search CourtListener for docket by case number + court
        ├── 2. Pull docket metadata (judge, parties, attorneys, case type)
        ├── 3. Pull all docket entries + available documents
        ├── 4. Identify the assigned judge → query CourtListener for their other opinions
        ├── 5. Pull last 50-100 opinions by this judge (full text)
        │
        ▼
  Convex action: "analyzeJudge"
        ├── Chunk judge opinions into batches
        ├── Send each batch to Claude Sonnet for structured extraction
        ├── Merge extracted data into a single judge profile
        ├── Store profile in judges table
        │
        ▼
  Convex action: "analyzeCase"
        ├── Send key case documents + judge profile to Claude
        ├── Generate case-specific strategic analysis
        ├── Store analysis in cases table
        ├── Flip status to "ready"
        └── Send email notification via Resend
```

-----

## Convex Schema

```typescript
// schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    clerkId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  cases: defineTable({
    userId: v.id("users"),
    caseNumber: v.string(),         // e.g., "1:24-cv-03821"
    courtId: v.string(),            // CourtListener court ID, e.g., "nyed"
    courtName: v.string(),          // "Eastern District of New York"
    judgeId: v.optional(v.id("judges")),

    // Docket metadata
    caseName: v.optional(v.string()),     // "Smith v. Jones"
    dateField: v.optional(v.string()),    // date filed
    caseType: v.optional(v.string()),     // "civil", "criminal"
    natureOfSuit: v.optional(v.string()), // CourtListener NOS code
    parties: v.optional(v.array(v.object({
      name: v.string(),
      role: v.string(),              // "plaintiff", "defendant"
      attorneys: v.array(v.object({
        name: v.string(),
        firm: v.optional(v.string()),
      })),
    }))),

    // AI analysis
    caseAnalysis: v.optional(v.string()),  // AI-generated strategic analysis (JSON string)

    // Sync state
    status: v.union(
      v.literal("pending"),
      v.literal("ingesting_docket"),
      v.literal("ingesting_judge"),
      v.literal("analyzing_judge"),
      v.literal("analyzing_case"),
      v.literal("ready"),
      v.literal("error")
    ),
    statusMessage: v.optional(v.string()),
    courtListenerDocketId: v.optional(v.number()),

    createdAt: v.number(),
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_case_number", ["caseNumber", "courtId"]),

  judges: defineTable({
    name: v.string(),
    courtId: v.string(),
    courtListenerPersonId: v.optional(v.number()),

    // Biographical
    appointedBy: v.optional(v.string()),
    birthYear: v.optional(v.number()),
    activeStatus: v.optional(v.string()),

    // AI-generated profile (structured JSON stored as string)
    profile: v.optional(v.string()),

    // Metadata
    opinionCount: v.optional(v.number()),
    lastAnalyzedAt: v.optional(v.number()),
    profileStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
  })
    .index("by_court", ["courtId"])
    .index("by_courtlistener_id", ["courtListenerPersonId"]),

  docketEntries: defineTable({
    caseId: v.id("cases"),
    entryNumber: v.optional(v.number()),
    dateFiled: v.optional(v.string()),
    description: v.string(),
    documentUrl: v.optional(v.string()),
    rawText: v.optional(v.string()),        // extracted text if available
    documentType: v.optional(v.string()),   // "motion", "order", "brief", "opinion"
    courtListenerEntryId: v.optional(v.number()),
  }).index("by_case", ["caseId"]),

  judgeOpinions: defineTable({
    judgeId: v.id("judges"),
    courtListenerClusterId: v.number(),
    caseName: v.optional(v.string()),
    dateFiled: v.optional(v.string()),
    caseType: v.optional(v.string()),
    opinionText: v.string(),              // full text of the opinion
    extractedData: v.optional(v.string()), // AI-extracted structured data (JSON string)
  }).index("by_judge", ["judgeId"]),

  conversations: defineTable({
    caseId: v.id("cases"),
    userId: v.id("users"),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      timestamp: v.number(),
    })),
  }).index("by_case", ["caseId"]),
});
```

-----

## CourtListener API Integration

### Authentication

- Register at courtlistener.com, get API token
- All requests: `Authorization: Token <token>`

### Key Endpoints

#### 1. Find a docket by case number

```
GET /api/rest/v4/dockets/?docket_number=1:24-cv-03821&court=nyed
```

Returns docket metadata including judge, parties, date filed, case type.

#### 2. Get docket entries for a case

```
GET /api/rest/v4/docket-entries/?docket=<docket_id>
```

Returns chronological list of all filings. Each entry has nested `recap_documents` with links to available document text.

#### 3. Get parties and attorneys

```
GET /api/rest/v4/parties/?docket=<docket_id>
```

Returns all parties with nested attorney info.

#### 4. Find judge by name → get their opinions

```
GET /api/rest/v4/search/?type=o&judge=<judge_name>&court=<court_id>&order_by=-dateFiled
```

Returns opinion clusters authored by this judge, ordered by most recent. Paginate to get 50-100.

#### 5. Get full opinion text

```
GET /api/rest/v4/opinions/<opinion_id>/
```

Returns opinion with full text in `plain_text`, `html`, or `html_with_citations` fields.

#### 6. Get judge biographical data

```
GET /api/rest/v4/people/?name_last=<last_name>&positions__court=<court_id>
```

Returns judge bio, education, appointment info, political affiliation.

### Rate Limits

- CourtListener throttles at ~5,000 requests/day for authenticated users
- For the MVP, this is fine — you're pulling ~100-200 requests per case (docket + entries + judge opinions)
- Cache aggressively — judge opinions don't change

### Important Notes

- Not all docket documents have full text available in CourtListener
- Some documents are only available via PACER (costs $0.10/page)
- For MVP: use what's freely available. Flag gaps to the user.
- The `recap_documents` array on docket entries tells you if text is available

-----

## AI Prompts

### Judge Profile Extraction

Run this on batches of 5-10 opinions at a time, then merge results:

```
System: You are a legal analyst building a behavioral profile of a federal judge
based on their written opinions and orders. Extract structured data from the
provided opinions.

For each opinion, extract:
- Motion type (MSJ, MTD, MTC, TRO, etc.)
- Outcome (granted, denied, granted in part)
- Key legal issues addressed
- Procedural posture
- Notable reasoning patterns
- Precedents cited (top 5)
- Opinion length (approximate)
- Whether the judge raised issues sua sponte
- Tone indicators (formal/informal, detailed/terse)

After processing all opinions, synthesize a profile:
- Overall grant/deny rates by motion type
- Preferred analytical frameworks
- Issues the judge cares about most
- Patterns in how the judge structures analysis
- Red flags that seem to trigger denials
- Procedural requirements the judge enforces strictly
- Average opinion length by motion type
- Most frequently cited precedents

Return as JSON.
```

### Case Strategic Analysis

Run after judge profile is built:

```
System: You are a litigation strategist. You have two sources of intelligence:

1. A behavioral profile of the assigned judge, built from analysis of their
   last [N] opinions (provided below as JSON).
2. The docket and key filings from the user's specific case (provided below).

Based on this intelligence, provide:

- Case posture assessment: Where does this case stand procedurally?
- Judge-specific risks: Based on this judge's patterns, what are the biggest
  risks for each side?
- Strategic recommendations: How should the user structure their next filing
  given this judge's preferences?
- Opposing counsel assessment: Based on the filings in this case, what patterns
  do you see in opposing counsel's approach?
- Timeline prediction: Based on this judge's typical pace, what's the likely
  timeline from here?
- Key issues to watch: What issues is this judge likely to raise or focus on?

Be specific. Reference the judge's actual rulings. Don't hedge with generic advice.
```

### Chat System Prompt

```
System: You are a litigation companion for a lawyer working on a federal case.

You have deep knowledge of:

1. The assigned judge's behavioral patterns (profile attached)
2. The full docket and key filings in this case (case data attached)

When answering questions:
- Be specific about this judge's tendencies, citing their actual prior rulings
- Connect judge intelligence to the specific facts of this case
- If asked to draft, structure the output the way this judge prefers to read it
- Flag when you're uncertain or when the available data is limited
- Never fabricate case citations — only reference rulings in the judge profile data
- If you don't have enough data to answer confidently, say so

You are not a lawyer. You are an intelligence tool. Always recommend the user
verify your analysis and consult with qualified counsel.
```

-----

## Convex Actions (Backend Logic)

### ingestCase action (pseudocode)

```typescript
// convex/actions/ingestCase.ts
export const ingestCase = action({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const caseRecord = await ctx.runQuery(internal.cases.get, { id: caseId });

    // 1. Update status
    await ctx.runMutation(internal.cases.updateStatus, {
      id: caseId, status: "ingesting_docket", message: "Searching for case..."
    });

    // 2. Find docket on CourtListener
    const docketResults = await courtListenerFetch(
      `/api/rest/v4/dockets/?docket_number=${caseRecord.caseNumber}&court=${caseRecord.courtId}`
    );

    if (!docketResults.count) {
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId, status: "error", message: "Case not found on CourtListener"
      });
      return;
    }

    const docket = docketResults.results[0];

    // 3. Store docket metadata
    await ctx.runMutation(internal.cases.updateDocketData, {
      id: caseId,
      caseName: docket.case_name,
      dateField: docket.date_filed,
      courtListenerDocketId: docket.id,
      // ... extract judge name, parties, etc.
    });

    // 4. Pull docket entries (paginate)
    let entriesUrl = `/api/rest/v4/docket-entries/?docket=${docket.id}&order_by=entry_number`;
    while (entriesUrl) {
      const entriesPage = await courtListenerFetch(entriesUrl);
      for (const entry of entriesPage.results) {
        await ctx.runMutation(internal.docketEntries.create, {
          caseId,
          entryNumber: entry.entry_number,
          dateFiled: entry.date_filed,
          description: entry.description,
          rawText: entry.recap_documents?.[0]?.plain_text || null,
          courtListenerEntryId: entry.id,
        });
      }
      entriesUrl = entriesPage.next;
    }

    // 5. Find or create judge record
    const judgeName = docket.assigned_to_str; // e.g., "Jesse M. Furman"
    await ctx.runMutation(internal.cases.updateStatus, {
      id: caseId, status: "ingesting_judge", message: `Pulling opinions for Judge ${judgeName}...`
    });

    let judge = await ctx.runQuery(internal.judges.findByNameAndCourt, {
      name: judgeName, courtId: caseRecord.courtId
    });

    if (!judge) {
      const judgeId = await ctx.runMutation(internal.judges.create, {
        name: judgeName,
        courtId: caseRecord.courtId,
        profileStatus: "pending",
      });
      judge = { _id: judgeId, profileStatus: "pending" };
    }

    await ctx.runMutation(internal.cases.patch, { id: caseId, judgeId: judge._id });

    // 6. If judge profile not yet built, pull their opinions
    if (judge.profileStatus !== "ready") {
      const opinions = await courtListenerFetch(
        `/api/rest/v4/search/?type=o&judge=${encodeURIComponent(judgeName)}&court=${caseRecord.courtId}&order_by=-dateFiled`
      );

      let count = 0;
      let cursor = opinions;
      while (cursor && count < 75) {
        for (const opinion of cursor.results) {
          // Fetch full opinion text
          const fullOpinion = await courtListenerFetch(
            `/api/rest/v4/opinions/${opinion.id}/`
          );

          if (fullOpinion.plain_text || fullOpinion.html) {
            await ctx.runMutation(internal.judgeOpinions.create, {
              judgeId: judge._id,
              courtListenerClusterId: opinion.cluster_id,
              caseName: opinion.caseName,
              dateFiled: opinion.dateFiled,
              opinionText: fullOpinion.plain_text || stripHtml(fullOpinion.html),
            });
            count++;
          }
        }
        cursor = cursor.next ? await courtListenerFetch(cursor.next) : null;
      }

      // 7. Kick off judge analysis
      await ctx.scheduler.runAfter(0, internal.actions.analyzeJudge, {
        judgeId: judge._id, caseId
      });
    } else {
      // Judge already analyzed, go straight to case analysis
      await ctx.scheduler.runAfter(0, internal.actions.analyzeCase, { caseId });
    }
  }
});
```

### analyzeJudge action (pseudocode)

```typescript
// convex/actions/analyzeJudge.ts
export const analyzeJudge = action({
  args: { judgeId: v.id("judges"), caseId: v.id("cases") },
  handler: async (ctx, { judgeId, caseId }) => {
    await ctx.runMutation(internal.cases.updateStatus, {
      id: caseId, status: "analyzing_judge", message: "Analyzing judge's ruling patterns..."
    });

    const opinions = await ctx.runQuery(internal.judgeOpinions.byJudge, { judgeId });

    // Chunk opinions into batches of ~5-8 (to stay within context limits)
    const batches = chunkArray(opinions, 6);
    const batchResults = [];

    for (const batch of batches) {
      const opinionTexts = batch.map((op, i) =>
        `--- OPINION ${i + 1}: ${op.caseName} (${op.dateFiled}) ---\n${op.opinionText}`
      ).join("\n\n");

      const result = await callClaude({
        model: "claude-sonnet-4-20250514",
        system: JUDGE_PROFILE_EXTRACTION_PROMPT,
        messages: [{ role: "user", content: opinionTexts }],
        max_tokens: 4096,
      });

      batchResults.push(JSON.parse(result));
    }

    // Merge batch results into a single profile
    const mergedProfile = await callClaude({
      model: "claude-sonnet-4-20250514",
      system: "Merge these partial judge profile extractions into a single comprehensive profile. Return as JSON.",
      messages: [{ role: "user", content: JSON.stringify(batchResults) }],
      max_tokens: 8192,
    });

    await ctx.runMutation(internal.judges.updateProfile, {
      judgeId,
      profile: mergedProfile,
      opinionCount: opinions.length,
      lastAnalyzedAt: Date.now(),
      profileStatus: "ready",
    });

    // Now analyze the case
    await ctx.scheduler.runAfter(0, internal.actions.analyzeCase, { caseId });
  }
});
```

### analyzeCase action (pseudocode)

```typescript
// convex/actions/analyzeCase.ts
export const analyzeCase = action({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    await ctx.runMutation(internal.cases.updateStatus, {
      id: caseId, status: "analyzing_case", message: "Building strategic analysis..."
    });

    const caseRecord = await ctx.runQuery(internal.cases.get, { id: caseId });
    const judge = await ctx.runQuery(internal.judges.get, { id: caseRecord.judgeId });
    const entries = await ctx.runQuery(internal.docketEntries.byCase, { caseId });

    // Build case context from docket entries
    const docketSummary = entries.map(e =>
      `[${e.dateFiled}] #${e.entryNumber}: ${e.description}${e.rawText ? '\n' + e.rawText.slice(0, 2000) : ''}`
    ).join("\n");

    const analysis = await callClaude({
      model: "claude-sonnet-4-20250514",
      system: CASE_STRATEGIC_ANALYSIS_PROMPT,
      messages: [{
        role: "user",
        content: `## Judge Profile\n${judge.profile}\n\n## Case: ${caseRecord.caseName}\n## Parties\n${JSON.stringify(caseRecord.parties)}\n\n## Docket\n${docketSummary}`
      }],
      max_tokens: 8192,
    });

    await ctx.runMutation(internal.cases.patch, {
      id: caseId,
      caseAnalysis: analysis,
      status: "ready",
      lastSyncedAt: Date.now(),
    });

    // Send email notification
    await sendEmail({
      to: (await ctx.runQuery(internal.users.get, { id: caseRecord.userId })).email,
      subject: `Your case analysis is ready: ${caseRecord.caseName}`,
      body: `Your litigation companion for ${caseRecord.caseName} is ready. Log in to view your analysis and start asking questions.`,
    });
  }
});
```

-----

## Frontend Pages

### 1. Landing / Home (`/`)

- Value prop: "Know your judge before you walk into court."
- Single input: case number + court selector
- CTA: "Analyze This Case" (requires auth)

### 2. Dashboard (`/dashboard`)

- List of user's analyzed cases
- Status indicators (pending/processing/ready)
- Each case card shows: case name, judge, court, status, date analyzed

### 3. Case Page (`/case/:id`)

- **Header:** Case name, case number, court, judge name
- **Tab 1 — Judge Profile:** Rendered from the judge profile JSON
  - Grant/deny rates by motion type (simple bar chart)
  - Key tendencies (bullet points)
  - Most cited precedents
  - Procedural preferences
- **Tab 2 — Case Analysis:** The AI-generated strategic assessment
- **Tab 3 — Docket:** Chronological list of docket entries
- **Tab 4 — Chat:** The companion interface
  - System prompt pre-loaded with judge profile + case data
  - Streaming responses via Claude API
  - Message history persisted in Convex

### 4. Auth Pages

- Sign up / sign in (Clerk or Convex auth)

-----

## Chat Implementation

The chat is the product. It's a streaming Claude call with the judge profile and case data injected into the system prompt.

```typescript
// convex/actions/chat.ts
export const sendMessage = action({
  args: {
    caseId: v.id("cases"),
    message: v.string(),
  },
  handler: async (ctx, { caseId, message }) => {
    const caseRecord = await ctx.runQuery(internal.cases.get, { id: caseId });
    const judge = await ctx.runQuery(internal.judges.get, { id: caseRecord.judgeId });
    const conversation = await ctx.runQuery(internal.conversations.byCase, { caseId });
    const entries = await ctx.runQuery(internal.docketEntries.byCase, { caseId });

    // Build the context
    const systemPrompt = CHAT_SYSTEM_PROMPT +
      `\n\n## JUDGE PROFILE\n${judge.profile}` +
      `\n\n## CASE ANALYSIS\n${caseRecord.caseAnalysis}` +
      `\n\n## DOCKET SUMMARY\n${entries.map(e => `[${e.dateFiled}] ${e.description}`).join('\n')}`;

    // Build message history
    const messages = [
      ...(conversation?.messages || []).map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const response = await callClaude({
      model: "claude-sonnet-4-20250514",
      system: systemPrompt,
      messages,
      max_tokens: 4096,
    });

    // Save to conversation
    await ctx.runMutation(internal.conversations.appendMessages, {
      caseId,
      messages: [
        { role: "user", content: message, timestamp: Date.now() },
        { role: "assistant", content: response, timestamp: Date.now() },
      ],
    });

    return response;
  }
});
```

-----

## Cost Estimates

### Per-case COGS

| Component                     | Cost            | Notes                                          |
| ----------------------------- | --------------- | ---------------------------------------------- |
| CourtListener API             | $0              | Free for authenticated users                   |
| Judge profile extraction      | ~$1-3           | Sonnet processing ~50 opinions in batches      |
| Case strategic analysis       | ~$0.50-1        | Single Sonnet call with judge profile + docket |
| Chat messages                 | ~$0.02-0.10/msg | Sonnet with cached system prompt               |
| **Total first-time analysis** | **~$2-5**       | Amortized lower when judge is already cached   |

### Pricing

| Tier     | Price   | What You Get                                          |
| -------- | ------- | ----------------------------------------------------- |
| Per case | $29     | One case analysis + judge profile + 50 chat messages  |
| Monthly  | $79/mo  | 5 cases/month + unlimited chat on analyzed cases      |
| Annual   | $699/yr | 10 cases/month + unlimited chat + priority processing |

At $29/case with ~$3-5 COGS, you're looking at ~85% gross margin.

-----

## Weekend Build Plan

### Saturday

**Morning (4 hrs):**

- Scaffold TanStack Start project with Convex
- Set up auth (Clerk)
- Define Convex schema
- Build CourtListener API utility functions
- Test: can you search for a docket and get results?

**Afternoon (4 hrs):**

- Build `ingestCase` action — docket pull + judge opinion pull
- Build `analyzeJudge` action — batch opinion processing through Claude
- Build `analyzeCase` action — strategic analysis generation
- Wire up the action chain with Convex scheduler
- Test: enter a case number, wait, get a completed analysis

### Sunday

**Morning (4 hrs):**

- Build the frontend: landing page, dashboard, case page
- Render judge profile and case analysis
- Build the real-time status updates (Convex reactive queries)

**Afternoon (4 hrs):**

- Build the chat interface with streaming
- Add Stripe checkout for per-case purchases
- Add email notifications via Resend
- Deploy to Vercel
- Test end-to-end with 2-3 real cases

-----

## V2 Features (Week 2+)

- **PACER integration:** For documents not available in CourtListener's RECAP archive
- **Opposing counsel profiles:** Pull attorney's filing history across cases
- **Docket monitoring:** Webhook/polling for new filings, auto-analyze and alert
- **Document upload:** Let users upload their own briefs for case-specific drafting help
- **State court support:** Integrate with state e-filing systems (start with NY, CA, TX)
- **Brief drafting:** "Draft my opposition structured for this judge" as a first-class feature
- **Team accounts:** Multiple attorneys on the same case
- **Embeddable widget:** Let legal tech platforms embed your judge intelligence via API

-----

## Key Risks

1. **CourtListener data gaps:** Not all docket documents have full text. Many are PACER-only. The judge opinion corpus should be solid, but individual case filings may be incomplete. Mitigate by being transparent about coverage and adding PACER integration in V2.
1. **Judge name normalization:** CourtListener sometimes stores judge names as strings rather than linked person records. You'll need fuzzy matching. Their judge API helps but isn't perfect.
1. **Context window limits:** A busy judge's 50 opinions could be millions of tokens. Batch processing and smart summarization are essential. Consider extracting structured data per-opinion and working from the structured data rather than raw text for the chat context.
1. **Accuracy/liability:** You are NOT providing legal advice. Terms of service must make this clear. The tool provides data-driven intelligence; the lawyer makes the decisions. Include disclaimers prominently.
1. **CourtListener rate limits:** ~5,000 requests/day. For a weekend MVP with a handful of users this is fine. At scale you'd need to negotiate higher limits or use their bulk data downloads.
1. **Convex action timeouts:** Long-running ingestion jobs may need to be broken into chained actions to avoid timeout limits. Use `ctx.scheduler.runAfter(0, ...)` to chain.
