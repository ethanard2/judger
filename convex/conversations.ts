import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";

export const byCase = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    return ctx.db
      .query("conversations")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .first();
  },
});

export const byCaseInternal = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    return ctx.db
      .query("conversations")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .first();
  },
});

export const appendMessages = internalMutation({
  args: {
    caseId: v.id("cases"),
    userId: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
      }),
    ),
  },
  handler: async (ctx, { caseId, userId, messages }) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        messages: [...existing.messages, ...messages],
      });
    } else {
      await ctx.db.insert("conversations", {
        caseId,
        userId,
        messages,
      });
    }
  },
});
