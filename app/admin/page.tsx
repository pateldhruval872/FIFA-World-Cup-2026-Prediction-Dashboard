import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getDataSourceLogs, getActiveModel } from "@/lib/queries";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

async function toggleAvailability(formData: FormData) {
  "use server";
  const id = String(formData.get("entryId"));
  const entry = await prisma.squadEntry.findUnique({ where: { id } });
  if (entry) {
    await prisma.squadEntry.update({
      where: { id },
      data: { isAvailable: !entry.isAvailable },
    });
    revalidatePath("/admin");
  }
}

export default async function AdminPage() {
  const [logs, model, squad] = await Promise.all([
    getDataSourceLogs(),
    getActiveModel(),
    prisma.squadEntry.findMany({
      include: { player: true, team: true },
      orderBy: [{ team: { name: "asc" } }, { player: { name: "asc" } }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Console</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Active model</h2>
          <dl className="space-y-1 text-sm">
            <Row label="Version" value={model?.version ?? "—"} />
            <Row label="Algorithm" value={model?.algorithm ?? "—"} />
            <Row label="Trained" value={model ? dateLabel(model.trainedAt) : "—"} />
          </dl>
          <p className="mt-3 text-[11px] text-ink-400">
            Retrain with <code>python3 ml/predict.py</code>; re-simulate with{" "}
            <code>python3 ml/simulate.py</code>.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Data ingestion log</h2>
          <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between border-b border-ink-100 py-1">
                <span className="font-mono">{l.source}</span>
                <span className={l.status === "success" ? "text-pitch-700" : "text-red-600"}>
                  {l.status} · {l.rowsIngested} rows · {dateLabel(l.runAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold">Squad availability</h2>
          <form action="/api/admin/logout" method="post">
            <button className="text-xs text-ink-400 hover:underline">Sign out</button>
          </form>
        </div>
        <p className="mb-3 text-[11px] text-amber-700">
          Toggling availability changes the model input. Re-run{" "}
          <code>python3 ml/predict.py</code> afterwards to refresh stored predictions.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {squad.map((s) => (
            <form key={s.id} action={toggleAvailability}
              className="flex items-center justify-between rounded-lg border border-ink-100 p-2 text-sm">
              <input type="hidden" name="entryId" value={s.id} />
              <div>
                <div className="font-medium">{s.player.name}</div>
                <div className="text-xs text-ink-400">{s.team.name} · {s.player.position}</div>
              </div>
              <button type="submit"
                className={`chip ${s.isAvailable ? "bg-pitch-500/15 text-pitch-700" : "bg-red-500/15 text-red-700"}`}>
                {s.isAvailable ? "Available" : "Out"}
              </button>
            </form>
          ))}
          {squad.length === 0 && (
            <p className="text-sm text-ink-500">
              No squads ingested. Run <code>python3 ml/ingest/squads.py</code>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
