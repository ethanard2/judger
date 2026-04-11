"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { courtListenerFetch, stripHtml } from "./lib/courtlistener";

// Step 1: Search CourtListener and create opinion refs (metadata only).
// Paginates through all results. No text download here.
export const discoverOpinions = internalAction({
  args: {
    judgeId: v.id("judges"),
    judgeName: v.string(),
    courtId: v.string(),
    searchUrl: v.optional(v.string()),
    totalFound: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { judgeId, judgeName, courtId } = args;
    const found = args.totalFound ?? 0;
    const MAX = 75;

    const url =
      args.searchUrl ??
      `/api/rest/v4/search/?type=o&q=${encodeURIComponent(judgeName)}&court=${courtId}&order_by=score+desc`;

    console.log(`[discover] Fetching search page (${found} refs so far)...`);
    const page: any = await courtListenerFetch(url);
    const results = page.results ?? [];
    let added = 0;

    for (const result of results) {
      if (found + added >= MAX) break;

      const opinionId = result.opinions?.[0]?.id ?? null;
      const clusterId = result.cluster_id;
      if (!clusterId) continue;

      await ctx.runMutation(internal.judgeOpinions.insertRef, {
        judgeId,
        courtListenerClusterId: clusterId,
        courtListenerOpinionId: opinionId ?? undefined,
        caseName: result.caseName ?? undefined,
        dateFiled: result.dateFiled ?? undefined,
      });
      added++;
    }

    const newTotal = found + added;
    const nextUrl = page.next ?? null;

    console.log(`[discover] Page done. ${newTotal} refs total.`);

    if (nextUrl && newTotal < MAX) {
      await ctx.scheduler.runAfter(0, internal.opinionDownloader.discoverOpinions, {
        judgeId,
        judgeName,
        courtId,
        searchUrl: nextUrl,
        totalFound: newTotal,
      });
    } else {
      console.log(`[discover] Complete. ${newTotal} opinion refs created for ${judgeName}.`);
      // Kick off text downloads
      await ctx.scheduler.runAfter(0, internal.opinionDownloader.downloadPendingTexts, {
        judgeId,
      });
    }
  },
});

// Step 2: Find opinion refs without text, download them one batch at a time.
// Processes up to BATCH_SIZE per invocation, then schedules itself if more remain.
export const downloadPendingTexts = internalAction({
  args: {
    judgeId: v.id("judges"),
  },
  handler: async (ctx, { judgeId }) => {
    const BATCH_SIZE = 10;

    const pending = await ctx.runQuery(internal.judgeOpinions.pendingDownloads, {
      judgeId,
    });

    if (pending.length === 0) {
      console.log(`[download] No pending downloads for judge ${judgeId}. Done.`);
      return;
    }

    console.log(`[download] ${pending.length} opinions need text. Processing batch of ${Math.min(BATCH_SIZE, pending.length)}...`);

    const batch = pending.slice(0, BATCH_SIZE);
    let downloaded = 0;

    for (const op of batch) {
      const opinionId = op.courtListenerOpinionId ?? op.courtListenerClusterId;
      try {
        const full = await courtListenerFetch<any>(
          `/api/rest/v4/opinions/${opinionId}/`,
        );
        const html = full.html_with_citations || full.html || null;
        const text =
          full.plain_text ||
          (html ? stripHtml(html) : null);

        if (text && text.length > 100) {
          await ctx.runMutation(internal.judgeOpinions.writeText, {
            id: op._id,
            opinionText: text.slice(0, 50000),
            opinionHtml: html?.slice(0, 500000) ?? undefined,
          });
          downloaded++;
          console.log(`  [${downloaded}] ${op.caseName ?? "?"} | ${text.length} chars`);
        } else {
          await ctx.runMutation(internal.judgeOpinions.writeText, {
            id: op._id,
            opinionText: "(no text available)",
          });
          console.log(`  [skip] ${op.caseName ?? "?"} — no text`);
        }
      } catch (err) {
        console.warn(`  [error] opinion ${opinionId}: ${err}`);
      }
    }

    // More to do? Schedule next batch.
    const remaining = pending.length - batch.length;
    if (remaining > 0) {
      console.log(`[download] ${downloaded} downloaded this batch. ${remaining} remaining. Scheduling next batch...`);
      await ctx.scheduler.runAfter(0, internal.opinionDownloader.downloadPendingTexts, {
        judgeId,
      });
    } else {
      console.log(`[download] All done. ${downloaded} downloaded in final batch.`);
    }
  },
});

// Backfill: fetch HTML for opinions that have text but no HTML.
// Processes in batches, self-schedules for remaining.
export const backfillHtml = internalAction({
  args: { judgeId: v.id("judges") },
  handler: async (ctx, { judgeId }) => {
    const BATCH_SIZE = 10;

    const missing = await ctx.runQuery(internal.judgeOpinions.missingHtml, {
      judgeId,
    });

    if (missing.length === 0) {
      console.log(`[backfill] No opinions missing HTML. Done.`);
      return;
    }

    console.log(`[backfill] ${missing.length} opinions need HTML. Processing batch...`);

    const batch = missing.slice(0, BATCH_SIZE);
    let filled = 0;

    for (const op of batch) {
      const opinionId = op.courtListenerOpinionId ?? op.courtListenerClusterId;
      try {
        const full = await courtListenerFetch<any>(
          `/api/rest/v4/opinions/${opinionId}/`,
        );
        const html = full.html_with_citations || full.html || null;

        if (html) {
          await ctx.runMutation(internal.judgeOpinions.writeHtml, {
            id: op._id,
            opinionHtml: html.slice(0, 500000),
          });
          filled++;
          console.log(`  [${filled}] ${op.caseName ?? "?"} | ${html.length} chars HTML`);
        }
      } catch (err) {
        console.warn(`  [error] opinion ${opinionId}: ${err}`);
      }
    }

    const remaining = missing.length - batch.length;
    if (remaining > 0) {
      console.log(`[backfill] ${filled} filled. ${remaining} remaining. Scheduling next batch...`);
      await ctx.scheduler.runAfter(0, internal.opinionDownloader.backfillHtml, {
        judgeId,
      });
    } else {
      console.log(`[backfill] Complete. ${filled} filled in final batch.`);
    }
  },
});
