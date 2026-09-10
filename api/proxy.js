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
