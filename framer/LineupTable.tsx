import * as React from "react";

type Vessel = {
  vesselName: string | null;
  imo: string | null;
  mmsi: string | null;
  flag: string | null;
  generalType: string | null;
  detailedType: string | null;
  departedFrom: string | null;
  arrivalAt: string | null;
  navStatus: string | null;
  atd: string | null;
  ata: string | null;
  reportedEta: string | null;
  fetchedAt?: string;
  source?: string;
};

type Props = { apiBase: string; pollSeconds?: number; };

const th: React.CSSProperties = { fontWeight: 600, fontSize: 13, padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.12)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { fontSize: 13, padding: "8px 10px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", verticalAlign: "top" };

export default function LineupTable({ apiBase, pollSeconds = 0 }: Props) {
  const [list, setList] = React.useState<Vessel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [imo, setImo] = React.useState("");

  const fetchList = React.useCallback(async () => {
    try {
      setErr(null);
      const res = await fetch(`${apiBase}/api/vessels`, { cache: "no-store" });
      if (!res.ok) throw new Error(`List error ${res.status}`);
      setList(await res.json());
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    }
  }, [apiBase]);

  React.useEffect(() => {
    fetchList();
    if (pollSeconds > 0) {
      const id = setInterval(fetchList, pollSeconds * 1000);
      return () => clearInterval(id);
    }
  }, [fetchList, pollSeconds]);

  async function addByImo(e: React.FormEvent) {
    e.preventDefault();
    if (!imo) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${apiBase}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Ingest error ${res.status}`);
      setImo("");
      await fetchList();
    } catch (e: any) {
      setErr(e.message || "Failed to ingest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: "100%", color: "var(--framerTextColor, #eaeaea)" }}>
      <form onSubmit={addByImo} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={imo}
          onChange={(e) => setImo(e.target.value)}
          placeholder="Informe o IMO (ex.: 9412634)"
          style={{
            flex: 1, minWidth: 220, padding: "10px 12px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "inherit"
          }}
        />
        <button
          disabled={loading || !imo}
          style={{
            padding: "10px 16px", borderRadius: 8, border: "none",
            background: "rgba(0,128,255,0.85)", color: "#fff", cursor: "pointer",
            opacity: loading || !imo ? 0.6 : 1
          }}
        >
          {loading ? "Adicionando..." : "Adicionar por IMO"}
        </button>
      </form>

      {err && <div style={{ marginBottom: 10, color: "#ff7676", fontSize: 13 }}>{err}</div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>Vessel Name</th>
              <th style={th}>IMO</th>
              <th style={th}>MMSI</th>
              <th style={th}>Flag</th>
              <th style={th}>General vessel type</th>
              <th style={th}>Detailed vessel type</th>
              <th style={th}>Departue from</th>
              <th style={th}>Arrival at</th>
              <th style={th}>Navigational status</th>
              <th style={th}>Actual time of departure</th>
              <th style={th}>Actual time of arrival</th>
              <th style={th}>Reported ETA</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td style={{ ...td, padding: 16 }} colSpan={12}>Nenhum navio no lineup ainda.</td></tr>
            ) : list.map((v, i) => (
              <tr key={(v.imo ?? v.mmsi ?? `row-${i}`) + i}>
                <td style={td}>{v.vesselName ?? "—"}</td>
                <td style={td}>{v.imo ?? "—"}</td>
                <td style={td}>{v.mmsi ?? "—"}</td>
                <td style={td}>{v.flag ?? "—"}</td>
                <td style={td}>{v.generalType ?? "—"}</td>
                <td style={td}>{v.detailedType ?? "—"}</td>
                <td style={td}>{v.departedFrom ?? "—"}</td>
                <td style={td}>{v.arrivalAt ?? "—"}</td>
                <td style={td}>{v.navStatus ?? "—"}</td>
                <td style={td}>{fmt(v.atd)}</td>
                <td style={td}>{fmt(v.ata)}</td>
                <td style={td}>{fmt(v.reportedEta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
        Atualizado: {new Date().toLocaleString()} • Fonte: AISStream • Fuso: navegador
      </div>
    </div>
  );
}
function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}
