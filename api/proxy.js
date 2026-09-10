/* Vercel serverless CORS relay — same allow-list as worker.js.
   After deploying the repo to Vercel, paste this into the proxy fields:
   https://<your-app>.vercel.app/api/proxy?url=                          */
const ALLOWED = ["www.nseindia.com", "api.dhan.co", "images.dhan.co"];

export default async function handler(req, res) {
  const target = req.query.url;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!target) return res.status(400).send("usage: /api/proxy?url=<encoded-target>");

  let dest;
  try { dest = new URL(target); } catch { return res.status(400).send("bad url"); }
  if (!ALLOWED.includes(dest.hostname)) return res.status(403).send("host not allowed");

  /* Dhan scrip master is ~50MB (over Vercel's response limit) — parse it server-side
     and return only the compact NSE/BSE EQUITY symbol→securityId map (~150KB JSON) */
  if (dest.hostname === "images.dhan.co" && dest.pathname.includes("api-scrip-master")) {
    try {
      const r = await fetch(dest.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept": "text/csv,*/*" },
      });
      const txt = await r.text();
      const lines = txt.split("\n");
      const head = lines[0].split(",");
      const iS = head.indexOf("SEM_TRADING_SYMBOL"), iI = head.indexOf("SECURITY_ID"),
            iG = head.indexOf("SEM_EXM_EXCH_ID"), iN = head.indexOf("SEM_INSTRUMENT_NAME");
      const map = {};
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(",");
        if (c[iN] === "EQUITY" && (c[iG] === "NSE" || c[iG] === "BSE")) map[c[iS]] = +c[iI];
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).send(JSON.stringify(map));
    } catch (e) {
      return res.status(502).send("scrip master error: " + e.message);
    }
  }

  const h = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json,*/*",
  };
  for (const k of ["access-token", "client-id", "content-type"])
    if (req.headers[k]) h[k] = req.headers[k];

  try {
    const r = await fetch(dest.toString(), {
      method: req.method,
      headers: h,
      body: req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
    });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    return res.status(r.status).send(buf);
  } catch (e) {
    return res.status(502).send("upstream error: " + e.message);
  }
}
