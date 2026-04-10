import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/example")({
  component: ExampleProfile,
});

const judgeData = {
  name: "Hon. Jesse M. Furman",
  court: "Southern District of New York",
  courtroom: "24B",
  appointed: "2012",
  appointedBy: "Barack Obama",
  confirmed: "62-34",
  background:
    'Yale Law (J.D. 1998), Harvard (B.A. 1994). Clerked for Judge Cabranes (2d Cir.) and Justice Souter. Former AUSA, SDNY (2004-2012).',
  abaRating: "Majority Qualified, Minority Well Qualified",
  notableCase: "New York v. Dep't of Commerce (census citizenship question)",
};

const motionStats = [
  { type: "Motion to Dismiss (12(b)(6))", granted: 38, denied: 24, partial: 19, total: 81, rate: 47 },
  { type: "Summary Judgment", granted: 29, denied: 18, partial: 22, total: 69, rate: 42 },
  { type: "Motion to Compel", granted: 31, denied: 8, partial: 12, total: 51, rate: 61 },
  { type: "Motion for TRO/PI", granted: 11, denied: 14, partial: 3, total: 28, rate: 39 },
  { type: "Motion to Amend", granted: 22, denied: 9, partial: 0, total: 31, rate: 71 },
  { type: "Motion in Limine", granted: 18, denied: 15, partial: 8, total: 41, rate: 44 },
  { type: "Motion to Seal", granted: 14, denied: 19, partial: 0, total: 33, rate: 42 },
];

const behavioralProfile = {
  analyticalStyle: [
    "Writes thorough, methodical opinions averaging 22 pages. Does not rush to disposition — expects parties to brief issues fully.",
    "Applies Iqbal/Twombly plausibility standard rigorously but fairly. Will dismiss conclusory allegations but draws all reasonable inferences for the non-movant.",
    "Frequently addresses threshold jurisdictional and standing issues sua sponte, even when not briefed by the parties. Has dismissed cases on Article III standing grounds that neither party raised.",
    "Strongly prefers statutory text analysis before legislative history. Will reach policy arguments only when text is genuinely ambiguous. Do not lead with policy.",
    "Regularly cites Second Circuit precedent over out-of-circuit authority. When he does cite other circuits, it is typically to note a circuit split and explain why the Second Circuit approach is preferable.",
  ],
  proceduralPreferences: [
    "Reads all submissions electronically on iPad. All PDFs must be text-searchable. Scanned documents without OCR will draw negative attention.",
    "Requires pre-motion conference letters before any dispositive motion. Will deny motions filed without the conference. This is strictly enforced.",
    "Amended filings must include a redline against the original. No exceptions.",
    "Extension requests must be by letter-motion, not stipulation. Requires consent of opposing counsel noted in the letter.",
    "No courtesy copies. This is explicitly stated in his individual rules and he has noted annoyance when parties send them.",
    "For TRO applications, requires the moving party to confer with opposing counsel before filing unless exigent circumstances are documented.",
  ],
  discoveryApproach: [
    "Favors proportionality under Rule 26(b)(1). Will limit discovery requests he deems disproportionate to the needs of the case, particularly in smaller matters.",
    "Enforces meet-and-confer requirements strictly. Has denied discovery motions where the moving party could not demonstrate a good-faith meet-and-confer effort.",
    "Tends to resolve discovery disputes via letter briefing rather than formal motion practice. Prefers 3-page letter-motions on discovery issues.",
    "Has sanctioned parties for discovery abuse, but typically starts with warnings and fee-shifting before escalating to adverse inference instructions.",
  ],
  summaryJudgment: [
    "Overall grant rate of 42% is slightly below the SDNY average (~48%), suggesting a modest preference for letting close cases go to trial.",
    "In employment discrimination cases, significantly more likely to deny summary judgment than the district average. Draws inferences liberally in favor of plaintiffs on issues of pretext and discriminatory intent.",
    "In contract disputes, applies summary judgment more readily. Has granted MSJ on contract interpretation where he finds the language unambiguous, without reaching extrinsic evidence.",
    'Requires a detailed 56.1 statement. Has deemed facts admitted when the opposing party failed to properly respond to the 56.1 statement, but will independently verify against the record before entering judgment on that basis.',
    "Will not grant summary judgment on a ground not raised by the moving party, even if the record might support it.",
  ],
  tonalNotes: [
    "Opinions are formal but readable. Avoids unnecessarily technical language. Occasionally uses measured understatement when he finds an argument meritless — watch for phrases like 'to put it mildly' and 'the Court is not persuaded.'",
    "Expects civility between counsel. Has commented negatively in opinions on discovery conduct that he views as gamesmanship.",
    "Treats pro se litigants with notable patience. Construes pro se filings liberally and provides detailed explanations of deficiencies when dismissing.",
  ],
};

const topPrecedents = [
  { case: "Ashcroft v. Iqbal, 556 U.S. 662 (2009)", count: 89, context: "Plausibility standard for 12(b)(6). Applies rigorously." },
  { case: "Celotex Corp. v. Catrett, 477 U.S. 317 (1986)", count: 54, context: "Summary judgment burden-shifting. Standard citation." },
  { case: "Anderson v. Liberty Lobby, 477 U.S. 242 (1986)", count: 47, context: "Summary judgment — genuine dispute of material fact." },
  { case: "Littlejohn v. City of New York, 795 F.3d 297 (2d Cir. 2015)", count: 31, context: "Employment discrimination. Frequently cited in Title VII analysis." },
  { case: "Lugosch v. Pyramid Co., 435 F.3d 110 (2d Cir. 2006)", count: 24, context: "Sealing standard. Applies strictly — strong presumption of public access." },
  { case: "Int'l Audiotext Network v. AT&T, 62 F.3d 69 (2d Cir. 1995)", count: 18, context: "Personal jurisdiction analysis in contract cases." },
];

const caseTimeline = [
  { label: "Avg. Motion to Decision", value: "47 days" },
  { label: "Avg. Filing to Trial", value: "26 months" },
  { label: "Avg. MTD Decision Time", value: "38 days" },
  { label: "Avg. MSJ Decision Time", value: "54 days" },
  { label: "Avg. Discovery Dispute Resolution", value: "12 days (via letter-motion)" },
];

const chatMessages = [
  {
    role: "assistant" as const,
    content: `I'm your litigation companion for **Acme Corp v. Zenith Industries** (1:25-cv-04821-JMF). I've analyzed Judge Furman's last 68 opinions and your full case docket. My observations are based on patterns in public court data — please verify everything and use your professional judgment.\n\nWhat would you like to know?`,
  },
  {
    role: "user" as const,
    content: "We're planning to file a motion for summary judgment on the breach of contract claim. The contract language seems pretty clear to us. What should we know about how Furman handles MSJ in contract cases?",
  },
  {
    role: "assistant" as const,
    content: `Several patterns are relevant here based on Judge Furman's prior rulings:\n\n**He's receptive to MSJ on contract interpretation when the text is unambiguous.** In 7 of the 11 contract-related MSJ motions in my dataset, he granted at least partial summary judgment where he found the contract language clear on its face. His opinions in these cases typically follow a consistent structure: he states the contractual language, applies New York's rules of construction, and determines whether the language is ambiguous as a threshold matter.\n\n**Critical threshold: the ambiguity question.** If Judge Furman finds the language ambiguous, he will almost certainly deny the MSJ and send the interpretive question to trial with extrinsic evidence. In 4 of those 11 cases, he found ambiguity and denied. He has written that 'a contract is ambiguous when it is reasonably susceptible of more than one interpretation' and that this is a question of law for the court — so your brief should spend significant space arguing that only one reasonable reading exists.\n\n**Practical recommendations based on these patterns:**\n\n1. **Lead with the contract text.** His opinions in contract MSJs always start with the exact language at issue, quoted in full. Mirror that structure — put the relevant provisions front and center, not buried in the facts section.\n\n2. **Address the opposing interpretation head-on.** In *Meridian Capital v. Holdings Group* (2023), he denied an MSJ where the movant failed to address the non-movant's alternative reading of a termination clause. He wrote that 'the Court cannot conclude that only one reasonable interpretation exists when the movant has not engaged with the interpretation advanced by the opposing party.' You need to acknowledge Zenith's reading and explain why it is not reasonable.\n\n3. **Don't over-rely on extrinsic evidence at this stage.** He has repeatedly stated that 'extrinsic evidence may not be used to create an ambiguity where none exists,' but he also will not consider it to resolve a question he finds unambiguous. If your case depends on the text being clear, keep the focus there.\n\n4. **Your 56.1 statement matters.** He enforces the Local Rule 56.1 requirements carefully. Make sure every material fact is supported by a specific citation to admissible evidence. He has deemed facts admitted for deficient responses, but he also independently checks the record.\n\nOne concern: has Zenith indicated they'll argue the contract is ambiguous? That's the main risk vector here based on Furman's pattern.`,
  },
  {
    role: "user" as const,
    content: "Yes, they've hinted at it in the meet-and-confer. They think the indemnification clause can be read two ways.",
  },
  {
    role: "assistant" as const,
    content: `That's exactly the battle line you should expect. Here's how Judge Furman has approached the ambiguity question in prior cases:\n\n**He treats ambiguity as a binary threshold, not a spectrum.** Either the contract language is susceptible to more than one *reasonable* interpretation, or it isn't. He emphasizes 'reasonable' — he's rejected strained or implausible alternative readings. In *DataStream v. CloudPlex* (2024), he rejected an alternative reading that required ignoring a defined term elsewhere in the agreement, writing that 'an interpretation that renders another provision superfluous is not a reasonable one.'\n\n**Your strongest move: show the alternative reading creates internal inconsistency.** If you can demonstrate that Zenith's reading of the indemnification clause contradicts another provision, conflicts with a defined term, or renders any part of the agreement meaningless, you're in strong position. Furman has consistently rejected readings that he finds 'undermine the coherence of the agreement as a whole.'\n\n**Second move: point to the drafting context if it helps.** While he won't use extrinsic evidence to create ambiguity, he has looked at the overall contractual scheme to confirm that an apparently clear reading is consistent with the agreement's structure. If the indemnification clause sits within a broader framework that makes your reading the only coherent one, structure the brief to walk him through that framework.\n\n**What to avoid:** Don't submit a 35-page brief when 20 pages will do. His contract opinions tend to be among his shorter opinions (averaging 14 pages vs. his overall average of 22). This suggests he views contract interpretation as a more contained exercise. Match his expected analytical scope.`,
  },
];

const TABS = ["Profile", "Motion Analytics", "Behavioral Analysis", "Precedents", "Timeline", "Chat"] as const;
type Tab = (typeof TABS)[number];

function ExampleProfile() {
  const [activeTab, setActiveTab] = useState<Tab>("Profile");

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-serif text-[#1a1a1a]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1B2A4A] to-[#2C3E6B] px-10 py-8 text-white">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[11px] tracking-[2px] uppercase opacity-60 font-sans mb-2">
              Judge Intelligence Report
            </div>
            <h1 className="text-[28px] font-normal tracking-tight m-0">
              {judgeData.name}
            </h1>
            <div className="text-[15px] opacity-80 font-sans mt-1">
              {judgeData.court} &middot; Courtroom {judgeData.courtroom}
            </div>
          </div>
          <div className="text-right font-sans text-[13px] opacity-70">
            <div>Appointed {judgeData.appointed} by {judgeData.appointedBy}</div>
            <div>Confirmed {judgeData.confirmed}</div>
            <div className="mt-1">Based on 68 opinions analyzed</div>
          </div>
        </div>

        {/* Case Context Bar */}
        <div className="mt-5 px-4 py-3 bg-white/10 rounded-md font-sans text-[13px] flex gap-6 flex-wrap">
          <span><strong>Acme Corp v. Zenith Industries</strong></span>
          <span>Case No. 1:25-cv-04821-JMF</span>
          <span>Breach of Contract &middot; Diversity Jurisdiction</span>
          <span className="ml-auto opacity-70">Last synced: 2 hours ago</span>
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
        {activeTab === "Profile" && <ProfileTab />}
        {activeTab === "Motion Analytics" && <MotionAnalyticsTab />}
        {activeTab === "Behavioral Analysis" && <BehavioralAnalysisTab />}
        {activeTab === "Precedents" && <PrecedentsTab />}
        {activeTab === "Timeline" && <TimelineTab />}
        {activeTab === "Chat" && <ChatTab />}
      </div>

      {/* Disclaimer */}
      <div className="px-10 py-4 border-t border-gray-200 text-[11px] text-gray-400 font-sans leading-relaxed">
        This analysis is based on patterns in publicly available court data. It is not legal advice and does not create an attorney-client relationship.
        All observations should be independently verified. Data sourced from CourtListener (RECAP Archive) and court-published opinions.
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

function ProfileTab() {
  return (
    <div>
      <SectionTitle>Background</SectionTitle>
      <p className="text-[15px] leading-[1.7] text-gray-700">
        {judgeData.background}
      </p>
      <p className="text-[15px] leading-[1.7] text-gray-700 mt-3">
        ABA Rating: {judgeData.abaRating}. Most notable case:{" "}
        <em>{judgeData.notableCase}</em> — the census citizenship question
        litigation, in which he found the Commerce Secretary's rationale
        pretextual under the APA. Affirmed by the Supreme Court (2019).
      </p>

      <SectionTitle>At a Glance</SectionTitle>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Avg. Opinion Length", value: "22 pages", sub: "vs. 16 pg SDNY avg" },
          { label: "MSJ Grant Rate", value: "42%", sub: "vs. 48% SDNY avg" },
          { label: "MTD Grant Rate", value: "47%", sub: "vs. 51% SDNY avg" },
          { label: "Avg. Days to MSJ Decision", value: "54 days", sub: "vs. 72 days SDNY avg" },
          { label: "Opinions Analyzed", value: "68", sub: "2019–2026" },
          { label: "Sua Sponte Issues Raised", value: "23%", sub: "of opinions analyzed" },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-[#e8e8e4] rounded p-4">
            <div className="text-[11px] uppercase tracking-[1.5px] text-gray-400 font-sans mb-2">
              {stat.label}
            </div>
            <div className="text-[28px] font-light text-[#1B2A4A] font-sans">
              {stat.value}
            </div>
            <div className="text-[12px] text-gray-400 font-sans mt-1">
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <SectionTitle>Key Takeaways for Your Case</SectionTitle>
        <Callout>
          <p className="mb-3">
            <strong>1. Your contract MSJ has a reasonable chance of success.</strong>{" "}
            Judge Furman grants MSJ in contract cases at a higher rate (~64%) than his
            overall average (42%), particularly where he finds the contractual language unambiguous.
          </p>
          <p className="mb-3">
            <strong>2. The ambiguity question is the entire ballgame.</strong>{" "}
            If Zenith can convince him the indemnification clause is reasonably susceptible to two
            interpretations, he will almost certainly deny and send to trial. Your brief must close that door.
          </p>
          <p className="mb-3">
            <strong>3. Do not skip the pre-motion conference.</strong>{" "}
            His individual rules require it. He has denied dispositive motions filed without one.
            This is not optional.
          </p>
          <p className="m-0">
            <strong>4. Keep it under 25 pages.</strong>{" "}
            His contract opinions average 14 pages. He treats these as contained questions of law.
            A 35-page brief signals that the issue may not be as straightforward as you're claiming.
          </p>
        </Callout>
      </div>
    </div>
  );
}

function MotionAnalyticsTab() {
  return (
    <div>
      <SectionTitle>Motion Outcomes (68 opinions, 2019–2026)</SectionTitle>
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
          {motionStats.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF7]"}`}
            >
              <td className="p-2.5 font-medium">{row.type}</td>
              <td className="text-center p-2.5 text-green-800">{row.granted}</td>
              <td className="text-center p-2.5 text-amber-700">{row.partial}</td>
              <td className="text-center p-2.5 text-red-800">{row.denied}</td>
              <td className="text-center p-2.5">{row.total}</td>
              <td className="text-center p-2.5">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-[60px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        row.rate > 55
                          ? "bg-green-700"
                          : row.rate > 40
                            ? "bg-amber-600"
                            : "bg-red-700"
                      }`}
                      style={{ width: `${row.rate}%` }}
                    />
                  </div>
                  <span className="font-semibold min-w-[32px]">{row.rate}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[12px] text-gray-400 font-sans mt-4">
        Grant rate = fully granted / total. Partial grants counted separately.
        Based on 68 opinions with identifiable motion outcomes.
      </p>
    </div>
  );
}

function BehavioralAnalysisTab() {
  const sections = [
    { title: "Analytical Style", items: behavioralProfile.analyticalStyle },
    { title: "Summary Judgment Tendencies", items: behavioralProfile.summaryJudgment },
    { title: "Procedural Requirements", items: behavioralProfile.proceduralPreferences },
    { title: "Discovery Approach", items: behavioralProfile.discoveryApproach },
    { title: "Tone & Temperament", items: behavioralProfile.tonalNotes },
  ];

  return (
    <div>
      {sections.map((section, i) => (
        <div key={i} className="mb-8">
          <h2 className="text-lg font-normal mb-4 pb-2 border-b border-gray-200">
            {section.title}
          </h2>
          {section.items.map((item, j) => (
            <div
              key={j}
              className={`py-3 text-sm leading-[1.7] font-sans text-gray-700 flex gap-3 ${
                j < section.items.length - 1 ? "border-b border-gray-100" : ""
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

function PrecedentsTab() {
  return (
    <div>
      <SectionTitle>Most Frequently Cited Authorities</SectionTitle>
      <p className="text-sm text-gray-500 font-sans mb-6">
        Cases cited most frequently across 68 analyzed opinions, with context on
        how Judge Furman applies them.
      </p>
      {topPrecedents.map((p, i) => (
        <div
          key={i}
          className="bg-white border border-[#e8e8e4] rounded p-4 mb-3 flex gap-5 items-start"
        >
          <div className="bg-[#1B2A4A] text-white rounded-full w-9 h-9 flex items-center justify-center font-sans text-sm font-semibold shrink-0">
            {p.count}
          </div>
          <div>
            <div className="text-sm font-semibold font-sans text-[#1B2A4A]">
              {p.case}
            </div>
            <div className="text-[13px] text-gray-500 font-sans mt-1">
              {p.context}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineTab() {
  return (
    <div>
      <SectionTitle>Typical Case Timeline</SectionTitle>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {caseTimeline.map((item, i) => (
          <div key={i} className="bg-white border border-[#e8e8e4] rounded p-5">
            <div className="text-[11px] uppercase tracking-[1.5px] text-gray-400 font-sans mb-2">
              {item.label}
            </div>
            <div className="text-2xl font-light text-[#1B2A4A] font-sans">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <SectionTitle>What This Means for Your Case</SectionTitle>
      <Callout>
        <p className="mb-3">
          Judge Furman moves faster than the SDNY average on dispositive motions.
          If you file your MSJ after the close of discovery, expect a decision
          within approximately 54 days. He does not typically hold oral argument
          on summary judgment motions unless he finds the issues unusually complex
          or the briefing inadequate.
        </p>
        <p className="m-0">
          At the current pace of this docket, with discovery set to close in
          August 2026, a realistic timeline is: MSJ filed September 2026,
          opposition October, reply late October, decision by December 2026. If
          denied, trial likely Q2 2027.
        </p>
      </Callout>
    </div>
  );
}

function ChatTab() {
  return (
    <div className="bg-white border border-[#e8e8e4] rounded-md overflow-hidden">
      <div className="px-5 py-3 bg-[#F5F5F2] border-b border-[#e8e8e4] font-sans text-[12px] text-gray-400">
        Litigation Companion &middot; Grounded in 68 opinions + full case docket &middot; Not legal advice
      </div>
      <div className="max-h-[600px] overflow-y-auto p-5 space-y-5">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
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
              {renderMarkdown(msg.content)}
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-4 border-t border-[#e8e8e4] flex gap-3">
        <input
          type="text"
          placeholder="Ask about Judge Furman's patterns, your case strategy, or opposing counsel..."
          className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-md font-sans text-[13px] outline-none focus:border-[#1B2A4A]"
          readOnly
        />
        <button className="px-5 py-2.5 bg-[#1B2A4A] text-white rounded-md font-sans text-[13px] cursor-default">
          Send
        </button>
      </div>
    </div>
  );
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, li) => (
    <span key={li}>
      {line.split(/(\*\*.*?\*\*)/).map((part, pi) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={pi}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={pi}>{part.slice(1, -1)}</em>;
        }
        return <span key={pi}>{part}</span>;
      })}
      {li < text.split("\n").length - 1 && <br />}
    </span>
  ));
}
