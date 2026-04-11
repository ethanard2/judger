import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { parseJudgeProfile, type JudgeProfile } from "~/lib/judge-profile";

export const Route = createFileRoute("/case/$caseId")({
  component: CasePage,
});

const TABS = ["Profile", "Motion Analytics", "Behavioral Analysis", "Precedents", "Opinions", "Chat"] as const;
type Tab = (typeof TABS)[number];

function CasePage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("Profile");

  const detail = useQuery(api.cases.getDetail, { id: caseId as Id<"cases"> });
  const refreshProfile = useMutation(api.cases.refreshJudgeProfile);

  if (detail === undefined) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <p className="text-gray-400 font-sans">Loading case...</p>
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <p className="text-gray-500 font-sans">Case not found</p>
      </div>
    );
  }

  const { case: caseRecord, judge, docketEntries, conversation } = detail;
  const isProcessing = caseRecord.status !== "ready" && caseRecord.status !== "error";
  const profile = parseJudgeProfile(judge?.profile);

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-serif text-[#1a1a1a]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1B2A4A] to-[#2C3E6B] px-10 py-8 text-white">
        <div className="flex justify-between items-start">
          <div>
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="text-[11px] tracking-[2px] uppercase opacity-60 font-sans mb-2 hover:opacity-80 transition"
            >
              &larr; BenchMemo
            </button>
            <h1 className="text-[28px] font-normal tracking-tight m-0">
              {judge ? `Hon. ${judge.name}` : "Judge Pending"}
            </h1>
            <div className="text-[15px] opacity-80 font-sans mt-1">
              {caseRecord.courtName}
            </div>
          </div>
          <div className="text-right font-sans text-[13px] opacity-70">
            {judge?.appointedBy && <div>Appointed by {judge.appointedBy}</div>}
            {profile?.atAGlance?.opinionsAnalyzed && (
              <div className="mt-1">Based on {profile.atAGlance.opinionsAnalyzed} opinions analyzed</div>
            )}
            {caseRecord.status === "ready" && (
              <button
                onClick={() => refreshProfile({ id: caseId as Id<"cases"> })}
                className="mt-2 text-[11px] text-white/50 hover:text-white/80 transition underline"
              >
                Refresh judge profile
              </button>
            )}
          </div>
        </div>

        {/* Case Context Bar */}
        <div className="mt-5 px-4 py-3 bg-white/10 rounded-md font-sans text-[13px] flex gap-6 flex-wrap">
          <span><strong>{caseRecord.caseName ?? caseRecord.caseNumber}</strong></span>
          <span>{caseRecord.caseNumber}</span>
          {caseRecord.natureOfSuit && <span>{caseRecord.natureOfSuit}</span>}
          {isProcessing && (
            <span className="ml-auto opacity-70 flex items-center gap-2">
              <span className="w-2 h-2 bg-white/60 rounded-full animate-pulse" />
              {caseRecord.statusMessage ?? "Processing..."}
            </span>
          )}
          {caseRecord.status === "error" && (
            <span className="ml-auto text-red-300">{caseRecord.statusMessage ?? "Error"}</span>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-300 bg-white px-10 font-sans text-[13px]">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3.5 border-b-2 transition-all ${
              activeTab === tab
                ? "border-[#1B2A4A] text-[#1B2A4A] font-semibold"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-10 py-8 max-w-[960px]">
        {activeTab === "Profile" && <ProfileTab profile={profile} judge={judge} caseRecord={caseRecord} />}
        {activeTab === "Motion Analytics" && <MotionAnalyticsTab profile={profile} />}
        {activeTab === "Behavioral Analysis" && <BehavioralAnalysisTab profile={profile} />}
        {activeTab === "Precedents" && <PrecedentsTab profile={profile} />}
        {activeTab === "Opinions" && judge && (
          <OpinionsTab judgeId={judge._id} />
        )}
        {activeTab === "Chat" && (
          <ChatTabView
            caseId={caseId as Id<"cases">}
            ready={caseRecord.status === "ready"}
            messages={conversation?.messages ?? []}
            judgeName={judge?.name}
            opinionsCount={profile?.atAGlance?.opinionsAnalyzed}
          />
        )}
      </div>

      {/* Disclaimer */}
      <div className="px-10 py-4 border-t border-gray-200 text-[11px] text-gray-400 font-sans leading-relaxed">
        This analysis is based on patterns in publicly available court data. It is not legal advice.
        All observations should be independently verified.
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-normal mb-5 pb-2 border-b border-gray-200">
      {children}
    </h2>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#F5F0E8] border border-[#E0D9CC] rounded p-5 text-sm leading-[1.8] font-sans">
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-[#e8e8e4] rounded p-4">
      <div className="text-[11px] uppercase tracking-[1.5px] text-gray-400 font-sans mb-2">{label}</div>
      <div className="text-[28px] font-light text-[#1B2A4A] font-sans">{value}</div>
      {sub && <div className="text-[12px] text-gray-400 font-sans mt-1">{sub}</div>}
    </div>
  );
}

function ProfileTab({ profile, judge, caseRecord }: { profile: JudgeProfile | null; judge: any; caseRecord: any }) {
  if (!profile && !judge) {
    return <div className="text-center py-12 text-gray-400 font-sans">Profile not yet available.</div>;
  }

  const glance = profile?.atAGlance;

  return (
    <div>
      {profile?.overview && (
        <>
          <SectionTitle>Overview</SectionTitle>
          <p className="text-[15px] leading-[1.7] text-gray-700 font-sans">{profile.overview}</p>
        </>
      )}

      {glance && (
        <div className="mt-8">
          <SectionTitle>At a Glance</SectionTitle>
          <div className="grid grid-cols-3 gap-4">
            {glance.avgOpinionLengthPages && (
              <StatCard label="Avg. Opinion Length" value={`${glance.avgOpinionLengthPages} pages`} />
            )}
            {glance.msjGrantRate && <StatCard label="MSJ Grant Rate" value={glance.msjGrantRate} />}
            {glance.mtdGrantRate && <StatCard label="MTD Grant Rate" value={glance.mtdGrantRate} />}
            {profile?.timeline?.avgMSJDecision && (
              <StatCard label="Avg. MSJ Decision Time" value={profile.timeline.avgMSJDecision} />
            )}
            {glance.opinionsAnalyzed && (
              <StatCard label="Opinions Analyzed" value={String(glance.opinionsAnalyzed)} sub={glance.dateRange} />
            )}
            {glance.suaSponteRate && (
              <StatCard label="Sua Sponte Issues Raised" value={glance.suaSponteRate} sub="of opinions analyzed" />
            )}
          </div>
        </div>
      )}

      {caseRecord.caseAnalysis && (
        <div className="mt-8">
          <SectionTitle>Strategic Analysis</SectionTitle>
          <Callout>
            <div className="whitespace-pre-wrap">{caseRecord.caseAnalysis}</div>
          </Callout>
        </div>
      )}

      {/* Fallback for legacy profiles without atAGlance */}
      {!glance && profile?.grantRates && profile.grantRates.length > 0 && (
        <div className="mt-8">
          <SectionTitle>Grant/Deny Rates</SectionTitle>
          <div className="grid grid-cols-3 gap-4">
            {profile.grantRates.map((r, i) => (
              <StatCard key={i} label={r.motionType} value={`${r.grantRate ?? 0}%`} sub={`${r.sampleSize ?? 0} cases`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MotionAnalyticsTab({ profile }: { profile: JudgeProfile | null }) {
  const stats = profile?.motionStats;
  if (!stats || stats.length === 0) {
    return <div className="text-center py-12 text-gray-400 font-sans">Motion analytics not yet available.</div>;
  }

  return (
    <div>
      <SectionTitle>Motion Outcomes</SectionTitle>
      <table className="w-full border-collapse font-sans text-[13px]">
        <thead>
          <tr className="border-b-2 border-[#1B2A4A]">
            <th className="text-left p-2.5 font-semibold">Motion Type</th>
            <th className="text-center p-2.5 font-semibold text-green-800">Granted</th>
            <th className="text-center p-2.5 font-semibold text-amber-700">Partial</th>
            <th className="text-center p-2.5 font-semibold text-red-800">Denied</th>
            <th className="text-center p-2.5 font-semibold">Total</th>
            <th className="text-center p-2.5 font-semibold">Grant Rate</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row, i) => {
            const rate = parseInt(row.rate) || 0;
            return (
              <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF7]"}`}>
                <td className="p-2.5 font-medium">{row.type}</td>
                <td className="text-center p-2.5 text-green-800">{row.granted}</td>
                <td className="text-center p-2.5 text-amber-700">{row.partial}</td>
                <td className="text-center p-2.5 text-red-800">{row.denied}</td>
                <td className="text-center p-2.5">{row.total}</td>
                <td className="text-center p-2.5">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-[60px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${rate > 55 ? "bg-green-700" : rate > 40 ? "bg-amber-600" : "bg-red-700"}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="font-semibold min-w-[32px]">{row.rate}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BehavioralAnalysisTab({ profile }: { profile: JudgeProfile | null }) {
  const sections = [
    { title: "Analytical Style", items: profile?.analyticalStyle },
    { title: "Summary Judgment Tendencies", items: profile?.summaryJudgment },
    { title: "Procedural Requirements", items: profile?.proceduralPreferences },
    { title: "Discovery Approach", items: profile?.discoveryApproach },
    { title: "Tone & Temperament", items: profile?.tonalNotes },
    // Fallback for legacy profiles
    { title: "Key Tendencies", items: profile?.keyTendencies },
    { title: "Red Flags", items: profile?.redFlags },
  ].filter((s) => s.items && s.items.length > 0);

  if (sections.length === 0) {
    return <div className="text-center py-12 text-gray-400 font-sans">Behavioral analysis not yet available.</div>;
  }

  return (
    <div>
      {sections.map((section, i) => (
        <div key={i} className="mb-8">
          <h2 className="text-lg font-normal mb-4 pb-2 border-b border-gray-200">{section.title}</h2>
          {section.items!.map((item, j) => (
            <div
              key={j}
              className={`py-3 text-sm leading-[1.7] font-sans text-gray-700 flex gap-3 ${
                j < section.items!.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <span className="text-[#1B2A4A] font-bold shrink-0 mt-0.5">&rsaquo;</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PrecedentsTab({ profile }: { profile: JudgeProfile | null }) {
  const precedents = profile?.topPrecedents;

  // Fallback for legacy string array
  if (!precedents && profile?.citedPrecedents) {
    return (
      <div>
        <SectionTitle>Most Cited Precedents</SectionTitle>
        {profile.citedPrecedents.map((p, i) => (
          <div key={i} className="bg-white border border-[#e8e8e4] rounded p-4 mb-3 font-sans text-sm text-[#1B2A4A] font-semibold">
            {p}
          </div>
        ))}
      </div>
    );
  }

  if (!precedents || precedents.length === 0) {
    return <div className="text-center py-12 text-gray-400 font-sans">Precedent data not yet available.</div>;
  }

  return (
    <div>
      <SectionTitle>Most Frequently Cited Authorities</SectionTitle>
      {precedents.map((p, i) => (
        <div key={i} className="bg-white border border-[#e8e8e4] rounded p-4 mb-3 flex gap-5 items-start">
          <div className="bg-[#1B2A4A] text-white rounded-full w-9 h-9 flex items-center justify-center font-sans text-sm font-semibold shrink-0">
            {p.count}
          </div>
          <div>
            <div className="text-sm font-semibold font-sans text-[#1B2A4A]">{p.case}</div>
            <div className="text-[13px] text-gray-500 font-sans mt-1">{p.context}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OpinionsTab({ judgeId }: { judgeId: Id<"judges"> }) {
  const opinions = useQuery(api.judgeOpinions.listByJudge, { judgeId });
  const [selectedId, setSelectedId] = useState<Id<"judgeOpinions"> | null>(null);
  const selectedOpinion = useQuery(
    api.judgeOpinions.getOpinion,
    selectedId ? { id: selectedId } : "skip",
  );

  if (opinions === undefined) {
    return <div className="text-center py-12 text-gray-400 font-sans">Loading opinions...</div>;
  }

  if (opinions.length === 0) {
    return <div className="text-center py-12 text-gray-400 font-sans">No opinions found.</div>;
  }

  const sorted = [...opinions]
    .filter((o) => o.hasText)
    .sort((a, b) => (b.dateFiled ?? "").localeCompare(a.dateFiled ?? ""));

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Nav pane */}
      <div className="w-[280px] shrink-0 bg-white border border-[#e8e8e4] rounded-md overflow-hidden">
        <div className="px-4 py-3 bg-[#F5F5F2] border-b border-[#e8e8e4] font-sans text-[11px] uppercase tracking-[1.5px] text-gray-400">
          {sorted.length} opinions
        </div>
        <div className="overflow-y-auto max-h-[560px]">
          {sorted.map((op) => (
            <button
              key={op._id}
              onClick={() => setSelectedId(op._id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 transition font-sans ${
                selectedId === op._id
                  ? "bg-[#1B2A4A]/5 border-l-2 border-l-[#1B2A4A]"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="text-[13px] font-medium text-gray-800 leading-tight">
                {op.caseName ?? "Untitled"}
              </div>
              {op.dateFiled && (
                <div className="text-[11px] text-gray-400 mt-1">{op.dateFiled}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Opinion content */}
      <div className="flex-1 bg-white border border-[#e8e8e4] rounded-md overflow-hidden">
        {!selectedId && (
          <div className="flex items-center justify-center h-full text-gray-400 font-sans text-sm">
            Select an opinion to read
          </div>
        )}
        {selectedId && selectedOpinion === undefined && (
          <div className="flex items-center justify-center h-full text-gray-400 font-sans text-sm">
            Loading...
          </div>
        )}
        {selectedOpinion && (
          <div className="overflow-y-auto max-h-[600px]">
            <div className="px-6 py-4 bg-[#F5F5F2] border-b border-[#e8e8e4]">
              <h3 className="font-semibold text-gray-900 font-sans text-[15px]">
                {selectedOpinion.caseName ?? "Untitled"}
              </h3>
              {selectedOpinion.dateFiled && (
                <div className="text-[12px] text-gray-400 font-sans mt-1">
                  Filed {selectedOpinion.dateFiled}
                </div>
              )}
            </div>
            <div className="px-6 py-4">
              {selectedOpinion.opinionHtml ? (
                <div
                  className="prose prose-sm max-w-none font-serif text-[14px] leading-[1.8] text-gray-800"
                  dangerouslySetInnerHTML={{ __html: selectedOpinion.opinionHtml }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-[13px] text-gray-700 leading-[1.7]">
                  {selectedOpinion.opinionText}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatTabView({
  caseId,
  ready,
  messages,
  judgeName,
  opinionsCount,
}: {
  caseId: Id<"cases">;
  ready: boolean;
  messages: Array<{ role: "user" | "assistant"; content: string; timestamp: number }>;
  judgeName?: string;
  opinionsCount?: number;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessageAction = useAction(api.chat.sendMessage);

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
    return <div className="text-center py-12 text-gray-400 font-sans">Chat will be available once analysis is complete.</div>;
  }

  return (
    <div className="bg-white border border-[#e8e8e4] rounded-md overflow-hidden">
      <div className="px-5 py-3 bg-[#F5F5F2] border-b border-[#e8e8e4] font-sans text-[12px] text-gray-400">
        Litigation Companion
        {opinionsCount && <> &middot; Grounded in {opinionsCount} opinions</>}
        {judgeName && <> by Judge {judgeName}</>}
        &middot; Not legal advice
      </div>
      <div className="max-h-[600px] overflow-y-auto p-5 space-y-5">
        {messages.length === 0 && !sending && (
          <div className="text-center py-8 text-gray-400 text-sm font-sans">
            <p className="mb-4">Ask about the judge's patterns, your case strategy, or request a draft.</p>
            <div className="space-y-2 text-left max-w-md mx-auto">
              {[
                "How does this judge handle summary judgment in contract disputes?",
                "What procedural requirements should I be aware of?",
                "Draft my opposition brief structured for this judge.",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="block w-full text-left px-4 py-2 rounded border border-gray-200 hover:border-[#1B2A4A]/30 hover:bg-[#1B2A4A]/5 text-gray-600 text-xs transition font-sans"
                >
                  &ldquo;{q}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div className="text-[11px] uppercase tracking-[1px] text-gray-400 font-sans mb-1.5">
              {msg.role === "user" ? "You" : "Companion"}
            </div>
            <div
              className={`max-w-[85%] px-4 py-3.5 text-[13.5px] leading-[1.7] font-sans whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#1B2A4A] text-white rounded-xl rounded-br-sm"
                  : "bg-[#F8F8F5] text-[#1a1a1a] rounded-xl rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex flex-col items-start">
            <div className="text-[11px] uppercase tracking-[1px] text-gray-400 font-sans mb-1.5">Companion</div>
            <div className="bg-[#F8F8F5] rounded-xl rounded-bl-sm px-4 py-3.5">
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

      <form onSubmit={handleSend} className="px-5 py-4 border-t border-[#e8e8e4] flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${judgeName ? `Judge ${judgeName}'s` : "the judge's"} patterns, your case strategy...`}
          className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-md font-sans text-[13px] outline-none focus:border-[#1B2A4A]"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-5 py-2.5 bg-[#1B2A4A] text-white rounded-md font-sans text-[13px] disabled:opacity-50 transition"
        >
          Send
        </button>
      </form>

      {sendError && <p className="px-5 pb-3 text-xs text-red-600 font-sans">{sendError}</p>}
    </div>
  );
}
