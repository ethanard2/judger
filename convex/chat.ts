"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { callClaude } from "./lib/claude";
import { CHAT_SYSTEM_PROMPT } from "./lib/prompts";

export const sendMessage = action({
  args: {
    caseId: v.id("cases"),
    message: v.string(),
  },
  handler: async (ctx, { caseId, message }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const caseRecord = await ctx.runQuery(internal.cases.getInternal, {
      id: caseId,
    });
    if (!caseRecord) throw new Error("Case not found");
    if (caseRecord.userId !== identity.subject) throw new Error("Unauthorized");
    if (caseRecord.status !== "ready") {
      throw new Error("Case analysis is not ready yet");
    }

    let judgeProfile = "No judge profile available.";
    if (caseRecord.judgeId) {
      const judge = await ctx.runQuery(internal.judges.getInternal, {
        id: caseRecord.judgeId,
      });
      if (judge?.profile) judgeProfile = judge.profile;
    }

    const entries = await ctx.runQuery(internal.docketEntries.byCaseInternal, {
      caseId,
    });
    const docketSummary = entries
      .map((e) => `[${e.dateFiled ?? "?"}] ${e.description}`)
      .join("\n");

    const systemPrompt =
      CHAT_SYSTEM_PROMPT +
      `\n\n## JUDGE PROFILE\n${judgeProfile}` +
      `\n\n## CASE ANALYSIS\n${caseRecord.caseAnalysis ?? "Not yet available."}` +
      `\n\n## DOCKET SUMMARY\n${docketSummary}`;

    // Get conversation history
    const conversation = await ctx.runQuery(
      internal.conversations.byCaseInternal,
      { caseId },
    );
    const history = (conversation?.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history,
      { role: "user", content: message },
    ];

    const response = await callClaude({
      system: systemPrompt,
      messages,
      maxTokens: 4096,
    });

    await ctx.runMutation(internal.conversations.appendMessages, {
      caseId,
      userId: identity.subject,
      messages: [
        { role: "user", content: message, timestamp: Date.now() },
        { role: "assistant", content: response, timestamp: Date.now() },
      ],
    });

    return response;
  },
});
