"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  courtListenerFetch,
  stripHtml,
  canUseCourtListener,
  type PaginatedResponse,
  type Docket,
  type DocketEntry,
  type Party,
} from "./lib/courtlistener";
import { buildMockCaseBundle } from "./lib/mock";
import { classifyDocumentType, truncate } from "./lib/utils";

export const ingestCase = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    try {
      const caseRecord = await ctx.runQuery(internal.cases.getInternal, {
        id: caseId,
      });
      if (!caseRecord) throw new Error(`Case ${caseId} not found`);

      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "ingesting_docket",
        statusMessage: "Searching for case...",
      });

      if (!canUseCourtListener()) {
        // Mock pipeline — run without CourtListener API key
        const bundle = buildMockCaseBundle({
          caseNumber: caseRecord.caseNumber,
          courtId: caseRecord.courtId,
          courtName: caseRecord.courtName,
        });

        await ctx.runMutation(internal.cases.updateDocketData, {
          id: caseId,
          caseName: bundle.caseName,
          dateFiled: bundle.dateFiled,
          courtListenerDocketId: bundle.courtListenerDocketId,
          natureOfSuit: bundle.natureOfSuit,
          parties: bundle.parties,
        });

        await ctx.runMutation(internal.docketEntries.replaceForCase, {
          caseId,
          entries: bundle.docketEntries,
        });

        // Create judge
        let judge = await ctx.runQuery(internal.judges.findByNameAndCourt, {
          name: bundle.judgeName,
          courtId: caseRecord.courtId,
        });
        if (!judge) {
          const judgeId = await ctx.runMutation(internal.judges.create, {
            name: bundle.judgeName,
            courtId: caseRecord.courtId,
            appointedBy: bundle.judgeBio.appointedBy,
            profileStatus: "pending",
          });
          judge = { _id: judgeId, profileStatus: "pending" as const } as any;
        }

        await ctx.runMutation(internal.cases.updateDocketData, {
          id: caseId,
          judgeId: judge!._id,
        });

        // Store mock opinions
        await ctx.runMutation(internal.judgeOpinions.replaceForJudge, {
          judgeId: judge!._id,
          opinions: bundle.opinions,
        });

        await ctx.scheduler.runAfter(0, internal.analyze.analyzeJudge, {
          judgeId: judge!._id,
          caseId,
        });
        return;
      }

      // Real CourtListener pipeline
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

      // Pull parties
      let parties: Array<{
        name: string;
        role: string;
        attorneys: Array<{ name: string; firm?: string }>;
      }> = [];
      try {
        const partyResults = await courtListenerFetch<PaginatedResponse<Party>>(
          `/api/rest/v4/parties/?docket=${docket.id}`,
        );
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

      await ctx.runMutation(internal.cases.updateDocketData, {
        id: caseId,
        caseName: docket.case_name,
        dateFiled: docket.date_filed,
        courtListenerDocketId: docket.id,
        natureOfSuit: docket.nature_of_suit || undefined,
        parties: parties.length > 0 ? parties : undefined,
      });

      // Pull docket entries with dedup via replace
      let entriesUrl: string | null =
        `/api/rest/v4/docket-entries/?docket=${docket.id}&order_by=entry_number`;
      const allEntries: Array<{
        entryNumber?: number;
        dateFiled?: string;
        description: string;
        rawText?: string;
        documentType?: string;
        courtListenerEntryId?: number;
      }> = [];

      while (entriesUrl && allEntries.length < 500) {
        const entriesPage: PaginatedResponse<DocketEntry> =
          await courtListenerFetch(entriesUrl);
        for (const entry of entriesPage.results) {
          allEntries.push({
            entryNumber: entry.entry_number,
            dateFiled: entry.date_filed,
            description: entry.description,
            rawText: truncate(
              entry.recap_documents?.[0]?.plain_text || undefined,
              4000,
            ),
            documentType: classifyDocumentType(entry.description),
            courtListenerEntryId: entry.id,
          });
        }
        entriesUrl = entriesPage.next;
      }

      await ctx.runMutation(internal.docketEntries.replaceForCase, {
        caseId,
        entries: allEntries,
      });

      // Find or create judge
      const judgeName = docket.assigned_to_str;
      if (!judgeName) {
        await ctx.runMutation(internal.cases.updateStatus, {
          id: caseId,
          status: "error",
          statusMessage: "No judge assigned to this case on CourtListener",
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

      if (judge.profileStatus === "ready") {
        await ctx.scheduler.runAfter(0, internal.analyze.analyzeCase, { caseId });
      } else {
        await ctx.scheduler.runAfter(0, internal.ingest.ingestJudgeOpinions, {
          judgeId: judge._id,
          judgeName,
          courtId: caseRecord.courtId,
          caseId,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected ingestion error";
      console.error(`ingestCase failed for ${caseId}:`, error);
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "error",
        statusMessage: message,
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
    try {
      await ctx.runMutation(internal.judges.updateProfile, {
        judgeId,
        profile: "",
        opinionCount: 0,
        lastAnalyzedAt: Date.now(),
        profileStatus: "processing",
      });

      let searchUrl: string | null =
        `/api/rest/v4/search/?type=o&judge=${encodeURIComponent(judgeName)}&court=${courtId}&order_by=-dateFiled`;

      const opinions: Array<{
        courtListenerClusterId: number;
        caseName?: string;
        dateFiled?: string;
        caseType?: string;
        opinionText: string;
      }> = [];
      const MAX_OPINIONS = 75;

      while (searchUrl && opinions.length < MAX_OPINIONS) {
        const page: any = await courtListenerFetch(searchUrl);
        const results = page.results ?? [];

        for (const result of results) {
          if (opinions.length >= MAX_OPINIONS) break;
          try {
            const fullOpinion = await courtListenerFetch<any>(
              `/api/rest/v4/opinions/${result.id}/`,
            );
            const text =
              fullOpinion.plain_text ||
              (fullOpinion.html ? stripHtml(fullOpinion.html) : null);

            if (text && text.length > 100) {
              opinions.push({
                courtListenerClusterId: result.cluster_id ?? result.id,
                caseName: result.caseName ?? result.case_name ?? undefined,
                dateFiled: result.dateFiled ?? result.date_filed ?? undefined,
                opinionText: text.slice(0, 50000),
              });
            }
          } catch (err) {
            console.warn(`Failed to fetch opinion ${result.id}:`, err);
          }
        }
        searchUrl = page.next ?? null;
      }

      // Replace (dedup) opinions for this judge
      await ctx.runMutation(internal.judgeOpinions.replaceForJudge, {
        judgeId,
        opinions,
      });

      await ctx.scheduler.runAfter(0, internal.analyze.analyzeJudge, {
        judgeId,
        caseId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch judge opinions";
      console.error(`ingestJudgeOpinions failed for ${judgeId}:`, error);
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "error",
        statusMessage: message,
      });
    }
  },
});
