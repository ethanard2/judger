"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  courtListenerFetch,
  canUseCourtListener,
  type PaginatedResponse,
  type Docket,
  type Party,
} from "./lib/courtlistener";
import { buildMockCaseBundle } from "./lib/mock";
import { classifyDocumentType, truncate } from "./lib/utils";

// Ingests case metadata from CourtListener (or mock).
// Creates judge record if needed.
// Kicks off opinion discovery via opinionDownloader.
// Does NOT trigger any LLM analysis.
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
        // Mock pipeline
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
          judge = { _id: judgeId } as any;
        }

        await ctx.runMutation(internal.cases.updateDocketData, {
          id: caseId,
          judgeId: judge!._id,
        });

        // Insert mock opinions as refs (with text since they're small)
        for (const op of bundle.opinions) {
          await ctx.runMutation(internal.judgeOpinions.insertRef, {
            judgeId: judge!._id,
            courtListenerClusterId: op.courtListenerClusterId,
            caseName: op.caseName,
            dateFiled: op.dateFiled,
          });
        }

        await ctx.runMutation(internal.cases.updateStatus, {
          id: caseId,
          status: "ready",
          statusMessage: "Mock case loaded.",
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

      // Pull parties (may 403 on free tier)
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
        console.warn("Parties unavailable (may require paid tier):", err);
      }

      await ctx.runMutation(internal.cases.updateDocketData, {
        id: caseId,
        caseName: docket.case_name,
        dateFiled: docket.date_filed,
        courtListenerDocketId: docket.id,
        natureOfSuit: docket.nature_of_suit || undefined,
        parties: parties.length > 0 ? parties : undefined,
      });

      // Pull docket entries (may 403 on free tier)
      try {
        const entriesPage = await courtListenerFetch<any>(
          `/api/rest/v4/docket-entries/?docket=${docket.id}&order_by=entry_number`,
        );
        const entries = (entriesPage.results ?? []).map((entry: any) => ({
          entryNumber: entry.entry_number,
          dateFiled: entry.date_filed,
          description: entry.description,
          rawText: truncate(entry.recap_documents?.[0]?.plain_text || undefined, 4000),
          documentType: classifyDocumentType(entry.description),
          courtListenerEntryId: entry.id,
        }));
        if (entries.length > 0) {
          await ctx.runMutation(internal.docketEntries.replaceForCase, {
            caseId,
            entries,
          });
        }
      } catch (err) {
        console.warn("Docket entries unavailable:", err);
      }

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

      let judge = await ctx.runQuery(internal.judges.findByNameAndCourt, {
        name: judgeName,
        courtId: caseRecord.courtId,
      });

      if (!judge) {
        // Pull bio from People API
        let appointedBy: string | undefined;
        try {
          if (typeof docket.assigned_to === "string" && docket.assigned_to.startsWith("http")) {
            const person = await courtListenerFetch<any>(docket.assigned_to);
            const positions = person.positions ?? [];
            for (const posUrl of positions) {
              if (typeof posUrl === "string") {
                try {
                  const pos = await courtListenerFetch<any>(posUrl);
                  if (pos.appointer && pos.court?.id === caseRecord.courtId) {
                    const appointer = await courtListenerFetch<any>(pos.appointer);
                    appointedBy = appointer?.person?.name_first
                      ? `${appointer.person.name_first} ${appointer.person.name_last}`
                      : undefined;
                    break;
                  }
                } catch { /* skip */ }
              }
            }
          }
        } catch { /* skip */ }

        const judgeId = await ctx.runMutation(internal.judges.create, {
          name: judgeName,
          courtId: caseRecord.courtId,
          appointedBy,
          profileStatus: "pending",
        });
        judge = { _id: judgeId } as any;
      }

      await ctx.runMutation(internal.cases.updateDocketData, {
        id: caseId,
        judgeId: judge!._id,
      });

      // Discover opinions (metadata only, then text downloads happen separately)
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "ingesting_judge",
        statusMessage: `Found case. Discovering opinions for Judge ${judgeName}...`,
      });

      await ctx.scheduler.runAfter(0, internal.opinionDownloader.discoverOpinions, {
        judgeId: judge!._id,
        judgeName,
        courtId: caseRecord.courtId,
      });
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
