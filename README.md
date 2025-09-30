# Lineup AIS (Seachios) — IMO → Line-up

Backend (Node/Vercel) conecta no **AISStream** por WebSocket usando sua **AISSTREAM_API_KEY**.
Você informa **IMO**, **MMSI** ou **Nome**; o backend resolve os dados AIS e salva no lineup.
O Framer consome via HTTP e mostra a tabela (.tsx).

### Deploy rápido (Vercel)
1. Fork/clone deste repo.
2. Em **Vercel → Settings → Environment Variables**:
   - `AISSTREAM_API_KEY` = sua chave do aisstream.io
   - (opcional) `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` para persistência entre execuções.
3. Deploy.

### Rodar local
```bash
cp .env.example .env   # coloque sua chave AISSTREAM_API_KEY
npm i
npm run dev
```

### Endpoints
- `POST /api/ingest`  → body: `{ "imo": "9412634" }` **ou** `{ "mmsi": "538007192" }` **ou** `{ "name": "KAMARI" }`
- `GET  /api/vessels` → lista lineup

### Campos entregues (por navio)
- Vessel Name, IMO, MMSI, Flag (derivado do MMSI), General vessel type, Detailed vessel type,
- Departue from (null no MVP), Arrival at (AIS Destination), Navigational status,
- Actual time of departure (null), Actual time of arrival (null), Reported ETA (formatado ISO quando possível).
