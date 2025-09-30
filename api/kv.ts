// api/kv.ts
type AnyObj = Record<string, any>;

export async function kvSet(key: string, value: AnyObj) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.ok;
}

export async function kvGet(key: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const { result } = await res.json();
  try { return JSON.parse(result); } catch { return result; }
}

export async function kvList(prefix: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(`${url}/keys/${encodeURIComponent(prefix)}*`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const { result } = await res.json();
  const out: AnyObj[] = [];
  for (const k of result) {
    const v = await kvGet(k);
    if (v) out.push(v);
  }
  return out;
}
