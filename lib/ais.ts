// lib/ais.ts — VERSÃO ROBUSTA
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

// -------- utils
function pad2(n: number){ return n<10?`0${n}`:`${n}`; }
function formatEta(eta: any): string | null {
  if (!eta) return null;
  if (typeof eta === "string") return eta;
  const y = new Date().getUTCFullYear();
  const MM = Number(eta.Month ?? eta.month);
  const DD = Number(eta.Day ?? eta.day);
  const HH = Number(eta.Hour ?? eta.hour);
  const MI = Number(eta.Minute ?? eta.minute);
  if ([MM,DD,HH,MI].some(Number.isNaN)) return null;
  return `${y}-${pad2(MM)}-${pad2(DD)}T${pad2(HH)}:${pad2(MI)}:00Z`;
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

// -------- assinatura genérica no stream
function subscribe(ws: WebSocket, apiKey: string, extra: Record<string, any> = {}) {
  // Colocamos a key na query (ao abrir) e também no corpo abaixo,
  // porque alguns exemplos do AISStream aceitam "Apikey" e outros "APIKey".
  const msg = {
    Apikey: apiKey,
    APIKey: apiKey,
    BoundingBoxes: [[[-90,-180],[90,180]]],
    ...extra
  };
  ws.send(JSON.stringify(msg));
}

// -------- aguarda mensagens até bater o predicate (ou timeout)
async function waitUntil<T>(
  apiKey: string,
  extraSubscribe: Record<string, any>,
  predicate: (m: any) => T | null,
  timeoutMs = 15000
): Promise<T | null> {
  return new Promise((resolve) => {
    // importa a key também na URL (compatibilidade)
    const ws = new WebSocket(`${WSS}?apikey=${encodeURIComponent(apiKey)}`);
    let done = false;
    const finish = (val: T | null) => { if (done) return; done = true; try{ws.close();}catch{} resolve(val); };
    const timer = setTimeout(() => finish(null), timeoutMs);

    ws.on("open", () => subscribe(ws, apiKey, extraSubscribe));
    ws.on("message", (buf) => {
      try {
        const data = JSON.parse(buf.toString());
        const match = predicate(data);
        if (match) { clearTimeout(timer); finish(match); }
      } catch { /* ignora pacotes inválidos */ }
    });
    ws.on("error", () => finish(null));
    ws.on("close", () => finish(null));
  });
}

// -------- parser defensivo
function parseStatic(msg: any) {
  const type = msg?.MessageType || msg?.messageType;
  if (String(type).toLowerCase() !== "shipstaticdata") return null;

  const md = msg?.MetaData || msg?.Metadata || {};
  const body =
    msg?.Message?.ShipStaticData ||
    msg?.Message?.ShipStaticDataExtended ||
    msg?.ShipStaticData ||
    msg?.ShipStaticDataExtended ||
    msg?.Message ||
    {};

  const imo = String(body?.ImoNumber ?? body?.IMO ?? body?.ImoNo ?? "");
  const mmsi = String(md?.MMSI ?? body?.UserID ?? body?.MMSI ?? "");
  const name = body?.Name ?? md?.ShipName ?? null;
  const shipType = Number(body?.Type ?? body?.ShipType ?? NaN);
  const dest = body?.Destination ?? null;
  const eta = formatEta(body?.Eta ?? body?.ETA);

  const { general, detailed } = mapShipTypeToText(Number.isNaN(shipType) ? undefined : shipType);

  return {
    imo: imo || null,
    mmsi: mmsi || null,
    vesselName: name ?? null,
    generalType: general ?? null,
    detailedType: detailed ?? null,
    arrivalAt: dest || null,
    reportedEta: eta ?? null
  };
}

function parsePosition(msg: any) {
  const type = msg?.MessageType || msg?.messageType;
  if (String(type).toLowerCase() !== "positionreport") return null;
  const body = msg?.Message?.PositionReport || msg?.PositionReport || {};
  return navStatusText(body?.NavigationalStatus);
}

// -------- API principal: IMO -> dados
export async function fetchByIMO(apiKey: string, imoWant: string): Promise<NormalizedVessel | null> {
  // 1) ShipStaticData com o IMO pedido
  const staticHit = await waitUntil(
    apiKey,
    { FilterMessageTypes: ["ShipStaticData"] },
    (m) => {
      const s = parseStatic(m);
      if (!s || !s.imo) return null;
      if (String(s.imo) !== String(imoWant)) return null;
      const v: NormalizedVessel = {
        vesselName: s.vesselName,
        imo: s.imo,
        mmsi: s.mmsi,
        flag: s.mmsi ? flagFromMMSI(s.mmsi) : null,
        generalType: s.generalType,
        detailedType: s.detailedType,
        departedFrom: null,
        arrivalAt: s.arrivalAt,
        navStatus: null,
        atd: null,
        ata: null,
        reportedEta: s.reportedEta,
        source: "AISStream",
        fetchedAt: new Date().toISOString()
      };
      return v;
    },
    20000 // espera até 20s para achar o IMO certo
  );

  if (!staticHit || !staticHit.mmsi) return staticHit ?? null;

  // 2) Pega NavigationalStatus filtrando por MMSI
  const nav = await waitUntil(
    apiKey,
    { FiltersShipMMSI: [staticHit.mmsi], FilterMessageTypes: ["PositionReport"] },
    (m) => {
      const n = parsePosition(m);
      return n ? n : null;
    },
    8000
  );

  return nav ? { ...staticHit, navStatus: nav } : staticHit;
}
