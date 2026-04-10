"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  courtListenerFetch,
  stripHtml,
  type PaginatedResponse,
  type Docket,
  type DocketEntry,
  type Party,
} from "./lib/courtlistener";

export const ingestCase = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const caseRecord = await ctx.runQuery(internal.cases.getInternal, {
      id: caseId,
    });
    if (!caseRecord) throw new Error(`Case ${caseId} not found`);

    // 1. Search CourtListener for docket
    await ctx.runMutation(internal.cases.updateStatus, {
      id: caseId,
      status: "ingesting_docket",
      statusMessage: "Searching for case on CourtListener...",
    });

    const docketResults = await courtListenerFetch<PaginatedResponse<Docket>>(
      `/api/rest/v4/dockets/?docket_number=${encodeURIComponent(caseRecord.caseNumber)}&court=${caseRecord.courtId}`,
    );

    if (!docketResults.count) {
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "error",
        statusMessage: `Case "${caseRecord.caseNumber}" not found on CourtListener for court ${caseRecord.courtId}`,
      });
      return;
    }

    const docket = docketResults.results[0];

    // 2. Pull parties
    let parties: Array<{
      name: string;
      role: string;
      attorneys: Array<{ name: string; firm?: string }>;
    }> = [];
    try {
      const partyResults = await courtListenerFetch<
        PaginatedResponse<Party>
      >(`/api/rest/v4/parties/?docket=${docket.id}`);
      parties = partyResults.results.map((p) => ({
        name: p.name,
        role: p.party_type?.name ?? "unknown",
        attorneys: (p.attorneys ?? []).map((a) => ({
          name: a.name,
          firm: a.firms?.[0]?.name,
        })),
      }));
    } catch (err) {
      console.warn("Failed to fetch parties:", err);
    }

    // 3. Store docket metadata
    await ctx.runMutation(internal.cases.updateDocketData, {
      id: caseId,
      caseName: docket.case_name,
      dateFiled: docket.date_filed,
      courtListenerDocketId: docket.id,
      natureOfSuit: docket.nature_of_suit || undefined,
      parties: parties.length > 0 ? parties : undefined,
    });

    // 4. Pull docket entries (paginate, cap at 500)
    let entriesUrl: string | null =
      `/api/rest/v4/docket-entries/?docket=${docket.id}&order_by=entry_number`;
    let entryCount = 0;
    while (entriesUrl && entryCount < 500) {
      const entriesPage: PaginatedResponse<DocketEntry> =
        await courtListenerFetch(entriesUrl);
      for (const entry of entriesPage.results) {
        const rawText =
          entry.recap_documents?.[0]?.plain_text || undefined;
        await ctx.runMutation(internal.docketEntries.create, {
          caseId,
          entryNumber: entry.entry_number,
          dateFiled: entry.date_filed,
          description: entry.description,
          rawText,
          courtListenerEntryId: entry.id,
        });
        entryCount++;
      }
      entriesUrl = entriesPage.next;
    }

    // 5. Find or create judge
    const judgeName = docket.assigned_to_str;
    if (!judgeName) {
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "error",
        statusMessage:
          "No judge assigned to this case on CourtListener",
      });
      return;
    }

    await ctx.runMutation(internal.cases.updateStatus, {
      id: caseId,
      status: "ingesting_judge",
      statusMessage: `Found case. Pulling opinions for Judge ${judgeName}...`,
    });

    let judge = await ctx.runQuery(internal.judges.findByNameAndCourt, {
      name: judgeName,
      courtId: caseRecord.courtId,
    });

    if (!judge) {
      const judgeId = await ctx.runMutation(internal.judges.create, {
        name: judgeName,
        courtId: caseRecord.courtId,
        profileStatus: "pending",
      });
      judge = {
        _id: judgeId,
        _creationTime: Date.now(),
        name: judgeName,
        courtId: caseRecord.courtId,
        profileStatus: "pending" as const,
      };
    }

    await ctx.runMutation(internal.cases.updateDocketData, {
      id: caseId,
      judgeId: judge._id,
    });

    // 6. If judge profile not yet built, pull opinions then analyze
    if (judge.profileStatus !== "ready") {
      await ctx.scheduler.runAfter(0, internal.ingest.ingestJudgeOpinions, {
        judgeId: judge._id,
        judgeName,
        courtId: caseRecord.courtId,
        caseId,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.analyze.analyzeCase, {
        caseId,
      });
    }
  },
});

export const ingestJudgeOpinions = internalAction({
  args: {
    judgeId: v.id("judges"),
    judgeName: v.string(),
    courtId: v.string(),
    caseId: v.id("cases"),
  },
  handler: async (ctx, { judgeId, judgeName, courtId, caseId }) => {
    await ctx.runMutation(internal.judges.updateProfile, {
      judgeId,
      profile: "",
      opinionCount: 0,
      lastAnalyzedAt: Date.now(),
      profileStatus: "processing",
    });

    let searchUrl: string | null =
      `/api/rest/v4/search/?type=o&judge=${encodeURIComponent(judgeName)}&court=${courtId}&order_by=-dateFiled`;

    let count = 0;
    const MAX_OPINIONS = 75;

    while (searchUrl && count < MAX_OPINIONS) {
      const page: any = await courtListenerFetch(searchUrl);
      const results = page.results ?? [];

      for (const result of results) {
        if (count >= MAX_OPINIONS) break;

        try {
          const fullOpinion = await courtListenerFetch<any>(
            `/api/rest/v4/opinions/${result.id}/`,
          );

          const text =
            fullOpinion.plain_text ||
            (fullOpinion.html ? stripHtml(fullOpinion.html) : null);

          if (text && text.length > 100) {
            await ctx.runMutation(internal.judgeOpinions.create, {
              judgeId,
              courtListenerClusterId: result.cluster_id ?? result.id,
              caseName: result.caseName ?? result.case_name ?? undefined,
              dateFiled: result.dateFiled ?? result.date_filed ?? undefined,
              opinionText: text.slice(0, 50000), // cap per opinion
            });
            count++;
          }
        } catch (err) {
          console.warn(`Failed to fetch opinion ${result.id}:`, err);
        }
      }

      searchUrl = page.next ?? null;
    }

    // Kick off judge analysis
    await ctx.scheduler.runAfter(0, internal.analyze.analyzeJudge, {
      judgeId,
      caseId,
    });
  },
});
