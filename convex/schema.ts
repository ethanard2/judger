import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  cases: defineTable({
    userId: v.string(),
    caseNumber: v.string(),
    courtId: v.string(),
    courtName: v.string(),
    judgeId: v.optional(v.id("judges")),

    caseName: v.optional(v.string()),
    dateFiled: v.optional(v.string()),
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

    caseAnalysis: v.optional(v.string()),

    status: v.union(
      v.literal("pending"),
      v.literal("ingesting_docket"),
      v.literal("ingesting_judge"),
      v.literal("analyzing_judge"),
      v.literal("analyzing_case"),
      v.literal("ready"),
      v.literal("error"),
    ),
    statusMessage: v.optional(v.string()),
    courtListenerDocketId: v.optional(v.number()),

    createdAt: v.number(),
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_case_number", ["caseNumber", "courtId"])
    .index("by_user_case", ["userId", "caseNumber", "courtId"]),

  judges: defineTable({
    name: v.string(),
    courtId: v.string(),
    courtListenerPersonId: v.optional(v.number()),

    appointedBy: v.optional(v.string()),
    birthYear: v.optional(v.number()),
    activeStatus: v.optional(v.string()),

    profile: v.optional(v.string()),

    opinionCount: v.optional(v.number()),
    lastAnalyzedAt: v.optional(v.number()),
    profileStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error"),
    ),
  })
    .index("by_court", ["courtId"])
    .index("by_courtlistener_id", ["courtListenerPersonId"]),

  docketEntries: defineTable({
    caseId: v.id("cases"),
    entryNumber: v.optional(v.number()),
    dateFiled: v.optional(v.string()),
    description: v.string(),
    documentUrl: v.optional(v.string()),
    rawText: v.optional(v.string()),
    documentType: v.optional(v.string()),
    courtListenerEntryId: v.optional(v.number()),
  }).index("by_case", ["caseId"]),

  judgeOpinions: defineTable({
    judgeId: v.id("judges"),
    courtListenerClusterId: v.number(),
    courtListenerOpinionId: v.optional(v.number()),
    caseName: v.optional(v.string()),
    dateFiled: v.optional(v.string()),
    caseType: v.optional(v.string()),
    opinionText: v.optional(v.string()),    // stripped text (for LLM)
    opinionHtml: v.optional(v.string()),   // original HTML (for display)
    extractedData: v.optional(v.string()),
  })
    .index("by_judge", ["judgeId"])
    .index("by_cluster", ["courtListenerClusterId"]),

  conversations: defineTable({
    caseId: v.id("cases"),
    userId: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
      }),
    ),
  }).index("by_case", ["caseId"]),
});
