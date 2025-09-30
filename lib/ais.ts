// lib/ais.ts
import WebSocket from "ws";
import { flagFromMMSI } from "./mid.js";
import { mapShipTypeToText } from "./shiptype.js";

export type NormalizedVessel = {
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
  source?: string;
  fetchedAt?: string;
};

const WSS = "wss://stream.aisstream.io/v0/stream";

// Conecta ao AISStream com bounding box global e (opcional) filtros.
// Retorna a primeira mensagem que passar no predicate, ou null se der timeout.
async function waitForMessage<T>(
  apiKey: string,
  subscribe: Record<string, any>,
  predicate: (m: any) => T | null,
  timeoutMs = 10_000
): Promise<T | null> {
  return new Promise((resolve) => {
    const ws = new WebSocket(WSS);
    let done = false;
    const finish = (val: T | null) => {
      if (done) return;
      done = true;
      try { ws.close(); } catch {}
      resolve(val);
    };
    const t = setTimeout(() => finish(null), timeoutMs);

    ws.on("open", () => {
      const msg = {
        APIKey: apiKey,
        BoundingBoxes: [[[-90, -180], [90, 180]]], // mundo inteiro
        ...subscribe
      };
      ws.send(JSON.stringify(msg));
    });

    ws.on("message", (buf) => {
      try {
        const data = JSON.parse(buf.toString());
        const res = predicate(data);
        if (res) {
          clearTimeout(t);
          finish(res);
        }
      } catch { /* ignora pacote inválido */ }
    });

    ws.on("error", () => finish(null));
    ws.on("close", () => finish(null));
  });
}

function navStatusText(code: any): string | null {
  const c = Number(code);
  const map: Record<number,string> = {
    0:"Under way using engine",1:"At anchor",2:"Not under command",3:"Restricted manoeuverability",
    4:"Constrained by draught",5:"Moored",6:"Aground",7:"Engaged in fishing",8:"Under way sailing",
    14:"AIS-SART active",15:"Undefined"
  };
  if (Number.isNaN(c)) return typeof code === "string" ? code : null;
  return map[c] ?? `Code ${c}`;
}
function pad2(n: number){ return n<10?`0${n}`:`${n}`; }
function formatEta(eta: any): string | null {
  if (!eta) return null;
  if (typeof eta === "string") return eta;
  const y = new Date().getUTCFullYear();
  const mm = Number(eta.Month ?? eta.month);
  const dd = Number(eta.Day ?? eta.day);
  const hh = Number(eta.Hour ?? eta.hour);
  const mi = Number(eta.Minute ?? eta.minute);
  if ([mm,dd,hh,mi].some(Number.isNaN)) return null;
  return `${y}-${pad2(mm)}-${pad2(dd)}T${pad2(hh)}:${pad2(mi)}:00Z`;
}

// Resolve por IMO (procura ShipStaticData com mesmo ImoNumber).
export async function fetchByIMO(apiKey: string, imo: string): Promise<NormalizedVessel | null> {
  const staticHit = await waitForMessage(
    apiKey,
    { FilterMessageTypes: ["ShipStaticData"] },
    (m) => {
      const type = m?.MessageType;
      if (type !== "ShipStaticData") return null;
      // Alguns payloads usam MetaData, outros Metadata
      const metadata = m?.MetaData || m?.Metadata || {};
      const body = m?.Message?.ShipStaticData || m?.Message?.ShipStaticDataExtended || {};
      const foundImo = String(body?.ImoNumber ?? "");
      if (!foundImo || foundImo !== String(imo)) return null;

      const mmsi = String(metadata?.MMSI ?? body?.UserID ?? "");
      const name = body?.Name ?? metadata?.ShipName ?? null;
      const { general, detailed } = mapShipTypeToText(Number(body?.Type));
      const dest = body?.Destination ?? null;
      const eta = formatEta(body?.Eta);

      const vessel: NormalizedVessel = {
        vesselName: name ?? null,
        imo: foundImo || null,
        mmsi: mmsi || null,
        flag: flagFromMMSI(mmsi),
        generalType: general ?? null,
        detailedType: detailed ?? null,
        departedFrom: null,       // sem port-calls no AIS puro
        arrivalAt: dest || null,  // Destination do AIS
        navStatus: null,          // vamos tentar obter no passo 2
        atd: null,
        ata: null,
        reportedEta: eta,
        source: "AISStream",
        fetchedAt: new Date().toISOString()
      };
      return vessel;
    },
    10000
  );

  if (!staticHit || !staticHit.mmsi) return staticHit ?? null;

  // Passo 2: pega NavigationalStatus via PositionReport filtrando pelo MMSI encontrado
  const pos = await waitForMessage(
    apiKey,
    { FiltersShipMMSI: [staticHit.mmsi], FilterMessageTypes: ["PositionReport"] },
    (m) => {
      if (m?.MessageType !== "PositionReport") return null;
      const body = m?.Message?.PositionReport || {};
      return navStatusText(body?.NavigationalStatus) || ""; // só pra considerar "truthy"
    },
    6000
  );

  if (pos) {
    return { ...staticHit, navStatus: pos as string };
  }
  return staticHit;
}
