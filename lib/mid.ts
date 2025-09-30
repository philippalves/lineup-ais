// lib/mid.ts
const MID_TO_FLAG: Record<string, string> = {
  "201":"Albania","205":"Belgium","211":"Germany","219":"Denmark","224":"Spain","226":"France","227":"France","229":"Malta",
  "232":"United Kingdom","235":"United Kingdom","236":"Gibraltar","237":"Greece","240":"Greece","244":"Netherlands","247":"Italy",
  "250":"Ireland","255":"Portugal","257":"Norway","266":"Sweden","269":"Switzerland","273":"Russia","275":"Estonia",
  "303":"USA","316":"Canada",
  "351":"Panama","370":"Panama",
  "431":"Japan","440":"Korea (Republic of)","461":"India","477":"Hong Kong, China",
  "503":"Australia","533":"Malaysia","538":"Marshall Islands","563":"Singapore","565":"Singapore","566":"Singapore",
  "574":"Viet Nam",
  "710":"South Africa","725":"Chile","730":"Colombia","735":"Peru","740":"Ecuador","743":"Argentina","760":"Brazil","770":"Uruguay"
};
export function flagFromMMSI(mmsi?: string | null) {
  if (!mmsi || mmsi.length < 3) return null;
  const mid = mmsi.substring(0, 3);
  return MID_TO_FLAG[mid] ?? null;
}
