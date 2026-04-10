import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexQuery, useConvexAction } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/case/$caseId")({
  component: CasePage,
});

type Tab = "analysis" | "judge" | "docket" | "chat";

function CasePage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("analysis");

  const caseRecord = useConvexQuery(api.cases.get, {
    id: caseId as Id<"cases">,
  });
  const entries = useConvexQuery(api.docketEntries.byCase, {
    caseId: caseId as Id<"cases">,
  });
  const judge = useConvexQuery(
    api.judges.get,
    caseRecord?.judgeId ? { id: caseRecord.judgeId } : "skip",
  );
  const conversation = useConvexQuery(api.conversations.byCase, {
    caseId: caseId as Id<"cases">,
  });

  if (caseRecord === undefined) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-gray-400">Loading case...</p>
      </div>
    );
  }

  if (caseRecord === null) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-gray-500">Case not found</p>
      </div>
    );
  }

  const isProcessing =
    caseRecord.status !== "ready" && caseRecord.status !== "error";

  return (
    <div className="min-h-screen bg-surface">
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="text-primary text-xl font-bold"
        >
          CourtCase Companion
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600 text-sm truncate">
          {caseRecord.caseName ?? caseRecord.caseNumber}
        </span>
      </nav>

      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {caseRecord.caseName ?? caseRecord.caseNumber}
        </h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span>{caseRecord.caseNumber}</span>
          <span>&middot;</span>
          <span>{caseRecord.courtName}</span>
          {judge && (
            <>
              <span>&middot;</span>
              <span>Judge {judge.name}</span>
            </>
          )}
        </div>

        {isProcessing && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="text-blue-700 text-sm">
                {caseRecord.statusMessage ?? "Processing..."}
              </span>
            </div>
          </div>
        )}

        {caseRecord.status === "error" && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <span className="text-red-700 text-sm">
              {caseRecord.statusMessage ?? "An error occurred"}
            </span>
          </div>
        )}
      </div>

      <div className="bg-white border-b border-gray-200 px-8">
        <div className="flex gap-6">
          {(
            [
              { id: "analysis", label: "Case Analysis" },
              { id: "judge", label: "Judge Profile" },
              { id: "docket", label: "Docket" },
              { id: "chat", label: "Chat" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {activeTab === "analysis" && (
          <AnalysisTab analysis={caseRecord.caseAnalysis} />
        )}
        {activeTab === "judge" && <JudgeTab judge={judge} />}
        {activeTab === "docket" && <DocketTab entries={entries ?? []} />}
        {activeTab === "chat" && (
          <ChatTab
            caseId={caseId as Id<"cases">}
            ready={caseRecord.status === "ready"}
            messages={conversation?.messages ?? []}
          />
        )}
      </div>
    </div>
  );
}

function AnalysisTab({ analysis }: { analysis?: string }) {
  if (!analysis) {
    return (
      <div className="text-center py-12 text-gray-400">
        Analysis not yet available. Check back once processing completes.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Strategic Analysis
      </h2>
      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
        {analysis}
      </div>
    </div>
  );
}

function JudgeTab({ judge }: { judge: any }) {
  if (!judge?.profile) {
    return (
      <div className="text-center py-12 text-gray-400">
        Judge profile not yet available.
      </div>
    );
  }

  let profileData: any = null;
  try {
    profileData = JSON.parse(judge.profile);
  } catch {
    // plain text
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        Judge {judge.name}
      </h2>
      <div className="flex gap-4 text-sm text-gray-500 mb-6">
        {judge.appointedBy && <span>Appointed by {judge.appointedBy}</span>}
        {judge.opinionCount && (
          <span>{judge.opinionCount} opinions analyzed</span>
        )}
      </div>
      {profileData ? (
        <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-xs whitespace-pre-wrap">
          {JSON.stringify(profileData, null, 2)}
        </pre>
      ) : (
        <div className="text-gray-700 whitespace-pre-wrap">{judge.profile}</div>
      )}
    </div>
  );
}

function DocketTab({ entries }: { entries: any[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No docket entries yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {entries.map((entry: any, i: number) => (
        <div key={entry._id ?? i} className="px-6 py-4">
          <div className="flex items-start gap-4">
            <span className="text-xs text-gray-400 font-mono w-8 shrink-0 pt-0.5">
              {entry.entryNumber ?? "\u2014"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">{entry.description}</p>
              {entry.dateFiled && (
                <p className="text-xs text-gray-400 mt-1">{entry.dateFiled}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatTab({
  caseId,
  ready,
  messages,
}: {
  caseId: Id<"cases">;
  ready: boolean;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }>;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessageAction = useConvexAction(api.chat.sendMessage);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput("");
    setSending(true);
    setSendError("");
    try {
      await sendMessageAction({ caseId, message: msg });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (!ready) {
    return (
      <div className="text-center py-12 text-gray-400">
        Chat will be available once the case analysis is complete.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && !sending && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <p className="mb-4">Ask me anything about your case or judge.</p>
            <div className="space-y-2 text-left max-w-md mx-auto">
              {[
                "How does this judge handle summary judgment motions?",
                "What should I expect from opposing counsel's next move?",
                "Draft my opposition brief structured for this judge.",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="block w-full text-left px-4 py-2 rounded-lg border border-gray-200 hover:border-primary/30 hover:bg-primary/5 text-gray-600 text-xs transition"
                >
                  &ldquo;{q}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="border-t border-gray-200 p-4 flex gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your case or judge..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-primary hover:bg-primary-light text-white px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {sendError && (
        <p className="px-4 pb-3 text-xs text-red-600">{sendError}</p>
      )}
    </div>
  );
}
