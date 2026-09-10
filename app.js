/* ============================================================
   MarketView — India Market Dashboard (DhanHQ / NSE / Demo)
   ============================================================ */
"use strict";

/* ---------------- utils ---------------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const fmt = (n, d=2) => n==null || isNaN(n) ? "—" : Number(n).toLocaleString("en-IN",{minimumFractionDigits:d, maximumFractionDigits:d});
const pct = n => (n==null||isNaN(n)) ? "—" : (n>=0?"+":"")+fmt(n)+"%";
const cls = n => (n>=0?"up-txt":"down-txt");
const arrow = n => n>=0 ? "▲" : "▼";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const avg=a=>a.reduce((s,x)=>s+x,0)/(a.length||1);
const stdev=a=>{const m=avg(a);return Math.sqrt(avg(a.map(x=>(x-m)**2)))};
const randn=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
function toast(msg, err=false){const t=$("#toast");t.textContent=msg;t.className="toast show"+(err?" err":"");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),3200);}

/* ---------------- indicators ---------------- */
function emaSeries(vals, p){
  if(!vals.length) return [];
  const k=2/(p+1); const out=new Array(vals.length); out[0]=vals[0];
  for(let i=1;i<vals.length;i++) out[i]=vals[i]*k+out[i-1]*(1-k);
  return out;
}
function ema(vals,p){const s=emaSeries(vals,p);return s[s.length-1];}
function sma(vals,p){if(vals.length<p)return avg(vals);return avg(vals.slice(-p));}
function rsi(closes,p=14){
  if(closes.length<p+1) return 50;
  let g=0,l=0;
  for(let i=closes.length-p;i<closes.length;i++){
    const d=closes[i]-closes[i-1];
    if(d>0)g+=d;else l-=d;
  }
  if(l===0) return 100;
  const rs=g/l; return 100-100/(1+rs);
}
function rsiSeries(closes,p=14){
  const out=new Array(closes.length).fill(50);
  let g=0,l=0;
  for(let i=1;i<closes.length;i++){
    const d=closes[i]-closes[i-1];
    const up=Math.max(d,0), dn=Math.max(-d,0);
    if(i<=p){ g+=up; l+=dn; if(i===p){out[i]= l===0?100:100-100/(1+g/l);} }
    else { g=(g*(p-1)+up)/p; l=(l*(p-1)+dn)/p; out[i]= l===0?100:100-100/(1+g/l); }
  }
  return out;
}

/* ---------------- settings & persistence ---------------- */
const DEFAULTS = {
  emas:[10,20,50,200], rsiPeriod:14, volSpike:2.0, oversold:30,
  baseDepth:20, boVol:1.8, boNearHigh:15, pbEmaGuard:50,
  dhan:{clientId:"", token:"", proxy:"https://cors.eu.org/"},
  nseProxy:"", mode:"demo", preferDhanCandles:false,
  watchlists:[{name:"WL 1",symbols:[]},{name:"WL 2",symbols:[]},{name:"WL 3",symbols:[]}],
  notes:{}, universe:"50"
};
let SET = loadSettings();
/* migrate away from dead corsproxy.io prefixes */
if(SET.nseProxy && SET.nseProxy.includes("corsproxy.io")) SET.nseProxy=DEFAULTS.nseProxy;
if(SET.dhan.proxy && SET.dhan.proxy.includes("corsproxy.io")) SET.dhan.proxy=DEFAULTS.dhan.proxy;
/* when the dashboard is served by relay.py on localhost, use it automatically */
if(location.host==="localhost:8787"){
  SET.nseProxy="http://localhost:8787/?url=";
  SET.dhan.proxy="http://localhost:8787/?url=";
}
function loadSettings(){
  try{ const s=JSON.parse(localStorage.getItem("mv-settings")||"{}");
    return {...structuredClone(DEFAULTS), ...s, dhan:{...DEFAULTS.dhan,...(s.dhan||{})}, watchlists:s.watchlists||DEFAULTS.watchlists, notes:s.notes||{} };
  }catch(e){ return structuredClone(DEFAULTS); }
}
function saveSettings(){ localStorage.setItem("mv-settings", JSON.stringify(SET)); }

/* ---------------- static reference data ---------------- */
const NIFTY50 = [
 ["RELIANCE","Reliance Industries","Energy","L"],["TCS","Tata Consultancy Svcs","IT","L"],
 ["HDFCBANK","HDFC Bank","Financials","L"],["ICICIBANK","ICICI Bank","Financials","L"],
 ["INFY","Infosys","IT","L"],["HINDUNILVR","Hindustan Unilever","FMCG","L"],
 ["ITC","ITC","FMCG","L"],["SBIN","State Bank of India","Financials","L"],
 ["BHARTIARTL","Bharti Airtel","Telecom","L"],["KOTAKBANK","Kotak Mahindra Bank","Financials","L"],
 ["LT","Larsen & Toubro","Industrials","L"],["AXISBANK","Axis Bank","Financials","L"],
 ["ASIANPAINT","Asian Paints","Materials","L"],["MARUTI","Maruti Suzuki","Auto","L"],
 ["SUNPHARMA","Sun Pharma","Pharma","L"],["TITAN","Titan Company","Consumer","L"],
 ["ULTRACEMCO","UltraTech Cement","Materials","L"],["BAJFINANCE","Bajaj Finance","Financials","L"],
 ["WIPRO","Wipro","IT","L"],["M&M","Mahindra & Mahindra","Auto","L"],
 ["NTPC","NTPC","Utilities","L"],["TATAMOTORS","Tata Motors","Auto","L"],
 ["ADANIENT","Adani Enterprises","Industrials","L"],["ADANIPORTS","Adani Ports & SEZ","Industrials","L"],
 ["HCLTECH","HCL Technologies","IT","L"],["POWERGRID","Power Grid Corp","Utilities","L"],
 ["ONGC","Oil & Natural Gas","Energy","L"],["COALINDIA","Coal India","Metals & Mining","L"],
 ["TATASTEEL","Tata Steel","Metals & Mining","L"],["JSWSTEEL","JSW Steel","Metals & Mining","L"],
 ["HINDZINC","Hindustan Zinc","Metals & Mining","L"],["VEDL","Vedanta","Metals & Mining","L"],
 ["BRITANNIA","Britannia Industries","FMCG","L"],["NESTLEIND","Nestle India","FMCG","L"],
 ["EICHERMOT","Eicher Motors","Auto","L"],["HEROMOTOCO","Hero MotoCorp","Auto","L"],
 ["BAJAJAUTO","Bajaj Auto","Auto","L"],["TVSMOTOR","TVS Motor","Auto","L"],
 ["CIPLA","Cipla","Pharma","L"],["DRREDDY","Dr Reddys Labs","Pharma","L"],
 ["APOLLOHOSP","Apollo Hospitals","Healthcare","L"],["INDUSINDBK","IndusInd Bank","Financials","L"],
 ["HDFCLIFE","HDFC Life Insurance","Financials","L"],["SBILIFE","SBI Life Insurance","Financials","L"],
 ["BAJAJFINSV","Bajaj Finserv","Financials","L"],["DMART","Avenue Supermarts","Consumer","L"],
 ["HINDALCO","Hindalco Industries","Metals & Mining","L"],["LTIM","LTIMindtree","IT","L"],
 ["TECHM","Tech Mahindra","IT","L"],["PIDILITIND","Pidilite Industries","Materials","L"],
 ["SHRIRAMFIN","Shriram Finance","Financials","L"],["TATACONSUM","Tata Consumer","FMCG","L"]
];
// extra pool for Nifty 500 universe
const POOL500 = [
 ["IRCTC","IRCTC","Consumer","S"],["ZOMATO","Zomato","Consumer","L"],["PAYTM","One97 Comm","IT","S"],
 ["NYKAA","FSN E-Commerce","Consumer","S"],["POLICYBZR","PB Fintech","Financials","M"],["DELHIVERY","Delhivery","Industrials","S"],
 ["BDL","Bharat Dynamics","Industrials","M"],["MAZDOCK","Mazagon Dock","Industrials","M"],["COCHINSHIP","Cochin Shipyard","Industrials","S"],
 ["HAL","Hindustan Aeronautics","Industrials","L"],["BEL","Bharat Electronics","Industrials","L"],["SOLARINDS","Solar Industries","Industrials","M"],
 ["DATAPATTNS","Data Patterns","Industrials","S"],["PARAS","Paras Defence","Industrials","S"],["IDEAFORGE","Ideaforge Tech","Industrials","S"],
 ["RVNL","Rail Vikas Nigam","Industrials","S"],["IRFC","Indian Railway Fin","Financials","M"],["RITES","RITES","Industrials","S"],
 ["NBCC","NBCC India","Industrials","S"],["SJVN","SJVN","Utilities","S"],["KEI","KEI Industries","Industrials","M"],
 ["POLYCAB","Polycab India","Industrials","M"],["HAVELLS","Havells India","Consumer","L"],["VOLTAS","Voltas","Consumer","M"],
 ["BLUESTARCO","Blue Star","Consumer","M"],["CUMMINSIND","Cummins India","Industrials","L"],["SIEMENS","Siemens India","Industrials","L"],
 ["ABB","ABB India","Industrials","L"],["THERMAX","Thermax","Industrials","M"],["BHEL","Bharat Heavy Elec","Industrials","M"],
 ["CGPOWER","CG Power","Industrials","L"],["HITACHI","Hitachi Energy","Industrials","M"],["KEC","KEC Intl","Industrials","M"],
 ["PNCINFRA","PNC Infratech","Industrials","S"],["GRSE","Garden Reach Shipbld","Industrials","S"],["TRIDENT","Trident","Consumer","S"],
 ["PAGEIND","Page Industries","Consumer","M"],["DIXON","Dixon Technologies","Consumer","M"],["AMBER","Amber Enterprises","Consumer","M"],
 ["TRENT","Trent","Consumer","L"],["TITAGARH","Titagarh Rail","Industrials","S"],["JINDALSAW","Jindal Saw","Industrials","S"],
 ["APLAPOLLO","APL Apollo Tubes","Materials","M"],["JINDALSTEL","Jindal Steel","Metals & Mining","M"],["SAIL","Steel Authority","Metals & Mining","M"],
 ["NMDC","NMDC","Metals & Mining","M"],["MOIL","MOIL","Metals & Mining","S"],["GMDCLTD","Guj Mineral Dev","Metals & Mining","S"],
 ["OIL","Oil India","Energy","M"],["GAIL","GAIL India","Energy","L"],["PETRONET","Petronet LNG","Energy","M"],
 ["IOC","Indian Oil","Energy","L"],["BPCL","Bharat Petroleum","Energy","L"],["HPCL","Hindustan Petroleum","Energy","M"],
 ["CHOLAFIN","Cholamandalam","Financials","L"],["MUTHOOTFIN","Muthoot Finance","Financials","M"],["MANAPPURAM","Manappuram Finance","Financials","S"],
 ["CANFINHOME","Can Fin Homes","Financials","S"],["AUBANK","AU Small Finance","Financials","M"],["IDFCFIRSTB","IDFC First Bank","Financials","L"],
 ["FEDERALBNK","Federal Bank","Financials","L"],["BANDHANBNK","Bandhan Bank","Financials","M"],["RBLBANK","RBL Bank","Financials","S"],
 ["YESBANK","Yes Bank","Financials","S"],["PNB","Punjab National Bank","Financials","M"],["BANKBARODA","Bank of Baroda","Financials","L"],
 ["UNIONBANK","Union Bank","Financials","M"],["INDIANB","Indian Bank","Financials","S"],["CENTRALBK","Central Bank","Financials","S"],
 ["LICHSGFIN","LIC Housing Fin","Financials","M"],["PFC","Power Finance Corp","Financials","M"],["RECLTD","REC","Financials","M"],
 ["LICI","LIC of India","Financials","L"],["HDFCAMC","HDFC AMC","Financials","M"],["NAMINDIA","Nippon AMC","Financials","S"],
 ["ICICIGI","ICICI Lombard","Financials","L"],["ICICIPRULI","ICICI Prudential","Financials","L"],["STARHEALTH","Star Health","Financials","S"],
 ["CROMPTON","Crompton Greaves","Consumer","M"],["WHIRLPOOL","Whirlpool India","Consumer","S"],["IFBIND","IFB Industries","Consumer","S"],
 ["VGUARD","V-Guard Industries","Consumer","S"],["SYRMA","Syrma SGS","IT","S"],["KAYNES","Kaynes Tech","IT","M"],
 ["ASTRAL","Astral","Materials","M"],["SUPREMEIND","Supreme Industries","Materials","M"],["AIAENG","AIA Engineering","Industrials","M"],
 ["TIMKEN","Timken India","Industrials","M"],["SKFINDIA","SKF India","Industrials","M"],["KANSAINER","Kansai Nerolac","Materials","S"],
 ["BERGEPAINT","Berger Paints","Materials","L"],["ASHOKLEY","Ashok Leyland","Auto","L"],["MOTHERSON","Samvardhana Motherson","Auto","L"],
 ["BOSCHLTD","Bosch","Auto","M"],["EXIDEIND","Exide Industries","Auto","M"],["UNOMINDA","Uno Minda","Auto","M"],
 ["BHARATFORG","Bharat Forge","Auto","L"],["MRF","MRF","Auto","M"],["JKTYRE","JK Tyre","Auto","S"],
 ["APOLLOTYRE","Apollo Tyres","Auto","M"],["CEATLTD","CEAT","Auto","S"],["BALKRISIND","Balkrishna Ind","Auto","M"],
 ["INDHOTEL","Indian Hotels","Consumer","L"],["EIHOTEL","EIH","Consumer","M"],["CHOLAHLDNG","Chola Holdings","Financials","M"],
 ["RAJESHEXPO","Rajesh Exports","Consumer","S"],["TANLA","Tanla Platforms","IT","M"],["PERSISTENT","Persistent Systems","IT","L"],
 ["COFORGE","Coforge","IT","L"],["LTTS","L&T Tech","IT","M"],["MPHASIS","Mphasis","IT","L"],
 ["KPITTECH","KPIT Technologies","IT","M"],["ZENSARTECH","Zensar Tech","IT","S"],["SONATSOFTW","Sonata Software","IT","S"],
 ["INTELLECT","Intellect Design","IT","S"],["NEWGEN","Newgen Software","IT","S"],["NIFTYIT","Nifty IT proxy","IT","L"],
 ["GLAND","Gland Pharma","Pharma","M"],["LUPIN","Lupin","Pharma","L"],["AUROPHARMA","Aurobindo Pharma","Pharma","L"],
 ["TORNTPHARM","Torrent Pharma","Pharma","L"],["ZYDUSLIFE","Zydus Lifesciences","Pharma","L"],["ALKEM","Alkem Labs","Pharma","M"],
 ["IPCALAB","IPCA Labs","Pharma","M"],["JBCHEPHARM","JB Chemicals","Pharma","S"],["NATCOPHARM","Natco Pharma","Pharma","S"],
 ["BIOCON","Biocon","Pharma","M"],["SYNGENE","Syngene Intl","Healthcare","M"],["LALPATHLAB","Dr Lal PathLabs","Healthcare","M"],
 ["METROPOLIS","Metropolis Health","Healthcare","S"],["MAXHEALTH","Max Healthcare","Healthcare","L"],["FORTIS","Fortis Healthcare","Healthcare","M"],
 ["MEDANTA","Global Health","Healthcare","M"],["KIMS","Krishna Institute","Healthcare","S"],["ASTERDM","Aster DM","Healthcare","S"],
 ["VBL","Varun Beverages","FMCG","L"],["COLPAL","Colgate Palmolive","FMCG","L"],["DABUR","Dabur India","FMCG","L"],
 ["GODREJCP","Godrej Consumer","FMCG","L"],["MARICO","Marico","FMCG","L"],["EMAMILTD","Emami","FMCG","M"],
 ["RADICO","Radico Khaitan","FMCG","M"],["UNITDSPR","United Spirits","FMCG","L"],["UNITDSPR2","United Breweries","FMCG","M"],
 ["TATACOMM","Tata Communications","Telecom","L"],["HFCL","HFCL","Telecom","S"],["TEJASNET","Tejas Networks","Telecom","S"],
 ["IDEA","Vodafone Idea","Telecom","S"],["INDTOWER","Indus Towers","Telecom","L"],["ROUTE","Route Mobile","Telecom","S"],
 ["DLF","DLF","Realty","L"],["GODREJPROP","Godrej Properties","Realty","L"],["OBEROIRLTY","Oberoi Realty","Realty","M"],
 ["PRESTIGE","Prestige Estates","Realty","M"],["PHOENIXLTD","Phoenix Mills","Realty","M"],["BRIGADE","Brigade Enterprises","Realty","S"],
 ["LODHA","Macrotech Developers","Realty","L"],["PIIND","PI Industries","Chemicals","L"],["UPL","UPL","Chemicals","L"],
 ["SRF","SRF","Chemicals","L"],["DEEPAKNTR","Deepak Nitrite","Chemicals","M"],["ATUL","Atul","Chemicals","M"],
 ["VINATIORGA","Vinat Organics","Chemicals","S"],["CLEAN","Clean Science","Chemicals","S"],["ALKYLAMINE","Alkyl Amines","Chemicals","S"],
 ["JUBLFOOD","Jubilant FoodWorks","Consumer","L"],["DEVYANI","Devyani Intl","Consumer","M"],["WESTLIFE","Westlife Foodworld","Consumer","S"],
 ["RENUKA","Shree Renuka","Consumer","S"],["BALRAMCHIN","Balrampur Chini","Consumer","S"],["DALBHARAT","Dalmia Bharat","Materials","M"],
 ["ACC","ACC","Materials","L"],["AMBUJACEM","Ambuja Cements","Materials","L"],["SHREECEM","Shree Cement","Materials","L"],
 ["RAMCOCEM","Ramco Cements","Materials","S"],["HEIDELBERG","Heidelberg Cement","Materials","S"]
];
const SECTORS = [...new Set(NIFTY50.map(x=>x[2]).concat(POOL500.map(x=>x[2])))];
const INDEX_DEFS = [
 {id:"NIFTY",   name:"NIFTY 50",        base:25840, vol:0.008},
 {id:"BANKNIFTY",name:"NIFTY BANK",     base:56890, vol:0.010},
 {id:"SENSEX",  name:"SENSEX",          base:84650, vol:0.008},
 {id:"LARGECAP",name:"NIFTY 100 (LC)",  base:32150, vol:0.007},
 {id:"MIDCAP",  name:"NIFTY MIDCAP 150",base:56870, vol:0.011},
 {id:"SMALLCAP",name:"NIFTY SMALLCAP 250",base:18420, vol:0.014},
 {id:"VIX",     name:"INDIA VIX",       base:13.4,  vol:0.06, isVix:true}
];

/* ---------------- demo universe builder ---------------- */
function genCandles(n, start, drift, vol, seedV=1){
  // geometric random walk -> array of {o,h,l,c,v}
  let p=start; const out=[]; let vBase=seedV*(0.8+Math.random()*0.6);
  for(let i=0;i<n;i++){
    const o=p;
    const r=randn()*vol+drift;
    let c=p*(1+r);
    const h=Math.max(o,c)*(1+Math.abs(randn())*vol*0.5);
    const l=Math.min(o,c)*(1-Math.abs(randn())*vol*0.5);
    const trend=1+0.15*Math.tanh((c/p-1)*30);
    const v=Math.round(vBase*trend*(1+Math.abs(randn())*0.35));
    out.push({o:+o.toFixed(2),h:+h.toFixed(2),l:+l.toFixed(2),c:+c.toFixed(2),v});
    p=c;
  }
  return out;
}
function resampleWeekly(daily){
  const w=[]; let cur=null;
  daily.forEach((d,i)=>{
    if(i%5===0){cur={...d};w.push(cur);}
    else{cur.h=Math.max(cur.h,d.h);cur.l=Math.min(cur.l,d.l);cur.c=d.c;cur.v+=d.v;}
  });
  return w;
}
function resampleMonthly(daily){
  const m=[]; let cur=null;
  daily.forEach((d,i)=>{
    if(i%21===0){cur={...d};m.push(cur);}
    else{cur.h=Math.max(cur.h,d.h);cur.l=Math.min(cur.l,d.l);cur.c=d.c;cur.v+=d.v;}
  });
  return m;
}
const EARN_MONTHS=["Jul 2025","Apr 2025","Jan 2025","Oct 2024"];
function buildStock(sym, name, sector, cap){
  const regime=Math.random(); // 0 bear .. 1 bull
  const drift=(regime-0.45)*0.0011;
  const vol=cap==="S"?0.024:cap==="M"?0.018:0.012;
  const start=80+Math.random()*2400;
  const daily=genCandles(260,start,drift,vol,50000+Math.random()*900000);
  const weekly=resampleWeekly(daily), monthly=resampleMonthly(daily);
  const closes=daily.map(d=>d.c);
  const c=closes[closes.length-1];
  const emaV={}; SET.emas.forEach(p=>emaV[p]=ema(closes,p));
  const chg=(n)=>{const ref=closes[closes.length-1-n];return (c/ref-1)*100;};
  const hi52=Math.max(...daily.slice(-260).map(d=>d.h)), lo52=Math.min(...daily.slice(-260).map(d=>d.l));
  const v9=avg(daily.slice(-10,-1).map(d=>d.v));
  const volSpike=daily[daily.length-1].v/v9;
  const gapUp=(daily[daily.length-1].o/daily[daily.length-2].c-1)*100;
  const impacted=Math.random()<0.75;
  const earnImpact=impacted? +(randn()*4).toFixed(1) : null;
  return {
    sym,name,sector,cap,
    candles:{D:daily,W:weekly,M:monthly},
    cmp:+c.toFixed(2), chg1d:+chg(1).toFixed(2), chg1w:+chg(5).toFixed(2), chg1m:+chg(21).toFixed(2),
    rsi:+rsi(closes,SET.rsiPeriod).toFixed(1),
    ema:emaV, above:p=>c>emaV[p],
    emaPct20:+((c/emaV[20]-1)*100).toFixed(2),
    belowHigh:+((c/hi52-1)*100).toFixed(2), aboveLow:+((c/lo52-1)*100).toFixed(2),
    vol:daily[daily.length-1].v, volSpike:+volSpike.toFixed(2), gapUp:+gapUp.toFixed(2),
    prevEarning:EARN_MONTHS[Math.floor(Math.random()*4)],
    earnImpact, nextEarning:"Oct 2025",
    sectorWeight:+(Math.random()*3+0.3).toFixed(2)
  };
}
function buildIndex(def){
  const daily=genCandles(260,def.base,0.0002,def.vol,1);
  const closes=daily.map(d=>d.c); const c=closes[closes.length-1];
  const emaV={}; SET.emas.forEach(p=>emaV[p]=ema(closes,p));
  const chg=(n)=>{const ref=closes[closes.length-1-n];return (c/ref-1)*100;};
  return { id:def.id, name:def.name, isVix:!!def.isVix,
    candles:{D:daily,W:resampleWeekly(daily),M:resampleMonthly(daily)},
    cmp:+c.toFixed(2), chg1d:+chg(1).toFixed(2), chg1w:+chg(5).toFixed(2), chg1m:+chg(21).toFixed(2),
    ema:emaV, above:p=>c>emaV[p] };
}
function buildDemoData(){
  const uni50=NIFTY50.map(a=>buildStock(...a));
  const extra=POOL500.filter(a=>!uni50.some(u=>u.sym===a[0])).map(a=>buildStock(...a));
  const uni500=uni50.concat(extra);
  const indices=INDEX_DEFS.map(buildIndex);
  const sectors={};
  [...uni500].forEach(s=>{(sectors[s.sector]??=[]).push(s);});
  const sectorIdx=Object.entries(sectors).map(([sec,stocks])=>{
    const chg=n=>avg(stocks.map(s=>s["chg"+n]));
    // build synthetic sector index from member avg
    const closes=stocks[0].candles.D.map((_,i)=>avg(stocks.map(s=>s.candles.D[i].c/s.candles.D[0].c)));
    const base=1000+Math.random()*2000;
    const daily=closes.map((r,i)=>({o:base*r,h:base*r*1.004,l:base*r*0.996,c:base*r,v:1e6+i*1000}));
    const emaV={}; SET.emas.forEach(p=>emaV[p]=ema(daily.map(d=>d.c),p));
    const c=daily[daily.length-1].c;
    return { sec, name:sec, members:stocks,
      candles:{D:daily,W:resampleWeekly(daily),M:resampleMonthly(daily)},
      cmp:+c.toFixed(1), chg1d:+chg("1d").toFixed(2), chg1w:+chg("1w").toFixed(2), chg1m:+chg("1m").toFixed(2),
      ema:emaV, above:p=>c>emaV[p],
      turnover:+avg(stocks.map(s=>s.vol)).toFixed(0),
      adv:stocks.filter(s=>s.chg1d>0).length, dec:stocks.filter(s=>s.chg1d<0).length };
  });
  // FII / DII
  const fii=[],dii=[];
  for(let i=0;i<10;i++){ fii.push(Math.round(randn()*4500)); dii.push(Math.round(randn()*3200)); }
  // option chain synthetic
  const strikes=[]; const spot=indices[0].cmp;
  for(let k=-8;k<=8;k++){ strikes.push({strike:Math.round(spot/50)*50+k*50,
    ceOi:Math.round(2e6+Math.abs(randn())*4e6*(1+Math.abs(k)*0.35)),
    peOi:Math.round(2e6+Math.abs(randn())*4e6*(1+Math.abs(k)*0.35)),
    ceIv:+(11+Math.abs(k)*0.35+Math.random()).toFixed(2),
    peIv:+(11+Math.abs(k)*0.35+Math.random()).toFixed(2)});}
  const pcr=avg(strikes.map(s=>s.peOi))/avg(strikes.map(s=>s.ceOi));
  const data={ uni50, uni500, indices, sectorIdx, fii, dii, strikes, pcr:+pcr.toFixed(2),
    maxPain:strikes.reduce((a,b)=>b.ceOi+b.peOi>a.ceOi+a.peOi?b:a).strike,
    ivHist:Array.from({length:20},()=>+(11+randn()*1.6).toFixed(2)),
    ts:Date.now() };
  // breadth history per indicator per timeframe
  data.breadthHist={};
  ["D","W","M"].forEach(tf=>{
    data.breadthHist[tf]={};
    ["ema20","ema50","rsi55","ad","pivot"].forEach(ind=>{
      data.breadthHist[tf][ind]=Array.from({length:60},(_,i)=>clamp(50+randn()*18+(tf==="D"?0:5),5,97));
    });
  });
  return data;
}

/* ---------------- pattern engine ---------------- */
function lastCrossUp(fast, slow, lookback=5){
  // returns true if fast EMA crossed above slow within last `lookback` bars
  for(let i=Math.max(1,fast.length-lookback);i<fast.length;i++){
    if(fast[i]>slow[i] && fast[i-1]<=slow[i-1]) return true;
  }
  return false;
}
function pivots(daily){
  const p=daily[daily.length-2]; // yesterday
  const P=(p.h+p.l+p.c)/3;
  return {P, R1:2*P-p.l, S1:2*P-p.h, R2:P+(p.h-p.l), S2:P-(p.h-p.l),
    pos:+( (daily[daily.length-1].c-P)/ (p.h-p.l) *100).toFixed(1)};
}
function swingLows(arr, lb=3){
  const out=[];
  for(let i=lb;i<arr.length-lb;i++){
    let ok=true;
    for(let j=1;j<=lb;j++){ if(arr[i-j]<arr[i]||arr[i+j]<arr[i]){ok=false;break;} }
    if(ok) out.push({i,v:arr[i]});
  }
  return out;
}
function detectPatterns(s){
  const d=s.candles.D, closes=d.map(x=>x.c);
  const out={stack:false, bullCross:false, rsiMa:false, stage2:{score:0,checks:[]},
    breakout:null, vcp:null, div:null, piv:pivots(d), oversoldPb:false, baseDepthPct:null};
  const e10=emaSeries(closes,SET.emas[0]), e20=emaSeries(closes,SET.emas[1]),
        e50=emaSeries(closes,SET.emas[2]), e200=emaSeries(closes,SET.emas[3]);
  const c=closes[closes.length-1];
  // EMA stack alignment
  out.stack = c>e10.at(-1) && e10.at(-1)>e20.at(-1) && e20.at(-1)>e50.at(-1) && e50.at(-1)>e200.at(-1);
  out.bullCross = lastCrossUp(e10,e20,5) || lastCrossUp(e20,e50,5);
  const r=rsiSeries(closes,SET.rsiPeriod);
  const rMA=sma(r,10);
  out.rsiMa = r.at(-1) > rMA;
  // Stage-2 checklist (Weinstein style, 7 points)
  const rising=(ser,n=20)=>ser.at(-1)>ser[ser.length-1-n];
  const hi52=Math.max(...d.slice(-260).map(x=>x.h));
  const rsTrend = closes.at(-1)/closes.at(-60);
  const checks=[
    ["Price > 200 EMA", c>e200.at(-1)],
    ["200 EMA rising", rising(e200)],
    ["50 EMA above 200", e50.at(-1)>e200.at(-1)],
    ["Price > 50 EMA", c>e50.at(-1)],
    ["50 EMA rising", rising(e50)],
    ["Near 52W high (≤"+SET.boNearHigh+"%)", (c/hi52-1)*100 > -SET.boNearHigh],
    ["RS rising vs 3M ago", rsTrend>1]
  ];
  out.stage2.checks=checks; out.stage2.score=checks.filter(x=>x[1]).length;
  // base breakout: 3-12 week consolidation then BO on volume
  const look=63; const seg=d.slice(-look);
  const hi=Math.max(...seg.map(x=>x.h)), lo=Math.min(...seg.map(x=>x.l));
  out.baseDepthPct=+((hi-lo)/hi*100).toFixed(1);
  const volAvg=avg(d.slice(-30,-1).map(x=>x.v));
  const inBase=((hi-lo)/hi*100)<=SET.baseDepth && look>=21;
  const brokeOut=d.at(-1).c>=hi*0.995 && d.at(-1).c>d.at(-1).o && d.at(-1).v>=SET.boVol*volAvg && (c/hi52-1)*100>-SET.boNearHigh;
  if(inBase && brokeOut) out.breakout={pivot:hi, volX:+(d.at(-1).v/volAvg).toFixed(1), depth:out.baseDepthPct};
  // VCP: 3+ contractions
  let contr=[], run=seg, prevDepth=null, ok=true;
  for(let k=0;k<3 && run.length>8;k++){
    const hh=Math.max(...run.map(x=>x.h)), ll=Math.min(...run.map(x=>x.l));
    const depth=(hh-ll)/hh*100; contr.push(+depth.toFixed(1));
    if(prevDepth!==null && depth>prevDepth){ok=false;break;}
    prevDepth=depth;
    run=run.slice(Math.floor(run.length*0.35));
  }
  const volDry=avg(d.slice(-10).map(x=>x.v))<avg(d.slice(-40,-10).map(x=>x.v))*0.85;
  if(ok && contr.length>=3 && contr[contr.length-1]<=SET.baseDepth*0.7 && volDry)
    out.vcp={contractions:contr};
  // divergences on RSI (last two swing lows / highs)
  const sl=swingLows(closes,3).slice(-2), sh=swingLows(closes.map(x=>-x),3).slice(-2);
  if(sl.length===2){
    const [a,b]=sl;
    if(b.v<a.v && r[b.i]>r[a.i]+2) out.div={type:"Bullish", note:"Price LL, RSI HL"};
    if(b.v<a.v && r[b.i]<r[a.i]-2) out.div={type:"Hidden Bearish", note:"Price LH, RSI LL"};
  }
  if(!out.div && sh.length===2){
    const [a,b]=sh;
    if(b.v<a.v && r[b.i]<r[a.i]-2) out.div={type:"Bearish", note:"Price HH, RSI LH"};
    if(b.v>a.v && r[b.i]>r[a.i]+2) out.div={type:"Hidden Bullish", note:"Price HL, RSI HH"};
  }
  // oversold pullback: RSI dipped below oversold, reclaimed, above guard EMA
  const guard=SET.pbEmaGuard;
  const dipped=r.slice(-15).some(x=>x<SET.oversold);
  out.oversoldPb = dipped && r.at(-1)>SET.oversold+5 && c>s.ema[guard];
  return out;
}

/* ============================================================
   DATA SOURCES — DhanHQ REST, NSE public (via proxy), Demo
   ============================================================ */
const Dhan = {
  /* When a proxy prefix is set, the FULL target url must be encoded (corsproxy.io style: ?url=<encoded>) */
  url(path){ const u="https://api.dhan.co"+path; return SET.dhan.proxy ? SET.dhan.proxy+encodeURIComponent(u) : u; },
  hdr(){ return { "access-token":SET.dhan.token, "client-id":SET.dhan.clientId, "Content-Type":"application/json" }; },
  async test(){
    const r=await fetch(this.url("/v2/fundlimit"),{headers:this.hdr()});
    if(!r.ok) throw new Error("Dhan auth failed: HTTP "+r.status+(r.status===401||r.status===403?" — token expired or client-id wrong (tokens last 24h)":""));
    return r.json();
  },
  async historical(secId, seg, inst, interval, from, to){
    const r=await fetch(this.url("/v2/charts/historical"),{
      method:"POST", headers:this.hdr(),
      body:JSON.stringify({securityId:String(secId), exchangeSegment:seg, instrument:inst, interval, fromDate:from, toDate:to})
    });
    if(!r.ok) throw new Error("historical "+r.status);
    const j=await r.json();
    // Dhan returns arrays: open,high,low,close,volume
    const n=j.close?.length||0, out=[];
    for(let i=0;i<n;i++) out.push({o:j.open[i],h:j.high[i],l:j.low[i],c:j.close[i],v:j.volume?.[i]??0});
    return out;
  },
  async optionChain(secId, seg="NSE_INDEX", inst="IDX"){
    const r=await fetch(this.url("/v2/optionchain?securityId="+secId+"&exchangeSegment="+seg+"&instrument="+inst),{headers:this.hdr()});
    if(!r.ok) throw new Error("optionchain "+r.status);
    return r.json();
  }
};
// Dhan security-id map (static, from Dhan scrip master — NSE_INDEX segment)
const DHAN_IDS = { NIFTY:"13", BANKNIFTY:"25", SENSEX:"51", VIX:"25" /*vix unavailable on dhan; fallback demo*/ };

const NSE = {
  get p(){ return SET.nseProxy||""; },
  async get(path){
    const r=await fetch(this.p+encodeURIComponent("https://www.nseindia.com"+path),{headers:{"Accept":"application/json"}});
    if(!r.ok) throw new Error("NSE "+r.status);
    return r.json();
  },
  async allIndices(){ return this.get("/api/allIndices"); },
  async fiiDii(){ return this.get("/api/fiidii"); }
};

/* ============================================================
   CHART HELPERS (dependency-free canvas)
   ============================================================ */
function setupCanvas(cv, h){
  const dpr=window.devicePixelRatio||1;
  const w=cv.parentElement.clientWidth-4;
  cv.width=w*dpr; cv.height=(h||cv.getAttribute("height")||150)*dpr;
  cv.style.width=w+"px"; cv.style.height=(h||150)+"px";
  const ctx=cv.getContext("2d"); ctx.scale(dpr,dpr);
  return {ctx, W:w, H:h||150};
}
function lineChart(cv, series, opts={}){
  const {ctx,W,H}=setupCanvas(cv,opts.h);
  const pad={l:8,r:8,t:10,b:18};
  const all=series.flatMap(s=>s.data).filter(v=>v!=null);
  if(!all.length){ctx.fillStyle="#8b95a9";ctx.fillText("no data",10,20);return;}
  let mn=Math.min(...all), mx=Math.max(...all);
  if(mn===mx){mn-=1;mx+=1;}
  const rng=mx-mn; mn-=rng*0.08; mx+=rng*0.08;
  const X=i=>pad.l+(W-pad.l-pad.r)*(i/(Math.max(...series.map(s=>s.data.length))-1||1));
  const Y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-mn)/(mx-mn));
  ctx.strokeStyle="#232b3d";ctx.lineWidth=1;
  for(let g=0;g<=4;g++){const y=pad.t+(H-pad.t-pad.b)*g/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();}
  if(opts.zeroLine){ctx.strokeStyle="rgba(139,149,169,.35)";ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(pad.l,Y(0));ctx.lineTo(W-pad.r,Y(0));ctx.stroke();ctx.setLineDash([]);}
  series.forEach(s=>{
    ctx.strokeStyle=s.color||"#3b82f6";ctx.lineWidth=s.width||1.8;ctx.beginPath();
    s.data.forEach((v,i)=>{ if(v==null)return; const x=X(i),y=Y(v); i===0||s.data[i-1]==null?ctx.moveTo(x,y):ctx.lineTo(x,y); });
    ctx.stroke();
    if(s.fill){ctx.lineTo(X(s.data.length-1),H-pad.b);ctx.lineTo(X(0),H-pad.b);ctx.closePath();
      const g=ctx.createLinearGradient(0,pad.t,0,H);g.addColorStop(0,(s.color||"#3b82f6")+"33");g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fill();}
    if(s.dots){ctx.fillStyle=s.color;const v=s.data.at(-1);ctx.beginPath();ctx.arc(X(s.data.length-1),Y(v),3,0,7);ctx.fill();}
  });
  if(opts.labels){ctx.fillStyle="#8b95a9";ctx.font="10px Consolas";opts.labels.forEach((lb,i)=>ctx.fillText(lb,X(i*Math.floor((opts.labels.length-1)/(opts.nTick||4))),H-5));}
}
function barChart(cv, labels, pos, neg, opts={}){
  const {ctx,W,H}=setupCanvas(cv,opts.h);
  if(!labels.length){ctx.fillStyle="#8b95a9";ctx.font="12px Segoe UI";ctx.fillText("No data — check NSE proxy / connection",12,24);return;}
  const pad={l:8,r:8,t:12,b:18};
  const mx=Math.max(...pos,...neg.map(Math.abs),1)*1.15;
  const bw=(W-pad.l-pad.r)/labels.length;
  const Y0=pad.t+(H-pad.t-pad.b)/2, hh=(H-pad.t-pad.b)/2;
  ctx.strokeStyle="#232b3d";ctx.beginPath();ctx.moveTo(pad.l,Y0);ctx.lineTo(W-pad.r,Y0);ctx.stroke();
  labels.forEach((lb,i)=>{
    const x=pad.l+i*bw+bw*0.15, w=bw*0.7;
    const hP=(pos[i]/mx)*hh, hN=(Math.abs(neg[i])/mx)*hh;
    if(pos[i]){ctx.fillStyle="#22c55e";ctx.fillRect(x,Y0-hP,w,hP);}
    if(neg[i]){ctx.fillStyle="#ef4444";ctx.fillRect(x,Y0,w,hN);}
    ctx.fillStyle="#8b95a9";ctx.font="9px Consolas";ctx.textAlign="center";ctx.fillText(lb,x+w/2,H-5);ctx.textAlign="left";
  });
}
function drawGauge(cv, pctVal, label, colorFn){
  const dpr=window.devicePixelRatio||1, s=120;
  cv.width=s*dpr;cv.height=s*dpr;cv.style.width=s+"px";cv.style.height=s+"px";
  const ctx=cv.getContext("2d");ctx.scale(dpr,dpr);
  const cx=s/2, cy=s/2, r=44, a0=Math.PI*0.75, a1=Math.PI*2.25;
  const col=colorFn?colorFn(pctVal):(pctVal>=50?"#22c55e":"#ef4444");
  ctx.lineWidth=11;ctx.lineCap="round";
  ctx.strokeStyle="#232b3d";ctx.beginPath();ctx.arc(cx,cy,r,a0,a1);ctx.stroke();
  ctx.strokeStyle=col;ctx.beginPath();ctx.arc(cx,cy,r,a0,a0+(a1-a0)*clamp(pctVal,0,100)/100);ctx.stroke();
  ctx.fillStyle=col;ctx.font="bold 19px Consolas";ctx.textAlign="center";
  ctx.fillText(Math.round(pctVal)+"%",cx,cy+7);
  ctx.fillStyle="#8b95a9";ctx.font="10px Segoe UI";ctx.fillText(label,cx,cy+26);
}
function sparkline(cv, data, color){
  const dpr=window.devicePixelRatio||1;
  const w=cv.getAttribute("width")*1||110, h=cv.getAttribute("height")*1||26;
  cv.width=w*dpr;cv.height=h*dpr;cv.style.width=w+"px";cv.style.height=h+"px";
  const ctx=cv.getContext("2d");ctx.scale(dpr,dpr);
  if(!data||data.length<2)return;
  const mn=Math.min(...data),mx=Math.max(...data),rg=mx-mn||1;
  ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.beginPath();
  data.forEach((v,i)=>{const x=4+(w-8)*i/(data.length-1),y=3+(h-6)*(1-(v-mn)/rg);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
  ctx.stroke();
}
function heatColor(chg){
  const v=clamp(chg,-4,4)/4; // -1..1
  if(v>=0) return `rgba(34,197,94,${0.18+0.72*v})`;
  return `rgba(239,68,68,${0.18-0.72*v})`;
}

/* ============================================================
   STATE
   ============================================================ */
let DATA=null;             // demo/live unified data
let PATTERNS=null;         // cached per-stock pattern results
let breadthTF="D";
let currentUniverse="50";
let wlOnly=false;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function universe(){ return currentUniverse==="50"?DATA.uni50:DATA.uni500; }
function computePatterns(){
  PATTERNS={};
  DATA.uni500.forEach(s=>{PATTERNS[s.sym]=detectPatterns(s);});
}

/* ============================================================
   SECTION RENDERERS
   ============================================================ */
const PAGE_META={
  overview:["Market Overview","Index pulse, EMA posture & PCR / VIX read"],
  radar:["Institutional Radar","FII/DII flow, volatility regime, option PCR & Max Pain"],
  breadth:["MA Breadth Gauge","% of stocks above 10/20/50/200 EMA — D/W/M"],
  sectors:["Sector Health Matrix","Sector tiles, constituent heatmap & rotation quadrant"],
  screener:["Universe Breadth Inspector","Nifty 50 / 500 deep-dive table"],
  patterns:["Pattern Scanner","Stage-2, breakouts, VCP, divergences, pivots, pullbacks"],
  data:["Data Source","Connect DhanHQ (dhan api) & NSE relay, pick data mode"]
};

function emaPillsHTML(obj){
  return SET.emas.map(p=>`<span class="pill ${obj.above(p)?"g":"r"}">${p} ${obj.above(p)?"▲":"▼"}</span>`).join("");
}
function indexTile(ix){
  const chg=ix.chg1d;
  return `<div class="tile ${chg>=0?"up":"down"}" onclick="openIndex('${ix.id}')">
    <div class="t-name"><span>${ix.name}</span><span>${ix.isVix?"vol":"idx"}</span></div>
    <div class="t-cmp">${fmt(ix.cmp, ix.cmp<100?2:0)}</div>
    <div class="t-chg ${cls(chg)}">${arrow(chg)} ${pct(chg)} <span class="muted" style="font-weight:400">1D</span></div>
    <div class="t-chg ${cls(ix.chg1m)}" style="font-size:11px;color:var(--muted)">${pct(ix.chg1m)} 1M</div>
    ${ix.isVix?`<div class="ema-pills"><span class="pill ${ix.cmp<15?"g":"r"}">${ix.cmp<15?"low vol":"elevated"}</span></div>`
             :`<div class="ema-pills">${emaPillsHTML(ix)}</div>`}
  </div>`;
}
function renderOverview(){
  $("#index-tiles").innerHTML=DATA.indices.map(indexTile).join("");
  const uni=universe();
  const adv=uni.filter(s=>s.chg1d>0).length, dec=uni.filter(s=>s.chg1d<0).length, flat=uni.length-adv-dec;
  $("#ad-sub").textContent=`${currentUniverse==="50"?"Nifty 50":"Nifty 500"} · A ${adv} / D ${dec} / F ${flat}`;
  const d60=Array.from({length:60},(_,i)=>{
    const slice=DATA.uni50.map(s=>s.candles.D.slice(0,200+i).map(c=>c.c));
    // cheap approximation: use current stocks with random walk offset — demo-friendly
    return clamp(adv/uni.length*100+ (i-60)*0.3 + randn()*6,5,95);
  });
  lineChart($("#ch-ad"),[{data:d60,color:"#22d3ee",fill:true}],{h:150,labels:["-60d","-45d","-30d","-15d","now"],nTick:4});
  const ixN=DATA.indices[0];
  const dist=DATA.indices.filter(i=>!i.isVix).map(i=>({n:i.name,v:+((i.cmp/i.ema[20]-1)*100).toFixed(2)}));
  const {ctx,W,H}=setupCanvas($("#ch-ema-dist"),150);
  const mx=Math.max(...dist.map(d=>Math.abs(d.v)),1)*1.2;
  dist.forEach((d,i)=>{
    const y=22+i*20, w=(Math.abs(d.v)/mx)*(W-160);
    ctx.fillStyle=d.v>=0?"#22c55e":"#ef4444";
    ctx.fillRect(W/2,y,w*(d.v>=0?1:-1),13);
    ctx.fillStyle="#e8ecf4";ctx.font="11px Segoe UI";ctx.textAlign="right";ctx.fillText(d.n,W/2-8,y+11);ctx.textAlign="left";
    ctx.fillStyle="#8b95a9";ctx.font="10px Consolas";ctx.fillText((d.v>=0?"+":"")+d.v+"%",W/2+ (d.v>=0?w+6:-w-42),y+11);
  });
  const vix=DATA.indices.find(i=>i.isVix);
  const niftyC=ixN.candles.D.slice(-30).map(d=>d.c), vixC=vix.candles.D.slice(-30).map(d=>d.c);
  const nrm=a=>a.map(x=>(x-a[0])/a[0]*100);
  lineChart($("#ch-vix"),[{data:nrm(niftyC),color:"#3b82f6",label:"Nifty"},{data:nrm(vixC),color:"#f59e0b"}],{h:150});
}

function renderRadar(){
  const L=DATA.fii.map((_,i)=>"S"+(DATA.fii.length-i));
  barChart($("#ch-fii"),L,DATA.fii.map(v=>Math.max(v,0)),DATA.fii.map(v=>Math.min(v,0)),{h:180});
  const fiiNet=DATA.fii.reduce((a,b)=>a+b,0), diiNet=DATA.dii.reduce((a,b)=>a+b,0);
  $("#fii-summary").innerHTML=`
    <span>FII 10D net</span><b class="${cls(fiiNet)}">${fiiNet>0?"+":""}${fmt(fiiNet,0)} Cr</b>
    <span>DII 10D net</span><b class="${cls(diiNet)}">${diiNet>0?"+":""}${fmt(diiNet,0)} Cr</b>
    <span>Institutional bias</span><b>${fiiNet+diiNet>0?"Risk-ON":"Risk-OFF"}</b>`;
  // volatility regime
  const vix=DATA.indices.find(i=>i.isVix);
  const regime=vix.cmp<13?["CALM","calm","Low vol — trend-friendly"]:vix.cmp<17?["NEUTRAL","neutral","Normal vol regime"]:["STRESS","stress","High vol — tighten risk"];
  $("#vol-regime").innerHTML=`<span class="badge ${regime[1]}">${regime[0]} · VIX ${fmt(vix.cmp)}</span><span class="muted">${regime[2]}</span>`;
  lineChart($("#ch-iv"),[{data:DATA.ivHist,color:"#a78bfa",fill:true,dots:true}],{h:120,labels:Array.from({length:6},(_,i)=>"T-"+(20-i*4))});
  const ivChg=(DATA.ivHist.at(-1)-DATA.ivHist.at(-2)).toFixed(2);
  $("#iv-summary").innerHTML=`<span>ATM IV (est)</span><b>${fmt(DATA.ivHist.at(-1))}% (${ivChg>0?"+":""}${ivChg})</b>
    <span>IV percentile</span><b>${Math.round(DATA.ivHist.filter(v=>v<DATA.ivHist.at(-1)).length/DATA.ivHist.length*100)}%</b>
    <span>Skew</span><b>${DATA.ivHist.at(-1)>13?"Put bid (defensive)":"Flat/Call bid"}</b>`;
  // PCR + max pain
  drawGauge($("#g-pcr"),clamp(DATA.pcr/2*100,2,98),"PCR "+DATA.pcr.toFixed(2),v=>v>55?"#22c55e":v<45?"#ef4444":"#f59e0b");
  const spot=DATA.indices[0].cmp;
  const pcrRead=DATA.pcr>1.3?"Oversold / put-heavy (contrarian bullish)":DATA.pcr<0.7?"Overbought / call-heavy (contrarian bearish)":"Balanced";
  $("#maxpain-box").innerHTML=(DATA.maxPain?`
    <div class="muted">Max Pain (expiry)</div>
    <div class="big">${fmt(DATA.maxPain,0)}</div>
    <div class="muted">Spot ${fmt(spot,0)}</div>`:`
    <div class="muted">Max Pain (expiry)</div><div class="big">—</div>
    <div class="muted">Connect Dhan in Data Source for option chain</div>`)+
    `<div style="margin-top:6px">PCR read: <b>${pcrRead}</b></div>`;
  // PCR strip by strike bucket
  const buckets=[...DATA.strikes].sort((a,b)=>a.strike-b.strike);
  const mxOi=Math.max(...buckets.map(b=>Math.max(b.ceOi,b.peOi)));
  $("#pcr-strip").innerHTML=buckets.map(b=>{
    const pcrB=b.ceOi?b.peOi/b.ceOi:1;
    return `<div class="bar" style="background:${pcrB>1.2?"rgba(34,197,94,.75)":pcrB<0.8?"rgba(239,68,68,.75)":"rgba(245,158,11,.75)"}" title="${b.strike} PCR ${pcrB.toFixed(2)}">${(b.strike/1000).toFixed(1)}k</div>`;
  }).join("");
  // option table
  $("#opt-table-wrap").innerHTML=`<table><thead><tr><th>Strike</th><th>CE OI</th><th>PE OI</th><th>PCR</th><th>CE IV</th><th>PE IV</th><th>Signal</th></tr></thead><tbody>${
    buckets.map(b=>{
      const pcrB=b.ceOi?b.peOi/b.ceOi:1;
      const sig=pcrB>1.5?"Support zone":pcrB<0.66?"Resistance zone":"—";
      return `<tr><td class="nm">${fmt(b.strike,0)}</td><td>${fmt(b.ceOi/1e6,2)}M</td><td>${fmt(b.peOi/1e6,2)}M</td>
      <td class="${pcrB>1.2?"up-txt":pcrB<0.8?"down-txt":""}">${pcrB.toFixed(2)}</td>
      <td>${fmt(b.ceIv,1)}</td><td>${fmt(b.peIv,1)}</td><td style="font-family:'Segoe UI'">${sig}</td></tr>`;
    }).join("")}</tbody></table>`;
}

const BREADTH_INDS=[
  ["ema10","Above 10 EMA"],["ema20","Above 20 EMA"],["ema50","Above 50 EMA"],["ema200","Above 200 EMA"],
  ["ad","Advance/Decline %"],["rsi55","RSI > 55 %"],["pivot","Above Daily Pivot %"]
];
function breadthNow(tf){
  const uni=universe();
  const key=tf==="D"?"D":tf==="W"?"W":"M";
  const cnt={ema10:0,ema20:0,ema50:0,ema200:0,ad:0,rsi55:0,pivot:0};
  uni.forEach(s=>{
    const cd=s.candles[key]; if(!cd||cd.length<2) return;
    const closes=cd.map(x=>x.c);
    const c=closes.at(-1);
    SET.emas.forEach(p=>{ if(c>ema(closes,p)) cnt["ema"+p]++; });
    if(s.chg1d>0) cnt.ad++;
    if(rsi(closes,SET.rsiPeriod)>55) cnt.rsi55++;
    if(c>pivots(cd).P) cnt.pivot++;
  });
  const n=uni.length, o={};
  Object.keys(cnt).forEach(k=>o[k]=+(cnt[k]/n*100).toFixed(1));
  return o;
}
function renderBreadth(){
  const now=breadthNow(breadthTF);
  const roles={"10":"Short-term momentum","20":"Short-term momentum","50":"Medium-term momentum","200":"Long-term momentum"};
  $("#breadth-gauges").innerHTML=SET.emas.map(p=>`
    <div class="gauge-card"><h4>% Above ${p} EMA</h4><div class="role">${roles[p]||""} · ${breadthTF==="D"?"Daily":breadthTF==="W"?"Weekly":"Monthly"}</div>
    <canvas id="bg-${p}"></canvas><div class="gval">${now["ema"+p]}%</div></div>`).join("");
  SET.emas.forEach(p=>drawGauge($("#bg-"+p),now["ema"+p],`>${p} EMA`));
  // indicator seg + history
  $("#breadth-ind-seg").innerHTML=BREADTH_INDS.map(([k,l],i)=>`<button class="seg-btn ${i===0?"active":""}" data-bi="${k}">${l.split(" ")[0]==="Above"?l.replace("Above ",""):l}</button>`).join("");
  $$("#breadth-ind-seg .seg-btn").forEach(b=>b.onclick=()=>{
    $$("#breadth-ind-seg .seg-btn").forEach(x=>x.classList.remove("active")); b.classList.add("active");
    drawBreadthHist(b.dataset.bi);
  });
  drawBreadthHist("ema20");
  $("#breadth-legend").innerHTML=BREADTH_INDS.map(([k,l])=>{
    const v=now[k];
    const col=k.startsWith("ema")?(v>=60?"#22c55e":v<=35?"#ef4444":"#f59e0b"):(v>=50?"#22c55e":"#ef4444");
    return `<div class="li"><span>${l}</span><b style="color:${col}">${v}%</b></div>`;
  }).join("");
}
function drawBreadthHist(ind){
  const lab=BREADTH_INDS.find(x=>x[0]===ind)[1];
  $("#breadth-hist-lab").textContent=lab+" · "+(breadthTF==="D"?"Daily":breadthTF==="W"?"Weekly":"Monthly");
  const hist=DATA.breadthHist[breadthTF][ind==="ema10"?"ema20":ind];
  lineChart($("#ch-breadth-hist"),[{data:hist,color:"#22d3ee",fill:true}],{h:200,labels:["-60","-40","-20","now"],zeroLine:ind==="ad"});
}

function renderSectors(){
  const sorted=[...DATA.sectorIdx].sort((a,b)=>b.chg1d-a.chg1d);
  $("#sector-tiles").innerHTML=sorted.map(sx=>`
    <div class="tile ${sx.chg1d>=0?"up":"down"}" onclick="openSector('${sx.sec}')">
      <div class="t-name"><span>${sx.sec}</span><span class="muted">${sx.ad}/${sx.ad+sx.dec}</span></div>
      <div class="t-cmp" style="font-size:17px">${fmt(sx.cmp,0)}</div>
      <div class="t-chg ${cls(sx.chg1d)}">${arrow(sx.chg1d)} ${pct(sx.chg1d)} <span style="font-weight:400" class="muted">1D</span></div>
      <div class="t-chg ${cls(sx.chg1m)}" style="font-size:11px;color:var(--muted)">${pct(sx.chg1m)} 1M</div>
      <div class="ema-pills">${emaPillsHTML(sx)}</div>
    </div>`).join("");
  // heatmap segments
  $("#sector-heat-seg").innerHTML=sorted.map((sx,i)=>`<button class="seg-btn ${i===0?"active":""}" data-sh="${sx.sec}">${sx.sec}</button>`).join("");
  $$("#sector-heat-seg .seg-btn").forEach(b=>b.onclick=()=>{ $$("#sector-heat-seg .seg-btn").forEach(x=>x.classList.remove("active")); b.classList.add("active"); drawHeatmap(b.dataset.sh); });
  drawHeatmap(sorted[0].sec);
  // rotation quadrant: x = RS (3M relative), y = RS momentum (1M change of RS)
  const {ctx,W,H}=setupCanvas($("#ch-rotation"),340);
  const xs=DATA.sectorIdx.map(s=>s.chg1m - DATA.indices[0].chg1m);
  const ys=DATA.sectorIdx.map(s=>s.chg1d - (DATA.indices[0].chg1d||0)); // RS momentum proxy
  const mx=Math.max(...xs.map(Math.abs),1)*1.25, my=Math.max(...ys.map(Math.abs),1)*1.25;
  const X=v=>W/2+(v/mx)*(W/2-50), Y=v=>H/2-(v/my)*(H/2-30);
  ctx.strokeStyle="#232b3d";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(W/2,16);ctx.lineTo(W/2,H-10);ctx.moveTo(34,H/2);ctx.lineTo(W-16,H/2);ctx.stroke();
  ctx.fillStyle="#8b95a9";ctx.font="10px Segoe UI";
  ctx.fillText("LEADING",W-70,30);ctx.fillText("WEAKENING",W-78,H-16);
  ctx.fillText("IMPROVING",44,30);ctx.fillText("LAGGING",44,H-16);
  ctx.fillText("RS →",W-52,H/2-6);ctx.save();ctx.translate(14,H/2+40);ctx.rotate(-Math.PI/2);ctx.fillText("RS momentum →",0,0);ctx.restore();
  DATA.sectorIdx.forEach((s,i)=>{
    const x=X(xs[i]), y=Y(ys[i]);
    const quad=(xs[i]>=0&&ys[i]>=0)?"#22c55e":(xs[i]>=0&&ys[i]<0)?"#f59e0b":(xs[i]<0&&ys[i]<0)?"#ef4444":"#3b82f6";
    ctx.fillStyle=quad;ctx.beginPath();ctx.arc(x,y,7,0,7);ctx.fill();
    ctx.fillStyle="#e8ecf4";ctx.font="bold 10px Segoe UI";ctx.fillText(s.sec.slice(0,10),x+9,y+3);
  });
  // sector flow table
  const flow=[...DATA.sectorIdx].sort((a,b)=>b.turnover-a.turnover);
  const totT=flow.reduce((a,b)=>a+b.turnover,0);
  $("#sector-flow-wrap").innerHTML=`<table><thead><tr>
    <th>Sector</th><th>CMP</th><th>1D%</th><th>1M%</th><th>A/D</th><th>Turnover share</th><th>CMF(20)</th><th>Above 20EMA</th><th>Rating</th></tr></thead><tbody>${
    flow.map(s=>{
      const above=s.members.filter(m=>m.above(20)).length/s.members.length*100;
      const cmf=+((s.ad-s.dec)/(s.ad+s.dec||1)*0.4+randn()*0.1).toFixed(2);
      const rating=above>=60&&s.chg1m>0?"Strong":above>=45?"Neutral":"Weak";
      return `<tr onclick="openSector('${s.sec}')"><td class="nm">${s.sec}</td><td>${fmt(s.cmp,0)}</td>
      <td class="${cls(s.chg1d)}">${pct(s.chg1d)}</td><td class="${cls(s.chg1m)}">${pct(s.chg1m)}</td>
      <td>${s.ad}/${s.dec}</td><td>${fmt(s.turnover/totT*100,1)}%</td>
      <td class="${cls(cmf)}">${fmt(cmf,2)}</td><td>${above.toFixed(0)}%</td>
      <td style="font-family:'Segoe UI'"><span class="tag ${rating==="Strong"?"L":rating==="Neutral"?"M":"S"}">${rating}</span></td></tr>`;
    }).join("")}</tbody></table>`;
}
function drawHeatmap(sec){
  const sx=DATA.sectorIdx.find(s=>s.sec===sec);
  const stocks=[...sx.members].sort((a,b)=>b.chg1d-a.chg1d);
  $("#heatmap").innerHTML=stocks.map(s=>`
    <div class="hm-cell" style="background:${heatColor(s.chg1d)}" onclick="openStock('${s.sym}')" title="${s.name} · ${pct(s.chg1d)}">
      <b>${s.sym}</b><span>${pct(s.chg1d)}</span></div>`).join("");
}

/* ---------------- screener ---------------- */
function isWatched(sym){ return SET.watchlists.some(w=>w.symbols.includes(sym)); }
function starBtn(sym){
  const on=isWatched(sym)?"on":"";
  return `<button class="star ${on}" onclick="event.stopPropagation();toggleWatch('${sym}',this)">★</button>`;
}
function emaCellHTML(s){
  return SET.emas.map(p=>{
    const a=s.above(p), c=a==null?"n":a?"g":"r";
    return `<span class="pill ${c}" style="padding:1px 5px;font-size:9.5px">${p}</span>`;
  }).join(" ");
}
function renderScreener(){
  const q=$("#q").value.trim().toUpperCase();
  const fc=$("#f-cap").value, fs=$("#f-sector").value, sort=$("#f-sort").value;
  let rows=universe().filter(s=>
    (!q || s.sym.includes(q)||s.name.toUpperCase().includes(q)||s.sector.toUpperCase().includes(q)) &&
    (!fc || s.cap===fc[0]) && (!fs || s.sector===fs));
  if(wlOnly) rows=rows.filter(s=>isWatched(s.sym));
  const pf=PATTERNS;
  if($("#flt-ema-stack").checked) rows=rows.filter(s=>pf[s.sym].stack);
  if($("#flt-bull-x").checked) rows=rows.filter(s=>pf[s.sym].bullCross);
  if($("#flt-rsi-ma").checked) rows=rows.filter(s=>pf[s.sym].rsiMa);
  if($("#flt-oversold").checked) rows=rows.filter(s=>pf[s.sym].oversoldPb);
  if($("#flt-nearhigh").checked) rows=rows.filter(s=>s.belowHigh>-15);
  rows.sort((a,b)=>b[sort]-a[sort]);
  $("#screener-count").textContent=`${rows.length} of ${universe().length} stocks · universe: Nifty ${currentUniverse}`;
  const capName={L:"Large",M:"Mid",S:"Small"};
  $("#screener-table").innerHTML=`<table><thead><tr>
    <th></th><th>Stock</th><th>Cap</th><th>Sector</th><th>CMP</th><th>1D%</th><th>1W%</th><th>1M%</th>
    <th>RSI</th><th>7D trend</th><th>Volume</th><th>Vol spike</th><th>Gap up</th><th>EMAs</th>
    <th>% from 20EMA</th><th>% below 52W H</th><th>% above 52W L</th><th>Prev earn</th><th>Earn impact</th><th>Next earn</th>
  </tr></thead><tbody>${rows.map(s=>{
    const spark=s.candles.D.slice(-7).map(d=>d.c);
    return `<tr onclick="openStock('${s.sym}')">
    <td>${starBtn(s.sym)}</td>
    <td><div class="nm">${s.sym}</div><div class="sec">${esc(s.name)}</div></td>
    <td><span class="cap-badge ${s.cap}">${capName[s.cap][0]}</span></td>
    <td style="font-family:'Segoe UI'">${s.sector}</td>
    <td><b>${fmt(s.cmp)}</b></td>
    <td class="${cls(s.chg1d)}">${pct(s.chg1d)}</td>
    <td class="${cls(s.chg1w)}">${pct(s.chg1w)}</td>
    <td class="${cls(s.chg1m)}">${pct(s.chg1m)}</td>
    <td style="color:${s.rsi>70?"#f87171":s.rsi<30?"#4ade80":"inherit"}">${fmt(s.rsi,1)}</td>
    <td><canvas class="spark" data-spark="${s.sym}" width="90" height="24"></canvas></td>
    <td>${fmt(s.vol/1e5,1)}L</td>
    <td class="${s.volSpike>=SET.volSpike?"up-txt":"muted"}" style="${s.volSpike>=SET.volSpike?"font-weight:700":""}">${fmt(s.volSpike,2)}×</td>
    <td class="${cls(s.gapUp)}">${pct(s.gapUp)}</td>
    <td style="text-align:left">${emaCellHTML(s)}</td>
    <td class="${s.emaPct20>=0?"up-txt":"down-txt"}">${pct(s.emaPct20)}</td>
    <td class="down-txt" style="${s.belowHigh>-10?"color:#f87171;font-weight:700":""}">${fmt(s.belowHigh,1)}%</td>
    <td class="up-txt">${fmt(s.aboveLow,0)}%</td>
    <td style="font-family:'Segoe UI'">${s.prevEarning}</td>
    <td class="${s.earnImpact==null?"muted":cls(s.earnImpact)}" style="${s.earnImpact!=null&&Math.abs(s.earnImpact)>=3?"font-weight:700":""}">${s.earnImpact==null?"—":pct(s.earnImpact)}</td>
    <td style="font-family:'Segoe UI'">${s.nextEarning}</td></tr>`;
  }).join("")}</tbody></table>`;
  $$("#screener-table canvas.spark").forEach(cv=>{
    const s=universe().find(x=>x.sym===cv.dataset.spark);
    const d=s.candles.D.slice(-7).map(x=>x.c);
    sparkline(cv,d,d.at(-1)>=d[0]?"#22c55e":"#ef4444");
  });
}
function toggleWatch(sym,btn){
  // add to first watchlist (or toggle everywhere)
  let w=SET.watchlists[0];
  const inWl=SET.watchlists.some(x=>x.symbols.includes(sym));
  SET.watchlists.forEach(x=>x.symbols=x.symbols.filter(s=>s!==sym));
  if(!inWl){ w.symbols.push(sym); toast(sym+" added to "+w.name); }
  else toast(sym+" removed from watchlists");
  saveSettings();
  $$("#screener-table .star").forEach(b=>{
    const tr=b.closest("tr"); // no sym attr; simpler: rerender
  });
  renderScreener();
}

/* ---------------- pattern scanner ---------------- */
const PATTERN_DEFS=[
 ["stage2","Stage 2 scores (≥5/7)", s=>PATTERNS[s.sym].stage2.score>=5, s=>PATTERNS[s.sym].stage2.score+"/7"],
 ["breakout","Base breakouts", s=>!!PATTERNS[s.sym].breakout, s=>PATTERNS[s.sym].breakout?.volX+"× vol"],
 ["vcp","VCP patterns", s=>!!PATTERNS[s.sym].vcp, s=>PATTERNS[s.sym].vcp?.contractions.join("→")+"%"],
 ["div","RSI divergences", s=>!!PATTERNS[s.sym].div, s=>PATTERNS[s.sym].div?.type],
 ["pivot","Pivot posture (above P)", s=>PATTERNS[s.sym].piv.pos>0, s=>"P "+pct(PATTERNS[s.sym].piv.pos)],
 ["oversold","Oversold pullbacks", s=>PATTERNS[s.sym].oversoldPb, s=>"RSI "+s.rsi],
 ["stack","EMA stack aligned", s=>PATTERNS[s.sym].stack, s=>"10>20>50>200"],
 ["bullcross","Bullish EMA cross", s=>PATTERNS[s.sym].bullCross, s=>"cross ≤5d"]
];
let curPattern="stage2";
function renderPatterns(){
  $("#pattern-tabs").innerHTML=PATTERN_DEFS.map(([k,label])=>{
    const n=DATA.uni500.filter(s=>PATTERNS[s.sym][k==="stage2"?"stage2":k] && (k==="stage2"?PATTERNS[s.sym].stage2.score>=5:true)).length;
    return `<button class="seg-btn ${k===curPattern?"active":""}" data-pat="${k}">${label} <span class="muted">(${k==="stage2"?DATA.uni500.filter(s=>PATTERNS[s.sym].stage2.score>=5).length:n})</span></button>`;
  }).join("");
  $$("#pattern-tabs .seg-btn").forEach(b=>b.onclick=()=>{curPattern=b.dataset.pat;renderPatterns();});
  $("#pattern-summary").innerHTML=PATTERN_DEFS.slice(0,4).map(([k,label,fn])=>{
    const hits=DATA.uni500.filter(fn);
    return `<div class="card"><div class="card-h">${label}</div><div style="font-family:var(--mono);font-size:26px;font-weight:700">${hits.length}</div><div class="muted" style="font-size:11px;margin-top:4px">${hits.slice(0,4).map(s=>s.sym).join(", ")||"none"}${hits.length>4?"…":""}</div></div>`;
  }).join("");
  const [k,label,fn,note]=PATTERN_DEFS.find(d=>d[0]===curPattern);
  $("#pattern-title").textContent=label+" — Nifty 500";
  const hits=DATA.uni500.filter(fn).sort((a,b)=>b.chg1d-a.chg1d);
  $("#pattern-table").innerHTML=`<table><thead><tr>
    <th></th><th>Stock</th><th>Sector</th><th>CMP</th><th>1D%</th><th>RSI</th><th>Detail</th><th>EMAs</th><th>52W pos</th><th>Vol spike</th></tr></thead><tbody>${
    hits.map(s=>`<tr onclick="openStock('${s.sym}')"><td>${starBtn(s.sym)}</td>
      <td><div class="nm">${s.sym}</div><div class="sec">${esc(s.name)}</div></td>
      <td style="font-family:'Segoe UI'">${s.sector}</td><td><b>${fmt(s.cmp)}</b></td>
      <td class="${cls(s.chg1d)}">${pct(s.chg1d)}</td><td>${fmt(s.rsi,1)}</td>
      <td style="font-family:'Segoe UI';color:var(--cyan)">${note(s)}</td>
      <td style="text-align:left">${emaCellHTML(s)}</td>
      <td>${fmt(s.belowHigh,0)}% below H</td>
      <td class="${s.volSpike>=SET.volSpike?"up-txt":"muted"}">${fmt(s.volSpike,2)}×</td></tr>`).join("")||`<tr><td colspan="10" style="text-align:center;padding:24px">No qualified setups right now — relax thresholds in Settings</td></tr>`}</tbody></table>`;
  if($("#sec-patterns").classList.contains("active")) $("#screener-count").textContent="";
}

/* ---------------- stock / index / sector detail modals ---------------- */
function openModal(id){ $(id).classList.add("open"); }
function closeModals(){ $$(".modal").forEach(m=>m.classList.remove("open")); }
$$("[data-close]").forEach(b=>b.onclick=closeModals);
$$(".modal").forEach(m=>m.addEventListener("click",e=>{ if(e.target===m) closeModals(); }));

function candleChart(cv, candles, opts={}){
  const {ctx,W,H}=setupCanvas(cv,opts.h||260);
  const pad={l:10,r:10,t:14,b:20};
  const n=candles.length, show=opts.n||90;
  const seg=candles.slice(-show);
  const mn=Math.min(...seg.map(x=>x.l)), mx=Math.max(...seg.map(x=>x.h)), rg=mx-mn||1;
  const bw=(W-pad.l-pad.r)/n;
  const X=i=>pad.l+i*bw+bw/2, Y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-mn)/rg);
  const off=n-seg.length;
  seg.forEach((d,i)=>{
    const x=X(i+off), up=d.c>=d.o;
    ctx.strokeStyle=ctx.fillStyle=up?"#22c55e":"#ef4444";
    ctx.beginPath();ctx.moveTo(x,Y(d.h));ctx.lineTo(x,Y(d.l));ctx.stroke();
    const yO=Y(d.o), yC=Y(d.c);
    ctx.fillRect(x-bw*0.32, Math.min(yO,yC), bw*0.64, Math.max(1.5,Math.abs(yC-yO)));
  });
  if(opts.emas){
    Object.entries(opts.emas).forEach(([p,col])=>{
      const ser=emaSeries(candles.map(x=>x.c),+p).slice(-show);
      ctx.strokeStyle=col;ctx.lineWidth=1.3;ctx.beginPath();
      ser.forEach((v,i)=>{const x=X(i+off),y=Y(v);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.stroke();
    });
  }
}
const EMA_COLORS={10:"#22d3ee",20:"#f59e0b",50:"#a78bfa",200:"#e8ecf4"};

function openStock(sym){
  const s=DATA.uni500.find(x=>x.sym===sym); if(!s) return;
  const p=PATTERNS[sym];
  $("#ms-title").innerHTML=`${s.sym} <span class="muted">${esc(s.name)} · ${s.sector}</span>`;
  const capName={L:"Large cap",M:"Mid cap",S:"Small cap"};
  const piv=p.piv;
  $("#ms-body").innerHTML=`
  <div class="ms-head">
    <div><span class="cmp">${fmt(s.cmp)}</span>
      <span class="${cls(s.chg1d)}" style="font-family:var(--mono);font-weight:700;margin-left:10px">${pct(s.chg1d)} 1D</span>
      <span class="${cls(s.chg1w)}" style="font-family:var(--mono);margin-left:10px">${pct(s.chg1w)} 1W</span>
      <span class="${cls(s.chg1m)}" style="font-family:var(--mono);margin-left:10px">${pct(s.chg1m)} 1M</span></div>
    <div class="ema-pills">${emaPillsHTML(s)}<span class="tag ${s.cap}">${capName[s.cap]}</span></div>
  </div>
  <div class="ms-grid">
    <div>
      <canvas id="ms-chart"></canvas>
      <div class="muted" style="font-size:11px;margin-top:4px">Daily candles · EMAs ${SET.emas.join("/")}</div>
      <div class="kv" style="margin-top:10px">
        <span>52W high / low</span><b>${fmt(Math.max(...s.candles.D.slice(-260).map(d=>d.h)),0)} / ${fmt(Math.min(...s.candles.D.slice(-260).map(d=>d.l)),0)}</b>
        <span>Position vs 52W high</span><b class="down-txt">${fmt(s.belowHigh,1)}% below</b>
        <span>Distance from 20 EMA</span><b class="${s.emaPct20>=0?"up-txt":"down-txt"}">${pct(s.emaPct20)}</b>
        <span>RSI(${SET.rsiPeriod})</span><b>${fmt(s.rsi,1)}</b>
        <span>Volume spike (vs 9D)</span><b class="${s.volSpike>=SET.volSpike?"up-txt":""}">${fmt(s.volSpike,2)}×</b>
        <span>Gap up today</span><b class="${cls(s.gapUp)}">${pct(s.gapUp)}</b>
      </div>
      <div class="card-h" style="margin-top:12px">Pivots (classic)</div>
      <div class="kv">
        <span>Pivot P</span><b>${fmt(piv.P,2)} — ${piv.pos>0?"above":"below"} ${fmt(Math.abs(piv.pos),0)}%</b>
        <span>R1 / R2</span><b>${fmt(piv.R1,2)} / ${fmt(piv.R2,2)}</b>
        <span>S1 / S2</span><b>${fmt(piv.S1,2)} / ${fmt(piv.S2,2)}</b>
      </div>
      <div class="card-h" style="margin-top:12px">Pattern flags</div>
      <div class="ema-pills" style="text-align:left">
        <span class="pill ${p.stack?"g":"r"}">EMA stack</span>
        <span class="pill ${p.bullCross?"g":"r"}">Bull cross</span>
        <span class="pill ${p.rsiMa?"g":"r"}">RSI&gt;MA</span>
        <span class="pill ${p.breakout?"g":"n"}">Breakout ${p.breakout?p.breakout.volX+"×":""}</span>
        <span class="pill ${p.vcp?"g":"n"}">VCP ${p.vcp?p.vcp.contractions.join("/"):""}</span>
        <span class="pill ${p.div?"g":"n"}">${p.div?p.div.type+" div":"No div"}</span>
        <span class="pill ${p.oversoldPb?"g":"r"}">Oversold PB</span>
      </div>
      <div class="card-h" style="margin-top:12px">Earnings</div>
      <div class="kv">
        <span>Previous earnings</span><b>${s.prevEarning} — impact <span class="${cls(s.earnImpact||0)}">${s.earnImpact==null?"—":pct(s.earnImpact)}</span></b>
        <span>Next earnings</span><b>${s.nextEarning}</b>
      </div>
    </div>
    <div>
      <div class="card-h">Watchlist & notes</div>
      <div class="row wrap" style="margin-bottom:8px">${SET.watchlists.map((w,i)=>
        `<button class="btn" style="font-size:11.5px" onclick="addToWl(${i},'${sym}')">${w.symbols.includes(sym)?"✓ ":"+ "}${esc(w.name)}</button>`).join("")}
      </div>
      <div class="tpl-row">
        <button class="btn" onclick="insTpl('Breakout above ____ with volume ≥ ${SET.boVol}×')">Breakout tpl</button>
        <button class="btn" onclick="insTpl('Stage 2 score __/7 · base depth __%')">Stage-2 tpl</button>
        <button class="btn" onclick="insTpl('Buy zone __–__ · SL __ · target __')">Trade plan tpl</button>
      </div>
      <textarea id="ms-note" class="note-area" placeholder="Research notes for ${sym}…">${esc(SET.notes[sym]||"")}</textarea>
      <button class="btn primary" style="margin-top:8px" onclick="saveNote('${sym}')">Save note</button>
      <div class="card-h" style="margin-top:14px">Stage-2 checklist</div>
      <div class="kv">${p.stage2.checks.map(c=>`<span>${c[0]}</span><b style="color:${c[1]?"#4ade80":"#f87171"}">${c[1]?"PASS":"fail"}</b>`).join("")}
      <span><b>Score</b></span><b style="font-size:15px">${p.stage2.score} / 7</b></div>
    </div>
  </div>`;
  candleChart($("#ms-chart"), s.candles.D, {emas:EMA_COLORS, n:120, h:280});
  openModal("#modal-stock");
}
function addToWl(i,sym){
  const w=SET.watchlists[i];
  if(w.symbols.includes(sym)){ w.symbols=w.symbols.filter(s=>s!==sym); toast(sym+" removed from "+w.name); }
  else { w.symbols.push(sym); toast(sym+" added to "+w.name); }
  saveSettings(); openStock(sym);
}
function insTpl(t){ const ta=$("#ms-note"); ta.value+=(ta.value?"\n":"")+t; }
function saveNote(sym){ SET.notes[sym]=$("#ms-note").value; saveSettings(); toast("Note saved for "+sym); }

function openIndex(id){
  const ix=DATA.indices.find(x=>x.id===id); if(!ix) return;
  $("#ms-title").innerHTML=`${ix.name} <span class="muted">index</span>`;
  $("#ms-body").innerHTML=`
    <div class="ms-head"><div><span class="cmp">${fmt(ix.cmp,ix.cmp<100?2:0)}</span>
      <span class="${cls(ix.chg1d)}" style="font-family:var(--mono);font-weight:700;margin-left:10px">${pct(ix.chg1d)} 1D</span></div>
      <div class="ema-pills">${emaPillsHTML(ix)}</div></div>
    <canvas id="ms-chart"></canvas>
    <div class="kv" style="margin-top:10px;max-width:420px">
      <span>Distance from 20 EMA</span><b class="${ix.cmp>=ix.ema[20]?"up-txt":"down-txt"}">${pct((ix.cmp/ix.ema[20]-1)*100)}</b>
      <span>Distance from 200 EMA</span><b class="${ix.cmp>=ix.ema[200]?"up-txt":"down-txt"}">${pct((ix.cmp/ix.ema[200]-1)*100)}</b>
      <span>1W / 1M</span><b>${pct(ix.chg1w)} / ${pct(ix.chg1m)}</b>
    </div>`;
  candleChart($("#ms-chart"), ix.candles.D, {emas:ix.isVix?{}:EMA_COLORS, n:150, h:300});
  openModal("#modal-stock");
}
function openSector(sec){
  const sx=DATA.sectorIdx.find(x=>x.sec===sec); if(!sx) return;
  $("#ms-title").innerHTML=`${sec} <span class="muted">sector · ${sx.members.length} constituents</span>`;
  const rows=[...sx.members].sort((a,b)=>b.chg1d-a.chg1d);
  $("#ms-body").innerHTML=`
    <div class="ms-head"><div><span class="cmp">${fmt(sx.cmp,0)}</span>
      <span class="${cls(sx.chg1d)}" style="font-family:var(--mono);font-weight:700;margin-left:10px">${pct(sx.chg1d)} 1D</span>
      <span class="${cls(sx.chg1m)}" style="font-family:var(--mono);margin-left:10px">${pct(sx.chg1m)} 1M</span></div>
      <div class="ema-pills">${emaPillsHTML(sx)}</div></div>
    <canvas id="ms-chart" style="margin-bottom:10px"></canvas>
    <div class="tbl-wrap" style="max-height:300px"><table><thead><tr><th>Stock</th><th>CMP</th><th>1D%</th><th>RSI</th><th>Vol spike</th><th>EMAs</th></tr></thead><tbody>${
      rows.map(s=>`<tr onclick="openStock('${s.sym}')"><td class="nm">${s.sym}</td><td>${fmt(s.cmp)}</td>
      <td class="${cls(s.chg1d)}">${pct(s.chg1d)}</td><td>${fmt(s.rsi,1)}</td>
      <td class="${s.volSpike>=SET.volSpike?"up-txt":"muted"}">${fmt(s.volSpike,2)}×</td>
      <td style="text-align:left">${emaCellHTML(s)}</td></tr>`).join("")}</tbody></table></div>`;
  candleChart($("#ms-chart"), sx.candles.D, {emas:EMA_COLORS, n:120, h:200});
  openModal("#modal-stock");
}

/* ---------------- settings modal ---------------- */
function loadSettingsUI(){
  $("#set-emas").value=SET.emas.join(",");
  $("#set-rsi").value=SET.rsiPeriod;
  $("#set-volspike").value=SET.volSpike;
  $("#set-oversold").value=SET.oversold;
  $("#set-basedepth").value=SET.baseDepth;
  $("#set-bovol").value=SET.boVol;
  $("#set-bohigh").value=SET.boNearHigh;
  $("#set-pbema").value=SET.pbEmaGuard;
  $("#wl-editor").innerHTML=SET.watchlists.map((w,i)=>`
    <div class="wl-row"><input class="input" value="${esc(w.name)}" onchange="SET.watchlists[${i}].name=this.value;saveSettings()">
    <span class="muted">${w.symbols.length} stocks</span>
    <button class="btn" onclick="SET.watchlists[${i}].symbols=[];saveSettings();loadSettingsUI();toast('Cleared')">Clear</button></div>`).join("");
}
$("#btn-settings").onclick=()=>{ loadSettingsUI(); openModal("#modal-settings"); };
$("#set-save").onclick=()=>{
  SET.emas=$("#set-emas").value.split(",").map(x=>parseInt(x.trim())).filter(x=>x>0);
  SET.rsiPeriod=+$("#set-rsi").value||14; SET.volSpike=+$("#set-volspike").value||2;
  SET.oversold=+$("#set-oversold").value||30; SET.baseDepth=+$("#set-basedepth").value||20;
  SET.boVol=+$("#set-bovol").value||1.8; SET.boNearHigh=+$("#set-bohigh").value||15;
  SET.pbEmaGuard=+$("#set-pbema").value||50;
  saveSettings(); closeModals(); rebuildAll(); toast("Settings applied — data recomputed");
};

/* ---------------- data source section ---------------- */
function loadDataUI(){
  $("#in-client").value=SET.dhan.clientId; $("#in-token").value=SET.dhan.token;
  $("#in-proxy").value=SET.dhan.proxy; $("#in-nse-proxy").value=SET.nseProxy;
  $("#in-prefer-dhan").checked=!!SET.preferDhanCandles;
  setModeUI();
}
function setModeUI(){
  $("#mode-live").classList.toggle("active",SET.mode==="live");
  $("#mode-demo").classList.toggle("active",SET.mode==="demo");
  const pill=$("#conn-pill");
  pill.classList.toggle("live",SET.mode==="live");
  $("#conn-label").textContent=SET.mode==="live"?"Live (Dhan+NSE)":"Demo Data";
}
$("#btn-dhan-test").onclick=async()=>{
  SET.dhan.clientId=$("#in-client").value.trim(); SET.dhan.token=$("#in-token").value.trim(); SET.dhan.proxy=$("#in-proxy").value.trim();
  saveSettings();
  const box=$("#dhan-status"); box.className="status-box"; box.textContent="Testing /v2/fundlimit …";
  try{
    let j=null, lastErr=null;
    for(let a=1;a<=2;a++){
      try{ j=await Dhan.test(); break; }
      catch(e){ lastErr=e; box.textContent=`Attempt ${a}/2: ${e.message}`+(a<2?" — retrying…":""); if(a<2) await new Promise(r=>setTimeout(r,1600)); }
    }
    if(!j) throw lastErr;
    box.classList.add("ok"); box.textContent="✓ Connected. Available margin: ₹"+fmt(j.availabelBalance??j.availableBalance??0);
    SET.mode="live"; saveSettings(); setModeUI(); toast("Dhan connected — switching to live mode");
  }catch(e){ box.classList.add("err"); box.textContent="✕ "+e.message+" — if this token works elsewhere, the shared public relay is blocking/rate-limiting you. Fix: run relay.py locally (python3 relay.py → paste http://localhost:8787/?url= as proxy) or deploy worker.js to Cloudflare."; }
};
$("#btn-dhan-clear").onclick=()=>{ SET.dhan={clientId:"",token:"",proxy:SET.dhan.proxy}; saveSettings(); loadDataUI(); toast("Dhan disconnected"); };
$("#btn-nse-save").onclick=()=>{ SET.nseProxy=$("#in-nse-proxy").value.trim(); saveSettings(); toast("NSE proxy saved"); };
$("#btn-nse-test").onclick=async()=>{
  SET.nseProxy=$("#in-nse-proxy").value.trim(); saveSettings();
  const box=$("#nse-status"); box.className="status-box"; box.textContent="Testing /api/allIndices …";
  try{ const j=await NSE.allIndices(); box.classList.add("ok"); box.textContent="✓ NSE reachable — "+(j.data?.length||0)+" indices returned."; }
  catch(e){ box.classList.add("err"); box.textContent="✕ "+e.message+" — browser is blocked by CORS; use a relay proxy."; }
};
$("#mode-live").onclick=()=>{ SET.mode="live"; saveSettings(); setModeUI(); refreshData(true); };
$("#mode-demo").onclick=()=>{ SET.mode="demo"; saveSettings(); setModeUI(); rebuildAll(); toast("Demo mode — synthetic data"); };

/* Live overlay: pull real quotes where possible, keep demo for the rest */
async function refreshData(manual=false){
  rebuildAll();                              // fresh synthetic base FIRST
  if(SET.mode!=="live"){ if(manual) toast("Demo data regenerated"); return; }
  let touched=false;
  try{
    const j=await NSE.allIndices();
    const map={"NIFTY 50":"NIFTY","NIFTY BANK":"BANKNIFTY","NIFTY 100":"LARGECAP","NIFTY MIDCAP 150":"MIDCAP","NIFTY SMALLCAP 250":"SMALLCAP","INDIA VIX":"VIX","S&P BSE SENSEX":"SENSEX"};
    (j.data||[]).forEach(r=>{
      const id=map[r.index]; if(!id) return;
      const ix=DATA.indices.find(x=>x.id===id); if(!ix) return;
      const v=parseFloat((r.last||"").replace(/,/g,""));
      const pc=parseFloat(r.percentChange);
      if(!isNaN(v)){ ix.cmp=v; }
      if(!isNaN(pc)) ix.chg1d=pc;
      touched=true;
    });
  }catch(e){ console.warn("NSE indices failed",e); }
  try{
    const f=await NSE.fiiDii();
    if(Array.isArray(f)&&f.length>=2){
      DATA.fii=f.slice(-10).map(r=>parseFloat((r.netValue||"0").replace(/,/g,""))||0);
      touched=true;
    }
  }catch(e){ console.warn("FII/DII failed",e); }
  try{
    const oc=await Dhan.optionChain(DHAN_IDS.NIFTY);
    if(oc?.data?.oc?.length){
      let ce=0,pe=0; const strikes=[];
      oc.data.oc.forEach(r=>{
        const s=r.strike_price||r.strike; const ceo=r.ce?.oi||r.ce_oi||0; const peo=r.pe?.oi||r.pe_oi||0;
        ce+=+ceo; pe+=+peo; strikes.push({strike:+s,ceOi:+ceo,peOi:+peo,ceIv:+(r.ce?.iv||r.ce_iv||12),peIv:+(r.pe?.iv||r.pe_iv||12)});
      });
      if(pe>0&&ce>0){ DATA.pcr=+(pe/ce).toFixed(2); DATA.strikes=strikes; touched=true; }
    }
  }catch(e){ console.warn("Dhan optionchain failed",e); }
  const act=$$(".sec.active")[0]; if(act) renderSection(act.id.replace("sec-",""));
  if(manual) toast(touched?"Live data merged ✓ (failed endpoints fell back to demo)":"Live endpoints unreachable — showing demo data", !touched);
}

/* ---------------- router & chrome ---------------- */
$$("#sb-nav .sb-item").forEach(b=>b.onclick=()=>{
  $$("#sb-nav .sb-item").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  const sec=b.dataset.sec;
  $$(".sec").forEach(s=>s.classList.remove("active"));
  $("#sec-"+sec).classList.add("active");
  $("#page-title").textContent=PAGE_META[sec][0];
  $("#tb-sub").textContent=PAGE_META[sec][1];
  renderSection(sec);
  window.scrollTo(0,0);
});
function renderSection(sec){
  ({overview:renderOverview, radar:renderRadar, breadth:renderBreadth, sectors:renderSectors,
    screener:renderScreener, patterns:renderPatterns, data:()=>{}}[sec]||(()=>{}))();
}
$$("#universe-seg .seg-btn, #screener-universe-seg .seg-btn").forEach(b=>b.onclick=()=>{
  currentUniverse=b.dataset.u;
  $$("#universe-seg .seg-btn, #screener-universe-seg .seg-btn").forEach(x=>x.classList.toggle("active",x.dataset.u===currentUniverse));
  renderOverview(); renderScreener();
});
$$("#tf-seg .seg-btn").forEach(b=>b.onclick=()=>{
  breadthTF=b.dataset.tf;
  $$("#tf-seg .seg-btn").forEach(x=>x.classList.toggle("active",x===b));
  renderBreadth();
});
["#q","#f-cap","#f-sector","#f-sort"].forEach(id=>$(id).addEventListener("input",renderScreener));
["#flt-ema-stack","#flt-bull-x","#flt-rsi-ma","#flt-oversold","#flt-nearhigh"].forEach(id=>$(id).addEventListener("change",renderScreener));
$("#wl-only").onclick=()=>{ wlOnly=!wlOnly; $("#wl-only").classList.toggle("primary",wlOnly); renderScreener(); };
$("#export-csv").onclick=()=>{
  const rows=universe();
  const head=["Symbol","Name","Cap","Sector","CMP","1D%","1W%","1M%","RSI","Volume","VolSpike","GapUp","EMA10","EMA20","EMA50","EMA200","%from20EMA","%below52WH","%above52WL","PrevEarn","EarnImpact","NextEarn"];
  const capName={L:"Large",M:"Mid",S:"Small"};
  const csv=[head.join(",")].concat(rows.map(s=>[s.sym,'"'+s.name+'"',capName[s.cap],s.sector,s.cmp,s.chg1d,s.chg1w,s.chg1m,s.rsi,s.vol,s.volSpike,s.gapUp,...SET.emas.map(p=>s.above(p)?"Y":"N"),s.emaPct20,s.belowHigh,s.aboveLow,s.prevEarning,s.earnImpact??"",s.nextEarning].join(","))).join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="marketview-nifty"+currentUniverse+".csv"; a.click();
  toast("CSV exported");
};
$("#btn-refresh").onclick=()=>refreshData(true);
$("#btn-connect").onclick=()=>{ $$("#sb-nav .sb-item").find(b=>b.dataset.sec==="data").click(); };
function tickClock(){ const d=new Date(); $("#clock").textContent=d.toLocaleTimeString("en-IN",{hour12:false})+" IST"; }
setInterval(tickClock,1000);

/* ---------------- boot ---------------- */
function rebuildAll(){
  DATA=buildDemoData();
  computePatterns();
  $$("#sb-nav .sb-item").forEach(b=>{ if(b.classList.contains("active")) renderSection(b.dataset.sec); });
}
// sector filter options
(function(){
  const sel=$("#f-sector");
  SECTORS.forEach(s=>{ const o=document.createElement("option"); o.textContent=s; sel.appendChild(o); });
})();
/* boot is handled by live.js (initApp) so live data loads before first paint */
window.addEventListener("resize",()=>{ const act=$$(".sec.active")[0]; if(act) renderSection(act.id.replace("sec-","")); });
