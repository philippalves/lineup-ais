// api/ingest.ts — GET/POST + CORS + controle de tempo de espera
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchByIMO } from '../lib/ais.js';
import { kvSet } from './kv.js';

declare global { var __LINEUP__: Map<string, any> | undefined; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS para funcionar no Framer
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const apiKey = process.env.AISSTREAM_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing AISSTREAM_API_KEY" });

    // Pode vir por GET (?imo=...&wait=60000) ou por POST { imo, waitMs }
    let imo = "";
    let waitMs = 60000; // 60s padrão
    if (req.method === "GET") {
      imo = String(req.query.imo || "");
      if (req.query.wait) {
        const w = Number(req.query.wait);
        if (!Number.isNaN(w)) waitMs = Math.max(5000, w);
      }
    } else if (req.method === "POST") {
      const body = typeof req.body === 'object' ? req.body : JSON.parse(String(req.body||"{}"));
      imo = String(body?.imo || "");
      if (body?.waitMs) {
        const w = Number(body.waitMs);
        if (!Number.isNaN(w)) waitMs = Math.max(5000, w);
      }
    } else {
      return res.status(405).json({ error: "Use GET or POST" });
    }

    if (!imo) return res.status(400).json({ error: "Informe o IMO (ex.: 9412634)" });

    const vessel = await fetchByIMO(apiKey, imo, waitMs);
    if (!vessel) return res.status(404).json({ error: "AIS não encontrado para este IMO (tente novamente mais tarde)" });

    const key = vessel.imo || vessel.mmsi || vessel.vesselName || `vessel:${Date.now()}`;
    const saved = await kvSet(`vessel:${key}`, vessel);
    if (!saved) {
      global.__LINEUP__ ||= new Map<string, any>();
      global.__LINEUP__.set(key, vessel);
    }
    return res.status(200).json(vessel);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unexpected error" });
  }
}
