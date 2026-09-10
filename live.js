/* ============================================================
   live.js — Real data engine: NSE (indices, constituents,
   historical candles, FII/DII, sector indices) + DhanHQ
   (option chain PCR/MaxPain/IV, SENSEX candles).
   Builds the exact same DATA shape as the demo builder.
   ============================================================ */
"use strict";

const LiveEngine = {
  queue: Promise.resolve(),
  /* serialized requests with politeness delay (NSE rate-limits hard) */
  nse(path, delay=380){
    const run=()=>new Promise((res,rej)=>setTimeout(async()=>{
      try{ res(await NSE.get(path)); }catch(e){ rej(e); }
    }, delay));
    this.queue=this.queue.catch(()=>{}).then(run, run);
    return this.queue;
  },
  dhan(path, opts={}){ return fetch(Dhan.url(path),{...opts, headers:Dhan.hdr()}).then(r=>{ if(!r.ok) throw new Error("Dhan "+r.status); return r.json(); }); },

  /* ---------- date helpers ---------- */
  dmy(d){ return d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"}).split("/").join("-"); },
  ymd(d){ return d.toISOString().slice(0,10); },

  /* ---------- caches (localStorage, keyed by day) ---------- */
  cacheGet(k){
    try{ const it=JSON.parse(localStorage.getItem("mv-"+k)||"null");
      if(it && it.day===this.dmy(new Date())) return it.v; }catch(e){}
    return null;
  },
  cacheSet(k,v){ try{ localStorage.setItem("mv-"+k, JSON.stringify({day:this.dmy(new Date()), v})); }catch(e){} },

  candleCacheGet(sym){
    try{ const it=JSON.parse(localStorage.getItem("mv-c-"+sym)||"null");
      if(it && it.to>=this.ymd(new Date())) return it.candles; }catch(e){}
    return null;
  },
  candleCacheSet(sym,to,candles){ try{ localStorage.setItem("mv-c-"+sym, JSON.stringify({to,candles})); }catch(e){} },

  /* ---------- NSE parsers ---------- */
  async indexRows(){ // allIndices → map name→row
    const j=await this.nse("/api/allIndices");
    const map={};
    (j.data||[]).forEach(r=>{ map[r.index]=r; });
    return map;
  },
  async constituents(indexName){
    const ck="const-"+indexName, hit=this.cacheGet(ck); if(hit) return hit;
    const j=await this.nse("/api/equity-stockIndices?index="+encodeURIComponent(indexName));
    const rows=(j.data||[]).map(r=>({
      sym:r.symbol, name:r.meta?.companyName||r.symbol, open:+r.open, high:+r.dayHigh, low:+r.dayLow,
      cmp:+r.lastPrice, prev:+r.previousClose, chg1d:+r.change, pChange:+r.pChange,
      vol:+r.totalTradedVolume, value:+r.totalTradedValue,
      hi52:+r.yearHigh, lo52:+r.yearLow, per365:+r.perChange365dAgo||null
    }));
    this.cacheSet(ck, rows);
    return rows;
  },
  async equityHistory(sym, days=420){
    /* Dhan candle source (needs Dhan connected) */
    const tryDhan=async()=>{
      const hit=this.candleCacheGet("d"+sym);
      if(hit) return hit;
      const candles=await this.dhanEquityHistory(sym, days);
      if(candles.length) this.candleCacheSet("d"+sym, this.ymd(new Date()), candles);
      return candles;
    };
    /* preferred order: checkbox decides; whichever is chosen, the other is the fallback */
    const order=(SET.preferDhanCandles||!SET.nseProxy)?["dhan","nse"]:["nse","dhan"];
    for(const src of order){
      try{
        if(src==="dhan"){ if(SET.dhan.token){ const cd=await tryDhan(); if(cd.length) return cd; } }
        else { const cd=await this.nseEquityHistory(sym, days); if(cd.length) return cd; }
      }catch(e){ console.warn(src+" candles failed for",sym,":",e.message); }
    }
    return [];
  },
  async nseEquityHistory(sym, days=420){
    const hit=this.candleCacheGet(sym);
    const to=new Date();
    if(hit){ // incremental: only fetch sessions after the last cached date
      const lastD=hit.at(-1)?.d?new Date(hit.at(-1).d):null;
      if(lastD && (to-lastD)<7*864e5) return hit;
      const from=new Date(lastD?lastD.getTime()-5*864e5:Date.now()-days*864e5);
      try{
        const j=await this.nse(`/api/equity/historical/${encodeURIComponent(sym)}?series=%5B%22EQ%22%5D&from=${this.dmy(from)}&to=${this.dmy(to)}`);
        const fresh=(j.data||[]).map(r=>({
          d:r.CH_TIMESTAMP, o:+r.CH_OPENING_PRICE, h:+r.CH_TRADE_HIGH_PRICE, l:+r.CH_TRADE_LOW_PRICE,
          c:+r.CH_CLOSING_PRICE, v:+r.CH_TOT_TRADED_QTY
        })).filter(x=>!isNaN(x.c));
        const seen=new Set(hit.map(x=>x.d));
        const merged=hit.concat(fresh.filter(x=>!seen.has(x.d)));
        if(merged.length) this.candleCacheSet(sym, this.ymd(to), merged);
        return merged;
      }catch(e){ console.warn("incremental hist failed",sym,e.message); return hit; }
    }
    const from=new Date(Date.now()-days*864e5);
    const j=await this.nse(`/api/equity/historical/${encodeURIComponent(sym)}?series=%5B%22EQ%22%5D&from=${this.dmy(from)}&to=${this.dmy(to)}`);
    const candles=(j.data||[]).map(r=>({
      d:r.CH_TIMESTAMP, o:+r.CH_OPENING_PRICE, h:+r.CH_TRADE_HIGH_PRICE, l:+r.CH_TRADE_LOW_PRICE,
      c:+r.CH_CLOSING_PRICE, v:+r.CH_TOT_TRADED_QTY
    })).filter(x=>!isNaN(x.c));
    if(candles.length) this.candleCacheSet(sym, this.ymd(to), candles);
    return candles;
  },
  async indexHistory(indexType, days=420){
    const ck="ih-"+indexType, hit=this.cacheGet(ck); if(hit) return hit;
    const to=new Date(), from=new Date(Date.now()-days*864e5);
    const j=await this.nse(`/api/historical/indicesHistory?indexType=${encodeURIComponent(indexType)}&from=${this.dmy(from)}&to=${this.dmy(to)}`);
    const candles=(j.data||[]).map(r=>{
      const close=+((r.EOD_CLOSE_INDEX_VAL??r.CLOSE??r.close)??NaN);
      return { d:r.EOD_TIMESTAMP??r.TIMESTAMP??r.date, o:+(r.EOD_OPEN_INDEX_VAL??r.OPEN??open??NaN)||close,
        h:+(r.EOD_HIGH_INDEX_VAL??r.HIGH??NaN)||close, l:+(r.EOD_LOW_INDEX_VAL??r.LOW??NaN)||close,
        c:close, v:0 };
    }).filter(x=>!isNaN(x.c));
    if(candles.length) this.cacheSet(ck, candles);
    return candles;
  },
  async fiiDii(){
    const ck="fiidii", hit=this.cacheGet(ck); if(hit) return hit;
    const j=await this.nse("/api/fiidii");
    const rows=Array.isArray(j)?j:[];
    const out={ fii:[], dii:[], dates:[] };
    rows.slice(-10).forEach(r=>{
      const net=parseFloat(String(r.netValue||"0").replace(/,/g,""))||0;
      (r.category||"").toLowerCase().includes("foreign")?out.fii.push(Math.round(net)):out.dii.push(Math.round(net));
      out.dates.push(r.date||"");
    });
    if(out.fii.length) this.cacheSet(ck, out);
    return out;
  },
  async dhanCandles(secId, seg, inst, days=420){
    const ck="dc-"+secId, hit=this.cacheGet(ck); if(hit) return hit;
    const to=new Date(), from=new Date(Date.now()-days*864e5);
    const j=await this.dhan("/v2/charts/historical",{method:"POST",
      body:JSON.stringify({securityId:String(secId), exchangeSegment:seg, instrument:inst, interval:"1", fromDate:this.ymd(from), toDate:this.ymd(to)})});
    const n=j.close?.length||0, candles=[];
    for(let i=0;i<n;i++) candles.push({d:j.timestamp?.[i]?new Date(+j.timestamp[i]).toISOString().slice(0,10):"",
      o:+j.open[i],h:+j.high[i],l:+j.low[i],c:+j.close[i],v:+(j.volume?.[i]??0)});
    if(candles.length) this.cacheSet(ck, candles);
    return candles;
  },
  /* Dhan scrip master → symbol→securityId (proxy parses the ~50MB CSV server-side into compact JSON) */
  async dhanScripMap(){
    const ck="sm", hit=this.cacheGet(ck); if(hit) return hit;
    let txt=null;
    if(SET.dhan.proxy){
      try{ const r=await fetch(proxyUrl(SET.dhan.proxy,"https://images.dhan.co/api_data/api-scrip-master.csv")); if(r.ok) txt=await r.text(); }catch(e){ console.warn("scrip via proxy failed:",e.message); }
    }
    if(!txt){ try{ const r=await fetch("https://images.dhan.co/api_data/api-scrip-master.csv"); if(r.ok) txt=await r.text(); }catch(e){} }
    if(!txt) throw new Error("scrip master unreachable");
    let map=null;
    if(txt.trim().startsWith("{")){ try{ map=JSON.parse(txt); }catch(e){} }
    if(!map){
      const lines=txt.split("\n"), head=lines[0].split(",");
      const iS=head.indexOf("SEM_TRADING_SYMBOL"), iI=head.indexOf("SECURITY_ID"), iG=head.indexOf("SEM_EXM_EXCH_ID"), iN=head.indexOf("SEM_INSTRUMENT_NAME");
      map={};
      for(let i=1;i<lines.length;i++){ const c=lines[i].split(","); if(c[iN]==="EQUITY"&&(c[iG]==="NSE"||c[iG]==="BSE")) map[c[iS]]=+c[iI]; }
    }
    this.cacheSet(ck,map);
    return map;
  },
  async dhanEquityHistory(sym, days=420){
    const map=await this.dhanScripMap();
    const id=map[sym];
    if(!id) throw new Error("no Dhan securityId for "+sym);
    return this.dhanCandles(id,"NSE_EQ","EQUITY",days);
  },
  async dhanOptionChain(){
    const j=await this.dhan("/v2/optionchain?securityId=13&exchangeSegment=NSE_INDEX&instrument=IDX");
    const raw=(j?.data?.oc)||(j?.oc)||(Array.isArray(j?.data)?j.data:[]);
    const strikes=[];
    raw.forEach(r=>{
      const s=+(r.strike_price??r.strike??0);
      if(!s) return;
      strikes.push({ strike:s,
        ceOi:+(r.ce?.oi??r.ce_oi??r.ce?.oi_data?.oi??0), peOi:+(r.pe?.oi??r.pe_oi??r.pe?.oi_data?.oi??0),
        ceIv:+(r.ce?.iv??r.ce_iv??r.greeks?.ce??0)||null, peIv:+(r.pe?.iv??r.pe_iv??r.greeks?.pe??0)||null });
    });
    if(!strikes.length) throw new Error("empty option chain");
    strikes.sort((a,b)=>a.strike-b.strike);
    // PCR + Max Pain
    let ce=0, pe=0;
    strikes.forEach(s=>{ce+=s.ceOi;pe+=s.peOi;});
    let maxPain=strikes[0].strike, minLoss=Infinity;
    strikes.forEach(K=>{
      let loss=0;
      strikes.forEach(s=>{ loss+=s.ceOi*Math.max(0,K.strike-s.strike)+s.peOi*Math.max(0,s.strike-K.strike); });
      if(loss<minLoss){minLoss=loss;maxPain=K.strike;}
    });
    const pcr=ce?pe/ce:1;
    // ATM IV snapshot → history
    const spot=+((j?.data?.underlying_price??j?.underlying_price)??DATA?.indices?.[0]?.cmp??0);
    let atmIv=null;
    if(spot){ const atm=strikes.reduce((a,b)=>Math.abs(b.strike-spot)<Math.abs(a.strike-spot)?b:a);
      atmIv=atm.ceIv||atm.peIv||null; }
    let ivHist=this.cacheGet("ivhist")||[];
    if(atmIv){ ivHist.push(+atmIv.toFixed(2)); ivHist=ivHist.slice(-20); this.cacheSet("ivhist", ivHist); }
    return { strikes, pcr:+pcr.toFixed(2), maxPain, ivHist:ivHist.length?ivHist:[+((atmIv||12).toFixed(2))] };
  }
};

/* ---------- sector index mapping (NSE sector indices → display sectors) ---------- */
const SECTOR_INDEX_MAP=[
  ["NIFTY IT","IT"],["NIFTY BANK","Financials"],["NIFTY FINANCIAL SERVICES","Financials"],
  ["NIFTY PSU BANK","Financials"],["NIFTY PRIVATE BANK","Financials"],["NIFTY PHARMA","Pharma"],
  ["NIFTY HEALTHCARE","Healthcare"],["NIFTY FMCG","FMCG"],["NIFTY AUTO","Auto"],
  ["NIFTY METAL","Metals & Mining"],["NIFTY ENERGY","Energy"],["NIFTY OIL & GAS","Energy"],
  ["NIFTY INFRASTRUCTURE","Industrials"],["NIFTY INDIA MANUFACTURING","Industrials"],
  ["NIFTY INDIA DEFENCE","Industrials"],["NIFTY REALTY","Realty"],["NIFTY CONSUMPTION","Consumer"],
  ["NIFTY MEDIA","Media"],["NIFTY CHEMICALS","Chemicals"],["NIFTY RETAIL","Consumer"],
  ["NIFTY TRANSPORTATION","Industrials"],["NIFTY PSE","Utilities"],["NIFTY SERVICES?","—"]
].filter(x=>x[1]!=="—");

const INDEX_SPECS=[
 {id:"NIFTY",    nse:"NIFTY 50",     dId:{id:"13", seg:"NSE_INDEX"}},
 {id:"BANKNIFTY",nse:"NIFTY BANK",   dId:{id:"25", seg:"NSE_INDEX"}},
 {id:"SENSEX",   dhan:{secId:"51",seg:"BSE_INDEX"}},
 {id:"LARGECAP", nse:"NIFTY 100"},
 {id:"MIDCAP",   nse:"NIFTY MIDCAP 150", dId:{id:"442", seg:"NSE_INDEX"}},
 {id:"SMALLCAP", nse:"NIFTY SMALLCAP 250"},
 {id:"VIX",      nse:"INDIA VIX", isVix:true}
];

/* ---------- helpers ---------- */
async function batch(items, fn, conc=3, onProg=null){
  const out=new Array(items.length); let i=0, done=0;
  async function worker(){
    while(i<items.length){
      const k=i++;
      try{ out[k]=await fn(items[k],k); }catch(e){ console.warn("batch fail:",items[k],e.message); out[k]=null; }
      done++; if(onProg&&done%10===0) onProg(done,items.length);
    }
  }
  await Promise.all(Array.from({length:Math.min(conc,items.length)},worker));
  return out;
}
function buildCandleTFs(daily){
  return {D:daily, W:resampleWeekly(daily), M:resampleMonthly(daily)};
}
function emaMap(closes){
  const m={};
  SET.emas.forEach(p=>{ m[p]=closes.length>=Math.min(p,5)?ema(closes,p):null; });
  return m;
}
function mkAbove(cmp, emaV){ return p=>emaV[p]==null?null:cmp>emaV[p]; }

/* ---------- stock assembler ---------- */
function liveStock(row, candles, sector){
  const D=candles.length>=30?candles:[];
  const TFs=buildCandleTFs(D.length?D:[{o:row.cmp,h:row.cmp,l:row.cmp,c:row.cmp,v:row.vol||0}]);
  const closes=D.map(x=>x.c), c=closes.at(-1)??row.cmp;
  const ref=(n)=>closes.length>n?(c/closes[closes.length-1-n]-1)*100:null;
  const cw=ref(5), cm=ref(21);
  const emaV=emaMap(closes);
  const v9=D.length>10?avg(D.slice(-10,-1).map(x=>x.v)):null;
  const hi52=(row.hi52>0?row.hi52:null)??(D.length?Math.max(...D.slice(-260).map(x=>x.h)):null);
  const lo52=(row.lo52>0?row.lo52:null)??(D.length?Math.min(...D.slice(-260).map(x=>x.l)):null);
  return {
    sym:row.sym, name:row.name, sector, cap:"S",
    candles:TFs, cmp:c,
    chg1d:row.pChange??(closes.length>1?(c/closes.at(-2)-1)*100:null),
    chg1w:cw==null?null:+cw.toFixed(2), chg1m:cm==null?null:+cm.toFixed(2),
    rsi:D.length>SET.rsiPeriod?+rsi(closes,SET.rsiPeriod).toFixed(1):null,
    ema:emaV, above:mkAbove(c,emaV),
    emaPct20:emaV[20]!=null?+((c/emaV[20]-1)*100).toFixed(2):null,
    belowHigh:hi52?+((c/hi52-1)*100).toFixed(2):null,
    aboveLow:lo52?+((c/lo52-1)*100).toFixed(2):null,
    vol:row.vol??D.at(-1)?.v??0,
    volSpike:v9?+(D.at(-1).v/v9).toFixed(2):null,
    gapUp:D.length>1?+((D.at(-1).o/D.at(-2).c-1)*100).toFixed(2):null,
    prevEarning:"—", earnImpact:null, nextEarning:"—"
  };
}
function assignCaps(uni){
  // Large = Nifty 100 members, Mid = Nifty 500 minus (Nifty 100 + Next 50)... simplified:
  // Large: top 100 by traded value; Mid: 101–350; Small: rest — refreshed daily.
  const byVal=[...uni].sort((a,b)=>b.value-a.value);
  byVal.forEach((s,i)=>{ s.cap = i<100?"L":i<350?"M":"S"; });
}
function compositeSector(members){
  // equal-weight composite index from member closes (real data, no synthetic prices)
  if(!members.length||!members[0].candles.D.length) return null;
  const len=Math.min(...members.map(m=>m.candles.D.length).filter(x=>x>30), 300);
  if(!len||len<30) return null;
  const base=1000;
  const daily=[];
  for(let i=0;i<len;i++){
    let r=0, n=0;
    members.forEach(m=>{ const cd=m.candles.D; if(cd.length>30){ r+=cd[cd.length-len+i].c/cd[cd.length-len].c; n++; } });
    const rel=r/(n||1);
    daily.push({o:base*rel,h:base*rel*1.002,l:base*rel*0.998,c:base*rel,v:0});
  }
  return daily;
}
function sectorAgg(sec, members){
  const daily=compositeSector(members);
  const chg=(f)=>members.length?+avg(members.map(m=>m[f]??0)).toFixed(2):null;
  const emaV=daily?emaMap(daily.map(x=>x.c)):{};
  const c=daily?daily.at(-1).c:0;
  const adv=members.filter(m=>(m.chg1d??0)>0).length, dec=members.filter(m=>(m.chg1d??0)<0).length;
  return { sec, name:sec, members, candles:buildCandleTFs(daily||[{o:0,h:0,l:0,c:0,v:0}]),
    cmp:+c.toFixed(1), chg1d:chg("chg1d"), chg1w:chg("chg1w"), chg1m:chg("chg1m"),
    ema:emaV, above:mkAbove(c,emaV),
    turnover:members.reduce((a,m)=>a+(m.value||0),0), adv, dec };
}
/* ---------- real breadth history (60 sessions × D/W/M) ---------- */
function buildBreadthHist(uni){
  const ck="bh", hit=LiveEngine.cacheGet(ck);
  if(hit && hit.n===uni.length) return hit.v;
  const H=60, inds=["ema20","ema50","ema200","rsi55","ad","pivot"], tfs=["D","W","M"];
  const hist={};
  tfs.forEach(tf=>{
    hist[tf]={};
    inds.forEach(ind=>hist[tf][ind]=[]);
    const usable=uni.filter(s=>s.candles[tf].length>40);
    // precompute indicator series per stock
    const series=usable.map(s=>{
      const cd=s.candles[tf], closes=cd.map(x=>x.c);
      const em={}; SET.emas.forEach(p=>em[p]=emaSeries(closes,p));
      const r=rsiSeries(closes,SET.rsiPeriod);
      return {closes, em, r, cd};
    });
    for(let h=H-1;h>=0;h--){
      const cnt={ema20:0,ema50:0,ema200:0,rsi55:0,ad:0,pivot:0};
      series.forEach(({closes,em,r,cd})=>{
        const t=closes.length-1-h; if(t<210&&tf==="D") { /* still count — EMA warm from full series */ }
        if(t<1) return;
        const c=closes[t];
        if(em[20][t]&&c>em[20][t])cnt.ema20++;
        if(em[50][t]&&c>em[50][t])cnt.ema50++;
        if(em[200]&&em[200][t]&&c>em[200][t])cnt.ema200++;
        if(r[t]>55)cnt.rsi55++;
        if(c>closes[t-1])cnt.ad++;
        const pv=cd[t-1]; const P=(pv.h+pv.l+pv.c)/3;
        if(c>P)cnt.pivot++;
      });
      const n=series.length||1;
      inds.forEach(ind=>hist[tf][ind][H-1-h]=+(cnt[ind]/n*100).toFixed(1));
    }
  });
  const v={...hist};
  LiveEngine.cacheSet(ck,{n:uni.length,v});
  return v;
}

/* ---------- master refresh ---------- */
LiveEngine.refresh=async function(manual=false){
  const box=$("#nse-status");
  try{
    toast("Live sync started…");
    let idxRows={};
    try{ idxRows=await LiveEngine.indexRows(); }
    catch(e){ console.warn("NSE indices unavailable — using Dhan for index tiles:",e.message); }

    // ---- index tiles ----
    const indices=[];
    for(const spec of INDEX_SPECS){
      let row=spec.nse?idxRows[spec.nse]:null, candles=null;
      const dSpec=spec.dhan||spec.dId;
      if(dSpec){ try{ candles=await LiveEngine.dhanCandles(dSpec.secId,dSpec.seg,"IDX"); }catch(e){ console.warn("dhan idx fail",spec.id,e.message); } }
      if(!candles && spec.nse){ try{ candles=await LiveEngine.indexHistory(spec.nse); }catch(e){ console.warn("index history fail",spec.id,e.message); } }
      let cmp=row?+row.last:null, chg1d=row?+row.percentChange:null;
      if(!row&&candles?.length>1){ cmp=candles.at(-1).c; chg1d=+((cmp/candles.at(-2).c-1)*100).toFixed(2); }
      const closes=candles?.map(x=>x.c)||[];
      const emaV=emaMap(closes);
      const ref=n=>closes.length>n?+((cmp/closes[closes.length-1-n]-1)*100).toFixed(2):null;
      indices.push({ id:spec.id, name:spec.id==="LARGECAP"?"NIFTY 100":spec.id==="MIDCAP"?"NIFTY MIDCAP 150":spec.id==="SMALLCAP"?"NIFTY SMALLCAP 250":spec.nse||"SENSEX",
        isVix:!!spec.isVix, candles:buildCandleTFs(candles||[]),
        cmp, chg1d, chg1w:ref(5), chg1m:ref(21), ema:emaV, above:mkAbove(cmp,emaV) });
    }

    // ---- universe (NSE lists; falls back to embedded symbol list + Dhan candles) ----
    toast("Fetching NIFTY 50 constituents + daily candles (this runs once, then caches)…");
    let rows50=null;
    try{ rows50=await LiveEngine.constituents("NIFTY 50"); }
    catch(e){ toast("NSE unreachable — building universe from Dhan + embedded symbol list", true); }
    const metaOf=sym=>NIFTY50.find(a=>a[0]===sym)||POOL500.find(a=>a[0]===sym);
    const rowFromCandles=(sym,cd)=>{
      const c=cd.at(-1)?.c??0, p=cd.at(-2)?.c??c, win=cd.slice(-260);
      return { sym, name:metaOf(sym)?.[1]||sym, cmp:c, prev:p, pChange:+((c/(p||c)-1)*100).toFixed(2),
        vol:cd.at(-1)?.v??0, value:(cd.at(-1)?.v??0)*c,
        hi52:win.length?Math.max(...win.map(x=>x.h)):0, lo52:win.length?Math.min(...win.map(x=>x.l)):0 };
    };
    let uni50=[];
    if(rows50){
      const hist50=await batch(rows50.map(r=>r.sym), async sym=>{
        const r=rows50.find(x=>x.sym===sym);
        const cd=await LiveEngine.equityHistory(sym,420);
        return {r, cd};
      }, 3, (d,t)=>{ if(manual) toast(`Nifty 50 candles ${d}/${t}…`); });
      const sectorOf=await buildSectorMap(rows50.map(r=>r.sym));
      uni50=hist50.filter(x=>x).map(({r,cd})=>{
        const s=liveStock(r, cd||[], sectorOf(r.sym)||metaOf(r.sym)?.[2]||"Others");
        s.cap="L"; return s;
      });
    }else{
      const syms=NIFTY50.map(a=>a[0]);
      const hist=await batch(syms, async sym=>({sym, cd:(await LiveEngine.equityHistory(sym,420))||[]}), 3,
        (d,t)=>{ if(manual) toast(`Dhan candles ${d}/${t}…`); });
      uni50=hist.filter(x=>x.cd.length>30).map(({sym,cd})=>{
        const s=liveStock(rowFromCandles(sym,cd), cd, metaOf(sym)?.[2]||"Others"); s.cap="L"; return s;
      });
    }

    let uniRest=[];
    try{
      toast("Fetching NIFTY 500 remaining constituents…");
      const rows500=await LiveEngine.constituents("NIFTY 500");
      const extra=rows500.filter(r=>!uni50.some(u=>u.sym===r.sym));
      const histRest=await batch(extra.map(r=>r.sym), async sym=>{
        const r=extra.find(x=>x.sym===sym);
        const cd=await LiveEngine.equityHistory(sym,420);
        return {r, cd};
      }, 3, (d,t)=>{ if(d%50===0) toast(`Nifty 500 candles ${d}/${t}…`); });
      const secOf500=await buildSectorMap(extra.map(r=>r.sym), null);
      uniRest=histRest.filter(x=>x).map(({r,cd})=>liveStock(r, cd||[], secOf500(r.sym)||metaOf(r.sym)?.[2]||"Others"));
    }catch(e){
      if(!rows50){ // full Dhan fallback for the rest of the embedded 500 pool
        toast("Fetching remaining universe from Dhan…");
        const extra=POOL500.filter(a=>!uni50.some(u=>u.sym===a[0])).map(a=>a[0]);
        const hist=await batch(extra, async sym=>({sym, cd:(await LiveEngine.equityHistory(sym,420))||[]}), 3,
          (d,t)=>{ if(d%40===0) toast(`Dhan candles ${d}/${t}…`); });
        uniRest=hist.filter(x=>x.cd.length>30).map(({sym,cd})=>liveStock(rowFromCandles(sym,cd), cd, metaOf(sym)?.[2]||"Others"));
      }
    }
    const uni500=uni50.concat(uniRest);
    assignCaps(uni500);
    uni50.forEach(s=>{ s.cap="L"; });

    // ---- sectors ----
    const bySec={};
    uni500.forEach(s=>{ (bySec[s.sector]??=[]).push(s); });
    const sectorIdx=Object.entries(bySec).map(([sec,mem])=>sectorAgg(sec,mem)).filter(Boolean);

    // ---- FII/DII ----
    let fii={fii:[],dii:[],dates:[]};
    try{ fii=await LiveEngine.fiiDii(); }catch(e){ console.warn("fiidii",e.message); }

    // ---- Dhan option chain ----
    let oc={strikes:[],pcr:1,maxPain:null,ivHist:[12]};
    if(SET.dhan.token){
      try{ oc=await LiveEngine.dhanOptionChain(); }
      catch(e){ console.warn("optionchain",e.message); toast("Dhan option chain failed — connect Dhan in Data Source", true); }
    }

    DATA={ uni50, uni500, indices, sectorIdx,
      fii:fii.fii.length?fii.fii:DATA?.fii||[], dii:fii.dii.length?fii.dii:DATA?.dii||[],
      strikes:oc.strikes, pcr:oc.pcr, maxPain:oc.maxPain, ivHist:oc.ivHist,
      breadthHist:buildBreadthHist(uni500), ts:Date.now() };
    computePatterns();
    const act=$$(".sec.active")[0]; if(act) renderSection(act.id.replace("sec-",""));
    const pill=$("#conn-pill"); pill.classList.add("live"); $("#conn-label").textContent="Live (NSE+Dhan)";
    if(box){ box.className="status-box ok"; box.textContent=`✓ Synced ${new Date().toLocaleTimeString("en-IN")} — ${uni500.length} stocks, ${sectorIdx.length} sectors, ${indices.length} indices.`; }
    toast(`Live sync complete — ${uni500.length} stocks from NSE, PCR ${DATA.pcr} from Dhan`);
  }catch(e){
    console.error(e);
    if(box){ box.className="status-box err"; box.textContent="✕ Live sync failed: "+e.message+" — check NSE proxy prefix in Data Source."; }
    toast("Live sync failed: "+e.message+" (check proxy settings)", true);
    if(!DATA){ rebuildAll(); toast("Falling back to demo so the app stays usable — set the NSE proxy and refresh", true); }
  }
};

/* ---------- sector map: stock → display sector, from NSE sector-index constituents ---------- */
async function buildSectorMap(symbols, existing=null){
  const map={};
  if(existing) symbols.forEach(s=>{ const v=existing(s); if(v) map[s]=v; });
  const missing=symbols.filter(s=>!map[s]);
  if(!missing.length) return s=>map[s];
  const mSet=new Set(missing);
  for(const [idxName,sec] of SECTOR_INDEX_MAP){
    if(!mSet.size) break;
    try{
      const cons=await LiveEngine.constituents(idxName);
      cons.forEach(c=>{ if(mSet.has(c.sym)&&!map[c.sym]){ map[c.sym]=sec; mSet.delete(c.sym); } });
    }catch(e){ /* sector index not in equity-stockIndices — skip */ }
  }
  return s=>map[s]||null;
}

/* ---------- boot ---------- */
/* override the demo-based refreshData from app.js */
window.refreshData = async function(manual=false){
  if(SET.mode!=="live"){ rebuildAll(); if(manual) toast("Demo data regenerated"); return; }
  await LiveEngine.refresh(manual);
};
async function initApp(){
  tickClock(); loadDataUI();
  if(SET.mode==="live"){ await LiveEngine.refresh(false); }
  else { rebuildAll(); }
}
initApp();
