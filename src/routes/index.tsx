import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FEDERAL_COURTS } from "~/lib/courts";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const session = authClient.useSession();
  const navigate = useNavigate();
  const [caseNumber, setCaseNumber] = useState("");
  const [courtId, setCourtId] = useState("nysd");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const createCaseMutation = useConvexMutation(api.cases.create);

  const court = FEDERAL_COURTS.find((c) => c.id === courtId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!session.data) {
      navigate({ to: "/sign-in" });
      return;
    }

    if (!caseNumber.trim()) {
      setError("Please enter a case number");
      return;
    }

    setCreating(true);
    try {
      const caseId = await createCaseMutation({
        caseNumber: caseNumber.trim(),
        courtId,
        courtName: court?.name ?? courtId,
      });
      navigate({ to: "/case/$caseId", params: { caseId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark to-primary">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4">
        <div className="text-white text-xl font-bold">CourtCase Companion</div>
        <div>
          {session.data ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate({ to: "/dashboard" })}
                className="text-white/80 hover:text-white text-sm"
              >
                Dashboard
              </button>
              <button
                onClick={() => authClient.signOut()}
                className="text-white/60 hover:text-white text-sm"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate({ to: "/sign-in" })}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition"
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-8 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
          Know your judge before
          <br />
          you walk into court.
        </h1>
        <p className="text-xl text-white/70 mb-12">
          AI-powered litigation intelligence. Enter a case number, get a
          strategic companion that knows the judge's patterns and your specific
          case.
        </p>

        {/* Case input form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-8 shadow-2xl text-left"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Case Number
              </label>
              <input
                type="text"
                placeholder="e.g., 1:24-cv-03821"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Court
              </label>
              <select
                value={courtId}
                onChange={(e) => setCourtId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 bg-white"
              >
                {FEDERAL_COURTS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-danger text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50"
          >
            {creating ? "Creating..." : "Analyze This Case"}
          </button>
        </form>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-8 pb-24 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            title: "Judge Intelligence",
            desc: "AI analysis of 50-100 recent opinions reveals ruling patterns, preferences, and tendencies.",
          },
          {
            title: "Case Strategy",
            desc: "Get judge-specific strategic recommendations tailored to your case's facts and posture.",
          },
          {
            title: "AI Companion",
            desc: "Chat with an AI that knows your judge and your case. Draft motions the way your judge reads them.",
          },
        ].map((f) => (
          <div key={f.title} className="text-center">
            <h3 className="text-white font-semibold text-lg mb-2">
              {f.title}
            </h3>
            <p className="text-white/60 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="border-t border-white/10 py-6 text-center">
        <p className="text-white/40 text-xs max-w-2xl mx-auto">
          CourtCase Companion is an intelligence tool, not a lawyer. It does not
          provide legal advice. Always verify analysis and consult with qualified
          counsel.
        </p>
      </div>
    </div>
  );
}
