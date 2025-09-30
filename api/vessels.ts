// api/vessels.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvList } from './kv.js';

declare global { var __LINEUP__: Map<string, any> | undefined; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS p/ funcionar no Framer
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  let list = await kvList("vessel:");
  if (!list) {
    const mem = global.__LINEUP__;
    list = mem ? Array.from(mem.values()) : [];
  }
  (list as any[]).sort((a, b) => {
    const ta = a.fetchedAt ? Date.parse(a.fetchedAt) : 0;
    const tb = b.fetchedAt ? Date.parse(b.fetchedAt) : 0;
    if (tb !== ta) return tb - ta;
    return (a.vesselName || "").localeCompare(b.vesselName || "");
  });
  res.status(200).json(list);
}
