CourtCase Companion Feedback

Repo reviewed: `/home/ethan/judger`
Review scope: implementation quality, product completeness, correctness risks, and comparison against the other Claude-built version.

Summary

This repo is not sloppy. It builds cleanly and typechecks cleanly:

- `npm run build`
- `npx tsc --noEmit`

The implementation is more opinionated and more “real app” oriented than the other version, especially around auth and user flow. The tradeoff is that it is less defensive and has a few sharper correctness and security risks.

Key Findings

1. High: case ownership is enforced, but related data ownership is not consistently enforced.

- Case access is guarded in `convex/cases.ts:23`.
- Public docket access in `convex/docketEntries.ts:4` does not verify the current user owns the case.
- Public conversation access in `convex/conversations.ts:4` also does not verify case ownership.
- The case page calls those public queries immediately in `src/routes/case/$caseId.tsx:18`.

Impact:

If a valid case id is known, docket entries and conversation history may be retrievable without the same authorization standard used for the case record itself.

Recommendation:

- Make `docketEntries.byCase` and `conversations.byCase` enforce ownership through the parent case record.
- Prefer a single case-detail query that returns only authorized related data.

2. High: the async pipeline has weak failure handling and can strand cases in processing states.

- `convex/ingest.ts:15` has no top-level catch that converts failures into `status: "error"`.
- `convex/analyze.ts:12` also relies on the happy path.

Impact:

If CourtListener or Anthropic fails after the status changes to an in-progress state, the case can remain stuck without a final error state or recovery path.

Recommendation:

- Wrap ingest and analysis actions in top-level error handling.
- Always patch the case into `"error"` with a useful `statusMessage` on unrecoverable failure.

3. Medium: duplicate-case prevention is not user-scoped.

- `convex/cases.ts:45` queries by `(caseNumber, courtId)` only and uses `.first()`.
- It then only returns that existing record if it belongs to the current user.

Impact:

If another user’s record is returned first, the same user can still create a duplicate case for the same docket.

Recommendation:

- Add a user-scoped index such as `(userId, caseNumber, courtId)`.
- Use that index for duplicate prevention.

4. Medium: ingestion is append-only and will duplicate data on retries.

- Docket entries are inserted one by one in `convex/ingest.ts:77`.
- Judge opinions are inserted one by one in `convex/ingest.ts:181`.
- The create mutations in `convex/docketEntries.ts:24` and `convex/judgeOpinions.ts:14` do not dedupe or replace.

Impact:

Retrying ingestion can double-count docket entries and opinions, which then distorts analysis and UI rendering.

Recommendation:

- Replace existing entries/opinions for a case or judge before reinserting.
- Or enforce uniqueness by source ids.

5. Medium: the env contract and auth config do not match.

- `.env.example` says Google OAuth is optional.
- `convex/auth.ts:21` uses non-null assertions for Google credentials.

Impact:

This creates a runtime footgun if those values are omitted.

Recommendation:

- Only register Google as a provider when both values are present.

What Claude Did Better

1. Real auth integration is significantly better.

- Better Auth + Convex is wired through `src/routes/__root.tsx`, `src/lib/auth-server.ts`, `src/lib/auth-client.ts`, and `convex/auth.ts`.
- This is materially closer to a production path than a demo-viewer fallback.

2. The app is more focused.

- The implementation chooses a narrower and more concrete MVP slice.
- It avoids overbuilding setup fallbacks and mock-mode branches into every layer.

3. The user flow is more coherent.

- Landing -> sign in -> dashboard -> case page feels like one product.
- The product intent is clear throughout the routes.

4. The Anthropic integration is cleaner.

- `convex/lib/claude.ts` uses the official SDK directly.
- This is cleaner than lower-level manual request handling.

What Claude Did Worse

1. Security boundaries are weaker.

- This is the most serious problem in the repo.
- Related resources are not consistently protected the same way the parent case is.

2. Operational robustness is weaker.

- The happy path is implemented well enough.
- Failure modes, retries, and terminal error handling are not.

3. Data model rigor is weaker.

- Duplicate prevention is not properly user-scoped.
- Re-ingestion duplicates source data instead of replacing or deduping it.

4. Spec completeness is mixed.

- Email notification remains TODO in `convex/analyze.ts:139`.
- The judge profile tab in `src/routes/case/$caseId.tsx:166` mostly dumps JSON rather than rendering the richer structured UI described in the spec.

5. Test discipline is weaker.

- There is no test script coverage beyond build/typecheck.
- No automated tests validate auth, ingestion, or case ownership rules.

Overall Comparison

If the goal was:

- “Ship a narrow real MVP quickly with actual auth”
  then this repo is better.

- “Make it resilient, ownership-safe, and harder to break under real usage”
  then this repo is worse.

Blunt conclusion

Claude did better on product focus, auth realism, and keeping the implementation pointed at a real MVP instead of a demo shell.

Claude did worse on security consistency, retry/dedup correctness, and defensive handling of unhappy paths.

Recommended next fixes, in order

1. Enforce ownership checks in public docket and conversation queries.
2. Add top-level error handling that flips stuck cases to `error`.
3. Introduce a user-scoped duplicate-case index.
4. Replace-or-dedupe docket entries and judge opinions on re-ingest.
5. Make Google auth provider registration conditional.
6. Render judge profile data structurally instead of dumping JSON.
7. Add tests for case ownership, duplicate prevention, and retry behavior.
