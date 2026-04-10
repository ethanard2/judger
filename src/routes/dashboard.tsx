import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600" },
  ingesting_docket: {
    label: "Pulling docket...",
    color: "bg-blue-100 text-blue-700",
  },
  ingesting_judge: {
    label: "Pulling judge opinions...",
    color: "bg-blue-100 text-blue-700",
  },
  analyzing_judge: {
    label: "Analyzing judge...",
    color: "bg-amber-100 text-amber-700",
  },
  analyzing_case: {
    label: "Analyzing case...",
    color: "bg-amber-100 text-amber-700",
  },
  ready: { label: "Ready", color: "bg-green-100 text-green-700" },
  error: { label: "Error", color: "bg-red-100 text-red-700" },
};

function DashboardPage() {
  const session = authClient.useSession();
  const navigate = useNavigate();

  const cases = useConvexQuery(
    api.cases.listByUser,
    session.data ? {} : "skip",
  );
  const isLoading = cases === undefined;

  if (!session.data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Sign in to view your cases</p>
          <button
            onClick={() => navigate({ to: "/sign-in" })}
            className="bg-primary text-white px-6 py-2 rounded-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/" })}
          className="text-primary text-xl font-bold"
        >
          CourtCase Companion
        </button>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm">
            {session.data.user.email}
          </span>
          <button
            onClick={() => authClient.signOut()}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Cases</h1>
          <button
            onClick={() => navigate({ to: "/" })}
            className="bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-lg text-sm transition"
          >
            + New Case
          </button>
        </div>

        {isLoading && (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        )}

        {cases && cases.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 mb-4">No cases yet</p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="text-primary hover:text-primary-light text-sm font-medium"
            >
              Analyze your first case
            </button>
          </div>
        )}

        <div className="space-y-4">
          {cases?.map((c) => {
            const status = STATUS_LABELS[c.status] ?? STATUS_LABELS.pending;
            return (
              <button
                key={c._id}
                onClick={() =>
                  navigate({ to: "/case/$caseId", params: { caseId: c._id } })
                }
                className="w-full bg-white rounded-xl border border-gray-200 p-6 hover:border-primary/30 hover:shadow-sm transition text-left"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {c.caseName ?? c.caseNumber}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {c.caseNumber} &middot; {c.courtName}
                    </p>
                    {c.statusMessage && c.status !== "ready" && (
                      <p className="text-xs text-gray-400 mt-2">
                        {c.statusMessage}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
