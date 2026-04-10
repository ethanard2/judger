import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ConvexProvider, ConvexReactClient } from "convex/react";

export function getRouter() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!;
  if (!CONVEX_URL) {
    throw new Error("Missing VITE_CONVEX_URL environment variable");
  }

  const convex = new ConvexReactClient(CONVEX_URL);

  const router = createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <ConvexProvider client={convex}>{children}</ConvexProvider>
    ),
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
