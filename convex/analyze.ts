"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { callClaude, chunkArray } from "./lib/claude";
import {
  JUDGE_PROFILE_EXTRACTION_PROMPT,
  CASE_STRATEGIC_ANALYSIS_PROMPT,
} from "./lib/prompts";

export const analyzeJudge = internalAction({
  args: { judgeId: v.id("judges"), caseId: v.id("cases") },
  handler: async (ctx, { judgeId, caseId }) => {
    await ctx.runMutation(internal.cases.updateStatus, {
      id: caseId,
      status: "analyzing_judge",
      statusMessage: "Analyzing judge's ruling patterns...",
    });

    const opinions = await ctx.runQuery(internal.judgeOpinions.byJudge, {
      judgeId,
    });

    if (opinions.length === 0) {
      // No opinions found — still mark judge as ready with empty profile
      await ctx.runMutation(internal.judges.updateProfile, {
        judgeId,
        profile: JSON.stringify({
          note: "No opinions found on CourtListener for this judge.",
        }),
        opinionCount: 0,
        lastAnalyzedAt: Date.now(),
        profileStatus: "ready",
      });
      await ctx.scheduler.runAfter(0, internal.analyze.analyzeCase, {
        caseId,
      });
      return;
    }

    // Chunk opinions into batches of 6
    const batches = chunkArray(opinions, 6);
    const batchResults: string[] = [];

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

      batchResults.push(result);
    }

    // Merge batch results into a single profile
    const mergedProfile = await callClaude({
      system:
        "Merge these partial judge profile extractions into a single comprehensive profile. Combine statistics, deduplicate precedents, and produce a unified behavioral profile. Return as JSON.",
      messages: [
        {
          role: "user",
          content: `Here are ${batchResults.length} partial extractions to merge:\n\n${batchResults.map((r, i) => `--- Batch ${i + 1} ---\n${r}`).join("\n\n")}`,
        },
      ],
      maxTokens: 8192,
    });

    await ctx.runMutation(internal.judges.updateProfile, {
      judgeId,
      profile: mergedProfile,
      opinionCount: opinions.length,
      lastAnalyzedAt: Date.now(),
      profileStatus: "ready",
    });

    await ctx.scheduler.runAfter(0, internal.analyze.analyzeCase, { caseId });
  },
});

export const analyzeCase = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    await ctx.runMutation(internal.cases.updateStatus, {
      id: caseId,
      status: "analyzing_case",
      statusMessage: "Building strategic analysis...",
    });

    const caseRecord = await ctx.runQuery(internal.cases.getInternal, {
      id: caseId,
    });
    if (!caseRecord) throw new Error(`Case ${caseId} not found`);

    let judgeProfile = "No judge profile available.";
    if (caseRecord.judgeId) {
      const judge = await ctx.runQuery(internal.judges.getInternal, {
        id: caseRecord.judgeId,
      });
      if (judge?.profile) {
        judgeProfile = judge.profile;
      }
    }

    const entries = await ctx.runQuery(internal.docketEntries.byCaseInternal, {
      caseId,
    });

    const docketSummary = entries
      .map(
        (e) =>
          `[${e.dateFiled ?? "?"}] #${e.entryNumber ?? "?"}: ${e.description}${e.rawText ? "\n" + e.rawText.slice(0, 2000) : ""}`,
      )
      .join("\n");

    const analysis = await callClaude({
      system: CASE_STRATEGIC_ANALYSIS_PROMPT,
      messages: [
        {
          role: "user",
          content: `## Judge Profile\n${judgeProfile}\n\n## Case: ${caseRecord.caseName ?? caseRecord.caseNumber}\n## Parties\n${JSON.stringify(caseRecord.parties ?? [])}\n\n## Docket\n${docketSummary}`,
        },
      ],
      maxTokens: 8192,
    });

    await ctx.runMutation(internal.cases.updateAnalysis, {
      id: caseId,
      caseAnalysis: analysis,
    });

    // TODO: Send email notification via Resend
  },
});
