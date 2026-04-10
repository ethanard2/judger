import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";

export const get = query({
  args: { id: v.id("judges") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("judges") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const findByNameAndCourt = internalQuery({
  args: { name: v.string(), courtId: v.string() },
  handler: async (ctx, { name, courtId }) => {
    const judges = await ctx.db
      .query("judges")
      .withIndex("by_court", (q) => q.eq("courtId", courtId))
      .collect();
    return judges.find(
      (j) => j.name.toLowerCase() === name.toLowerCase(),
    ) ?? null;
  },
});

export const create = internalMutation({
  args: {
    name: v.string(),
    courtId: v.string(),
    courtListenerPersonId: v.optional(v.number()),
    appointedBy: v.optional(v.string()),
    profileStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error"),
    ),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("judges", args);
  },
});

export const updateProfile = internalMutation({
  args: {
    judgeId: v.id("judges"),
    profile: v.string(),
    opinionCount: v.number(),
    lastAnalyzedAt: v.number(),
    profileStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error"),
    ),
  },
  handler: async (ctx, { judgeId, ...data }) => {
    await ctx.db.patch(judgeId, data);
  },
});
