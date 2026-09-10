#!/usr/bin/env python3
"""
MarketView local relay + dashboard server  (zero dependencies, Python 3.8+)

Run:    python3 relay.py
Open:   http://localhost:8787/            ← the dashboard, served locally
        (same-origin → no CORS, no mixed-content, token stays on your PC)

API:    http://localhost:8787/?url=<encoded>  proxies to Dhan/NSE with
        proper headers + CORS allowed. The dashboard uses this automatically
        when it detects it is running on localhost:8787.
"""
import os, mimetypes
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.request import Request, urlopen
from urllib.parse import urlparse, parse_qs, unquote

PORT = 8787
ROOT = os.path.dirname(os.path.abspath(__file__))
ALLOWED = {"api.dhan.co", "www.nseindia.com", "images.dhan.co"}
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


class Relay(BaseHTTPRequestHandler):
    def log_message(self, *a):  # quiet
        pass

    def _cors(self, code=200, ctype="text/plain"):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Content-Type", ctype)
        self.end_headers()

    def do_OPTIONS(self):
        self._cors()

    def _fail(self, msg, code=400):
        self._cors(code)
        self.wfile.write(msg.encode())

    # ---------- static dashboard ----------
    def _static(self):
        path = unquote(urlparse(self.path).path)
        if path in ("/", ""):
            path = "/index.html"
        rel = path.lstrip("/").replace("\\", "/")
        fp = os.path.realpath(os.path.join(ROOT, rel))
        if not fp.startswith(ROOT) or not os.path.isfile(fp):
            return self._fail("not found: " + path, 404)
        ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
        with open(fp, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    # ---------- proxy ----------
    def _go(self, method):
        q = parse_qs(urlparse(self.path).query)
        target = q.get("url", [None])[0]
        if not target:
            return self._fail("usage: /?url=<encoded-target-url>")
        host = urlparse(unquote(target)).hostname
        if host not in ALLOWED:
            return self._fail("host not allowed: %s" % host, 403)
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        req = Request(unquote(target), data=body, method=method,
                      headers={"User-Agent": UA, "Accept": "application/json,*/*"})
        for h in ("access-token", "client-id", "content-type"):
            if self.headers.get(h):
                req.add_header(h, self.headers[h])
        try:
            with urlopen(req, timeout=30) as r:
                data = r.read()
                self._cors(r.status, r.headers.get("Content-Type", "application/json"))
                self.wfile.write(data)
        except Exception as e:
            code = getattr(e, "code", 502) or 502
            self._fail(str(e), code)

    def do_GET(self):
        if "url=" in self.path:
            return self._go("GET")
        self._static()

    def do_POST(self):
        self._go("POST")


if __name__ == "__main__":
    print("MarketView relay ready")
    print("  Dashboard :  http://localhost:%d/" % PORT)
    print("  Proxy API :  http://localhost:%d/?url=" % PORT)
    HTTPServer(("", PORT), Relay).serve_forever()
