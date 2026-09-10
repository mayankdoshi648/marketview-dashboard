/* ============================================================
   Cloudflare Worker — CORS relay for NSE + DhanHQ
   Deploy:  npm i -g wrangler → wrangler deploy
   Then paste  https://<your-worker>.<your-subdomain>.workers.dev/?url=
   into the dashboard's "proxy prefix" fields.
   ============================================================ */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) return new Response("usage: ?url=<encoded-target>", { status: 400 });

    let dest;
    try { dest = new URL(target); } catch { return new Response("bad url", { status: 400 }); }

    // allow-list: NSE public API + DhanHQ only
    const ok = (dest.hostname === "www.nseindia.com" || dest.hostname === "api.dhan.co");
    if (!ok) return new Response("host not allowed", { status: 403 });

    const headers = new URLSearchParams(url.searchParams.get("headers") || "");
    const h = new Headers();
    h.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
    h.set("Accept", headers.get("Accept") || "application/json,text/plain,*/*");
    h.set("Accept-Language", "en-US,en;q=0.9");
    // forward Dhan auth headers from the client (access-token / client-id)
    ["access-token", "client-id", "content-type"].forEach(k => {
      const v = request.headers.get(k) || headers.get(k);
      if (v) h.set(k, v);
    });

    const init = { method: request.method, headers: h, redirect: "follow" };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

    const resp = await fetch(dest.toString(), init);
    const out = new Response(resp.body, resp);
    out.headers.set("Access-Control-Allow-Origin", "*");
    out.headers.set("Access-Control-Allow-Headers", "*");
    out.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    out.headers.set("Access-Control-Max-Age", "86400");
    return out;
  }
};
