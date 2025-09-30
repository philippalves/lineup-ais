// api/ingest.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchByIMO, NormalizedVessel } from '../lib/ais.js';
import { kvSet } from './kv.js';

declare global { // fallback memória
  // eslint-disable-next-line no-var
  var __LINEUP__: Map<string, NormalizedVessel> | undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const apiKey = process.env.AISSTREAM_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing AISSTREAM_API_KEY" });

    const { imo, mmsi, name } = (typeof req.body === 'object' ? req.body : JSON.parse(String(req.body||"{}"))) as { imo?: string; mmsi?: string; name?: string; };
    if (!imo && !mmsi && !name) {
      return res.status(400).json({ error: "Provide at least one: imo | mmsi | name" });
    }

    let vessel: NormalizedVessel | null = null;

    if (imo) {
      vessel = await fetchByIMO(apiKey, String(imo));
    } else if (mmsi) {
      // melhoria futura: fetch por MMSI direto (similar a fetchByIMO)
      vessel = await fetchByIMO(apiKey, ""); // placeholder
    } else if (name) {
      // melhoria futura: fetch por nome (pode gerar falsos positivos)
      vessel = await fetchByIMO(apiKey, ""); // placeholder
    }

    if (!vessel) return res.status(404).json({ error: "AIS not found for given input (try IMO)" });

    const key = vessel.imo || vessel.mmsi || vessel.vesselName || `vessel:${Date.now()}`;
    const saved = await kvSet(`vessel:${key}`, vessel);
    if (!saved) {
      global.__LINEUP__ ||= new Map<string, NormalizedVessel>();
      global.__LINEUP__.set(key, vessel);
    }
    return res.status(200).json(vessel);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unexpected error" });
  }
}
