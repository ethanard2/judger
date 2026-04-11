import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";

// Returns metadata only (no text/html) for the opinion list nav
export const listByJudge = query({
  args: { judgeId: v.id("judges") },
  handler: async (ctx, { judgeId }) => {
    const all = await ctx.db
      .query("judgeOpinions")
      .withIndex("by_judge", (q) => q.eq("judgeId", judgeId))
      .collect();
    return all.map((op) => ({
      _id: op._id,
      caseName: op.caseName,
      dateFiled: op.dateFiled,
      hasText: Boolean(op.opinionText && op.opinionText.length > 100),
    }));
  },
});

// Returns a single opinion with HTML for display
export const getOpinion = query({
  args: { id: v.id("judgeOpinions") },
  handler: async (ctx, { id }) => {
    const op = await ctx.db.get(id);
    if (!op) return null;
    return {
      _id: op._id,
      caseName: op.caseName,
      dateFiled: op.dateFiled,
      opinionHtml: op.opinionHtml,
      opinionText: op.opinionText,
    };
  },
});

export const byJudgeInternal = internalQuery({
  args: { judgeId: v.id("judges") },
  handler: async (ctx, { judgeId }) => {
    return ctx.db
      .query("judgeOpinions")
      .withIndex("by_judge", (q) => q.eq("judgeId", judgeId))
      .collect();
  },
});

// Find opinions for a judge that don't have text yet
export const pendingDownloads = internalQuery({
  args: { judgeId: v.id("judges") },
  handler: async (ctx, { judgeId }) => {
    const all = await ctx.db
      .query("judgeOpinions")
      .withIndex("by_judge", (q) => q.eq("judgeId", judgeId))
      .collect();
    return all.filter((op) => !op.opinionText);
  },
});

// Find opinions that have text but no HTML (need backfill)
export const missingHtml = internalQuery({
  args: { judgeId: v.id("judges") },
  handler: async (ctx, { judgeId }) => {
    const all = await ctx.db
      .query("judgeOpinions")
      .withIndex("by_judge", (q) => q.eq("judgeId", judgeId))
      .collect();
    return all.filter((op) => op.opinionText && !op.opinionHtml);
  },
});

// Write HTML only (for backfill)
export const writeHtml = internalMutation({
  args: {
    id: v.id("judgeOpinions"),
    opinionHtml: v.string(),
  },
  handler: async (ctx, { id, opinionHtml }) => {
    await ctx.db.patch(id, { opinionHtml });
  },
});

// Insert a ref (metadata only, no text yet). Skips if cluster ID already exists.
export const insertRef = internalMutation({
  args: {
    judgeId: v.id("judges"),
    courtListenerClusterId: v.number(),
    courtListenerOpinionId: v.optional(v.number()),
    caseName: v.optional(v.string()),
    dateFiled: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("judgeOpinions")
      .withIndex("by_cluster", (q) =>
        q.eq("courtListenerClusterId", args.courtListenerClusterId),
      )
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("judgeOpinions", args);
  },
});

// Write downloaded text + HTML to an existing opinion row
export const writeText = internalMutation({
  args: {
    id: v.id("judgeOpinions"),
    opinionText: v.string(),
    opinionHtml: v.optional(v.string()),
  },
  handler: async (ctx, { id, opinionText, opinionHtml }) => {
    await ctx.db.patch(id, { opinionText, opinionHtml });
  },
});
