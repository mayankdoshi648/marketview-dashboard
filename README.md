# MarketView — India Market Dashboard (DhanHQ / NSE)

A dependency-free, single-page trading dashboard for the Indian stock market.

## Features
- **Market Overview** — NIFTY / BANKNIFTY / SENSEX / Large-Mid-Small cap / VIX tiles with CMP, 1D-1M % change and green/red EMA (10/20/50/200) posture; Advance-Decline, EMA-distance and VIX-vs-Nifty charts; Nifty 50 ↔ 500 toggle
- **Institutional Radar** — FII/DII 10-session net flow, volatility regime (CALM/NEUTRAL/STRESS) + IV history, Nifty option PCR gauge, Max Pain, per-strike OI/PCR/IV positioning table
- **MA Breadth Gauge** — % of stocks above 10/20/50/200 EMA across Daily/Weekly/Monthly; 7 breadth indicators with 60-point drill-down history
- **Sector Matrix** — sector tiles with EMA pills, constituent heatmap, Leading/Weakening/Lagging/Improving rotation quadrant, turnover share + CMF table
- **Universe Inspector** — full Nifty 50/500 table: watchlists, cap/sector, CMP, 1D/1W/1M %, RSI(14), 7-day sparkline, volume & spike, gap-up, EMA pills, % from 20EMA, 52W high/low position, earnings impact; search/filter/sort/CSV export
- **Pattern Scanner** — Stage-2 (7-point checklist), base breakouts, VCP, RSI divergences (bullish/bearish/hidden), pivots, oversold pullbacks
- **Notes, watchlists, templates** — 3 private watchlists + research notes per stock, all in localStorage
- **Configurable** — EMA periods, RSI, volume-spike, base depth, breakout volume, pullback guard (⚙ Settings)

## Data sources
- **Demo mode** (default) — synthetic realistic universe, everything works offline
- **Live mode (NSE + Dhan only)** — `live.js` engine: NSE `allIndices`, `equity-stockIndices`, `equity/historical`, `indicesHistory`, `fiidii` for indices/universe/candles/FII-DII; DhanHQ `/v2/optionchain` (PCR, Max Pain, IV history) + `/v2/charts/historical` for SENSEX. Sector map built from NSE sector-index constituents; breadth history computed from real candles; daily localStorage caches with incremental refresh. `worker.js` = ready-to-deploy Cloudflare Worker CORS relay (allow-listed to NSE + Dhan).

> Browsers block direct calls to `api.dhan.co` / `nseindia.com` (CORS). For live mode use a small relay (Cloudflare Worker etc.) and paste its prefix in **Data Source → proxy prefix**.

## Run
```bash
python3 -m http.server 8080   # then open http://localhost:8080
```
No build step. No dependencies.

## Files
| File | Purpose |
|---|---|
| `index.html` | Layout: sidebar + sections + modals |
| `styles.css` | Dark trading-terminal theme |
| `app.js` | Data layer, indicators (EMA/RSI/pivots), pattern engine, renderers |
