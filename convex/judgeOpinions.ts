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
