"use client";

import { useState } from "react";

// Triggers the data-refresh pipeline (ingest results -> retrain -> re-simulate).
export function RefreshButton() {
  const [state, setState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function refresh() {
    setState("running");
    setMessage("Ingesting results, retraining, and re-simulating… (~30s)");
    try {
      const res = await fetch("/api/admin/refresh", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setState("ok");
        setMessage("Done. " + data.steps.map((s: { summary: string }) => s.summary).join(" · "));
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setState("error");
        setMessage(data.error ?? "Refresh failed.");
      }
    } catch (e) {
      setState("error");
      setMessage(String(e));
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={refresh} disabled={state === "running"}
        className="rounded-lg bg-pitch-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-pitch-900 disabled:opacity-50">
        {state === "running" ? "Refreshing…" : "Refresh data & predictions"}
      </button>
      {message && (
        <span className={`max-w-md text-right text-[11px] ${state === "error" ? "text-red-600" : "text-ink-500"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
