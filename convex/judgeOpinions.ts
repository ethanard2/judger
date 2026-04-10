import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

export const byJudge = internalQuery({
  args: { judgeId: v.id("judges") },
  handler: async (ctx, { judgeId }) => {
    return ctx.db
      .query("judgeOpinions")
      .withIndex("by_judge", (q) => q.eq("judgeId", judgeId))
      .collect();
  },
});

export const replaceForJudge = internalMutation({
  args: {
    judgeId: v.id("judges"),
    opinions: v.array(
      v.object({
        courtListenerClusterId: v.number(),
        caseName: v.optional(v.string()),
        dateFiled: v.optional(v.string()),
        caseType: v.optional(v.string()),
        opinionText: v.string(),
      }),
    ),
  },
  handler: async (ctx, { judgeId, opinions }) => {
    const existing = await ctx.db
      .query("judgeOpinions")
      .withIndex("by_judge", (q) => q.eq("judgeId", judgeId))
      .collect();
    for (const op of existing) {
      await ctx.db.delete(op._id);
    }
    for (const op of opinions) {
      await ctx.db.insert("judgeOpinions", { judgeId, ...op });
    }
  },
});

export const create = internalMutation({
  args: {
    judgeId: v.id("judges"),
    courtListenerClusterId: v.number(),
    caseName: v.optional(v.string()),
    dateFiled: v.optional(v.string()),
    caseType: v.optional(v.string()),
    opinionText: v.string(),
    extractedData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("judgeOpinions", args);
  },
});
