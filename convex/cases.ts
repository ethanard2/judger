import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";

const DEFAULT_USER = "default";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("cases")
      .withIndex("by_user", (q) => q.eq("userId", DEFAULT_USER))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("cases") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    caseNumber: v.string(),
    courtId: v.string(),
    courtName: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedCaseNumber = args.caseNumber.trim();

    const existing = await ctx.db
      .query("cases")
      .withIndex("by_user_case", (q) =>
        q
          .eq("userId", DEFAULT_USER)
          .eq("caseNumber", normalizedCaseNumber)
          .eq("courtId", args.courtId),
      )
      .first();

    if (existing) {
      if (existing.status === "error") {
        await ctx.db.patch(existing._id, {
          status: "pending",
          statusMessage: "Retrying analysis...",
        });
        await ctx.scheduler.runAfter(0, internal.ingest.ingestCase, {
          caseId: existing._id,
        });
      }
      return existing._id;
    }

    const caseId = await ctx.db.insert("cases", {
      userId: DEFAULT_USER,
      caseNumber: normalizedCaseNumber,
      courtId: args.courtId,
      courtName: args.courtName,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.ingest.ingestCase, { caseId });

    return caseId;
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("cases") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const updateStatus = internalMutation({
  args: {
    id: v.id("cases"),
    status: v.string(),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, statusMessage }) => {
    await ctx.db.patch(id, {
      status: status as any,
      statusMessage,
    });
  },
});

export const updateDocketData = internalMutation({
  args: {
    id: v.id("cases"),
    caseName: v.optional(v.string()),
    dateFiled: v.optional(v.string()),
    courtListenerDocketId: v.optional(v.number()),
    caseType: v.optional(v.string()),
    natureOfSuit: v.optional(v.string()),
    parties: v.optional(
      v.array(
        v.object({
          name: v.string(),
          role: v.string(),
          attorneys: v.array(
            v.object({
              name: v.string(),
              firm: v.optional(v.string()),
            }),
          ),
        }),
      ),
    ),
    judgeId: v.optional(v.id("judges")),
  },
  handler: async (ctx, { id, ...data }) => {
    await ctx.db.patch(id, data);
  },
});

export const getAnalysisContext = internalQuery({
  args: { id: v.id("cases") },
  handler: async (ctx, { id }) => {
    const caseRecord = await ctx.db.get(id);
    if (!caseRecord) return null;
    const judge = caseRecord.judgeId
      ? await ctx.db.get(caseRecord.judgeId)
      : null;
    const docketEntries = await ctx.db
      .query("docketEntries")
      .withIndex("by_case", (q) => q.eq("caseId", id))
      .collect();
    return { case: caseRecord, judge, docketEntries };
  },
});

export const getDetail = query({
  args: { id: v.id("cases") },
  handler: async (ctx, { id }) => {
    const caseRecord = await ctx.db.get(id);
    if (!caseRecord) return null;
    const judge = caseRecord.judgeId
      ? await ctx.db.get(caseRecord.judgeId)
      : null;
    const docketEntries = await ctx.db
      .query("docketEntries")
      .withIndex("by_case", (q) => q.eq("caseId", id))
      .collect();
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_case", (q) => q.eq("caseId", id))
      .first();
    return { case: caseRecord, judge, docketEntries, conversation };
  },
});

export const refreshJudgeProfile = mutation({
  args: { id: v.id("cases") },
  handler: async (ctx, { id }) => {
    const caseRecord = await ctx.db.get(id);
    if (!caseRecord) throw new Error("Case not found");
    if (!caseRecord.judgeId) throw new Error("No judge assigned");

    // Reset judge profile
    await ctx.db.patch(caseRecord.judgeId, {
      profileStatus: "pending",
      profile: undefined,
      opinionCount: undefined,
      lastAnalyzedAt: undefined,
    });

    // Reset case to re-analyze
    await ctx.db.patch(id, {
      status: "pending",
      statusMessage: "Refreshing judge profile...",
      caseAnalysis: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.ingest.ingestCase, { caseId: id });
  },
});

export const updateAnalysis = internalMutation({
  args: {
    id: v.id("cases"),
    caseAnalysis: v.string(),
  },
  handler: async (ctx, { id, caseAnalysis }) => {
    await ctx.db.patch(id, {
      caseAnalysis,
      status: "ready",
      lastSyncedAt: Date.now(),
    });
  },
});
