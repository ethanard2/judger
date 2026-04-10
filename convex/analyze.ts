"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { callClaude, canUseClaude, chunkArray } from "./lib/claude";
import {
  JUDGE_PROFILE_EXTRACTION_PROMPT,
  CASE_STRATEGIC_ANALYSIS_PROMPT,
} from "./lib/prompts";
import {
  buildHeuristicJudgeProfile,
  buildFallbackCaseAnalysis,
} from "./lib/mock";
import { extractJsonPayload, safeJsonParse } from "./lib/utils";

export const analyzeJudge = internalAction({
  args: { judgeId: v.id("judges"), caseId: v.id("cases") },
  handler: async (ctx, { judgeId, caseId }) => {
    try {
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "analyzing_judge",
        statusMessage: "Analyzing judge's ruling patterns...",
      });

      const opinions = await ctx.runQuery(internal.judgeOpinions.byJudge, {
        judgeId,
      });
      const judge = await ctx.runQuery(internal.judges.getInternal, {
        id: judgeId,
      });
      const caseRecord = await ctx.runQuery(internal.cases.getInternal, {
        id: caseId,
      });

      let profile: unknown = null;

      if (canUseClaude() && opinions.length > 0) {
        try {
          const batches = chunkArray(opinions, 6);
          const batchResults: unknown[] = [];

          for (const batch of batches) {
            const opinionTexts = batch
              .map(
                (op, i) =>
                  `--- OPINION ${i + 1}: ${op.caseName ?? "Unknown"} (${op.dateFiled ?? "Unknown date"}) ---\n${op.opinionText}`,
              )
              .join("\n\n");

            const result = await callClaude({
              system: JUDGE_PROFILE_EXTRACTION_PROMPT,
              messages: [{ role: "user", content: opinionTexts }],
              maxTokens: 4096,
            });

            batchResults.push(
              safeJsonParse(extractJsonPayload(result), { opinions: [] }),
            );
          }

          if (batchResults.length === 1) {
            profile = batchResults[0];
          } else {
            const merged = await callClaude({
              system:
                "Merge these partial judge profile extractions into a single comprehensive profile. Combine statistics, deduplicate precedents. Return as JSON.",
              messages: [
                {
                  role: "user",
                  content: JSON.stringify(batchResults),
                },
              ],
              maxTokens: 8192,
            });
            profile = safeJsonParse(extractJsonPayload(merged), null);
          }
        } catch (err) {
          console.warn("Claude judge analysis failed, using heuristic:", err);
          profile = null;
        }
      }

      // Fallback to heuristic profile if Claude unavailable or failed
      if (!profile) {
        profile = buildHeuristicJudgeProfile({
          judgeName: judge?.name ?? "Unknown Judge",
          courtName: caseRecord?.courtName,
          opinions,
          bio: judge
            ? {
                appointedBy: judge.appointedBy,
                birthYear: judge.birthYear,
                activeStatus: judge.activeStatus,
              }
            : null,
        });
      }

      await ctx.runMutation(internal.judges.updateProfile, {
        judgeId,
        profile: JSON.stringify(profile, null, 2),
        opinionCount: opinions.length,
        lastAnalyzedAt: Date.now(),
        profileStatus: "ready",
      });

      await ctx.scheduler.runAfter(0, internal.analyze.analyzeCase, { caseId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Judge analysis failed";
      console.error(`analyzeJudge failed for ${judgeId}:`, error);
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "error",
        statusMessage: message,
      });
    }
  },
});

export const analyzeCase = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    try {
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "analyzing_case",
        statusMessage: "Building strategic analysis...",
      });

      const context = await ctx.runQuery(internal.cases.getAnalysisContext, {
        id: caseId,
      });
      if (!context) throw new Error(`Case ${caseId} not found`);

      const { case: caseRecord, judge, docketEntries } = context;

      let analysis = "";

      if (canUseClaude() && judge?.profile) {
        try {
          const docketSummary = docketEntries
            .map(
              (e: any) =>
                `[${e.dateFiled ?? "?"}] #${e.entryNumber ?? "?"}: ${e.description}${e.rawText ? "\n" + e.rawText.slice(0, 2000) : ""}`,
            )
            .join("\n");

          analysis = await callClaude({
            system: CASE_STRATEGIC_ANALYSIS_PROMPT,
            messages: [
              {
                role: "user",
                content: `## Judge Profile\n${judge.profile}\n\n## Case: ${caseRecord.caseName ?? caseRecord.caseNumber}\n## Parties\n${JSON.stringify(caseRecord.parties ?? [])}\n\n## Docket\n${docketSummary}`,
              },
            ],
            maxTokens: 8192,
          });
        } catch (err) {
          console.warn("Claude case analysis failed, using fallback:", err);
          analysis = "";
        }
      }

      if (!analysis) {
        analysis = buildFallbackCaseAnalysis({
          caseName: caseRecord.caseName,
          caseNumber: caseRecord.caseNumber,
          courtName: caseRecord.courtName,
          judgeProfileJson: judge?.profile,
          docketEntries,
        });
      }

      await ctx.runMutation(internal.cases.updateAnalysis, {
        id: caseId,
        caseAnalysis: analysis,
      });

      // Send email notification via Resend
      try {
        const { Resend } = await import("resend");
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey) {
          const resend = new Resend(apiKey);
          // Note: we don't have direct user email access here without a user table.
          // For production, add email to the case record or query auth identity.
          console.log(
            `Case ${caseId} ready. Email notification would be sent here.`,
          );
        }
      } catch {
        // Resend not configured — skip silently
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Case analysis failed";
      console.error(`analyzeCase failed for ${caseId}:`, error);
      await ctx.runMutation(internal.cases.updateStatus, {
        id: caseId,
        status: "error",
        statusMessage: message,
      });
    }
  },
});
