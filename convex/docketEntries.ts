import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";

export const byCase = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    return ctx.db
      .query("docketEntries")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .collect();
  },
});

export const byCaseInternal = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    return ctx.db
      .query("docketEntries")
      .withIndex("by_case", (q) => q.eq("caseId", caseId))
      .collect();
  },
});

export const create = internalMutation({
  args: {
    caseId: v.id("cases"),
    entryNumber: v.optional(v.number()),
    dateFiled: v.optional(v.string()),
    description: v.string(),
    documentUrl: v.optional(v.string()),
    rawText: v.optional(v.string()),
    documentType: v.optional(v.string()),
    courtListenerEntryId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("docketEntries", args);
  },
});
