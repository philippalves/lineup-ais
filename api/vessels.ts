// api/vessels.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kvList } from './kv.js';
import type { NormalizedVessel } from '../lib/ais.js';

declare global {
  // eslint-disable-next-line no-var
  var __LINEUP__: Map<string, NormalizedVessel> | undefined;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  let list = await kvList("vessel:");
  if (!list) {
    const mem = global.__LINEUP__;
    list = mem ? Array.from(mem.values()) : [];
  }
  (list as NormalizedVessel[]).sort((a, b) => {
    const ta = a.fetchedAt ? Date.parse(a.fetchedAt) : 0;
    const tb = b.fetchedAt ? Date.parse(b.fetchedAt) : 0;
    if (tb !== ta) return tb - ta;
    return (a.vesselName || "").localeCompare(b.vesselName || "");
  });
  res.status(200).json(list);
}
