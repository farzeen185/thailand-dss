/* Thailand Water Storage Decision Support System. Farzeen Khan, Asian Institute of Technology, 2026. */
"use strict";

const TARG = ["CSR_seismic_adj", "GSFC_seismic_adj", "GravIS", "GravIS_GFZ", "G3P"];
const TLAB = {CSR_seismic_adj: "CSR (corrected)", GSFC_seismic_adj: "GSFC (corrected)", GravIS: "COST-G GravIS", GravIS_GFZ: "GFZ GravIS", G3P: "G3P", GRACE_ensemble: "Ensemble of 5"};
const SHORT = {CSR_seismic_adj: "CSR", GSFC_seismic_adj: "GSFC", GravIS: "COST-G", GravIS_GFZ: "GFZ", G3P: "G3P"};
const PCOL = {CSR: "#0072B2", GSFC: "#E69F00", CSR_seismic_adj: "#0072B2", GSFC_seismic_adj: "#E69F00", GravIS: "#009E73", GravIS_GFZ: "#CC79A7", G3P: "#8C564B", GRACE_ensemble: "#000000"};
const CLASS_COL = {High: "#dc2626", Medium: "#e8930c", Low: "#16a34a", Uncertain: "#8293a3"};
const HERO_COL = {High: "#ff5a5f", Medium: "#f6b04a", Low: "#34d399", Uncertain: "#8fa3b5"};
const ACTIONS = {
  High: "Introduce monthly groundwater-level monitoring, meter and license large abstractions, review dry-season irrigation demand, assess managed aquifer recharge.",
  Medium: "Verify the residual with wells and reservoir records, apply dry-season demand management, include in the next groundwater survey.",
  Low: "Storage change is small or mostly climate-driven: maintain the existing observation network.",
  Uncertain: "Affected by the 2004 earthquake signal or model limits: collect ground observations before deciding."
};
const W0 = {loss: 30, conf: 20, gw: 20, irr: 10, decline: 10, agree: 10};
const WLAB = {loss: "Residual loss", conf: "Confidence (95% range below zero)", gw: "Groundwater dependence", irr: "Irrigation intensity", decline: "Total storage decline", agree: "Product agreement"};
const DECOMP = [["grace", "#222222", "Corrected GRACE TWSA"], ["climate", "#332288", "TWSA climate"], ["residual", "#C0392B", "TWSA residual"]];
const RDBU = [[103,0,31],[178,24,43],[214,96,77],[244,165,130],[253,219,199],[247,247,247],[209,229,240],[146,197,222],[67,147,195],[33,102,172],[5,48,97]];
const FONT = 'Inter, "Segoe UI", Roboto, Arial, sans-serif';
const INK = "#10243a", MUTED = "#5b7083";

const view = document.getElementById("view");
const isPhone = () => window.matchMedia("(max-width: 700px)").matches;
let META, REG, GEO, BAS, NAME, DEF;
const ST = {ovMode: "five", ovProd: "GravIS", ovMap: "GravIS", rid: "TH", prod: "GravIS", view: "five", mdl: "A", prP: "GRACE_ensemble", flag: true, W: {...W0}};
const tsCache = {};
let charts = [];

const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.json(); });
const series = id => tsCache[id] || (tsCache[id] = getJSON(`data/ts/${id}.json`));
const isNum = v => v !== null && v !== undefined && !Number.isNaN(v);
function fmt(v, dec = 1, sign = true, suffix = "") {
  if (!isNum(v)) return "–";
  return ((sign && v >= 0 ? "+" : "") + v.toFixed(dec)).replace("-", "−") + suffix;
}

/* ---------- series maths ---------- */
function cont(values, dates) {
  const y = values.map(v => (isNum(v) ? v : NaN));
  let i = 0;
  while (i < y.length) {
    if (!Number.isNaN(y[i])) { i++; continue; }
    let j = i;
    while (j < y.length && Number.isNaN(y[j])) j++;
    if (i > 0 && j < y.length) {
      const a = y[i - 1], b = y[j], n = j - i + 1;
      for (let k = i; k < Math.min(j, i + 3); k++) y[k] = a + (b - a) * (k - i + 1) / n;
    }
    i = j;
  }
  dates.forEach((d, k) => { if (d >= "2017-07" && d <= "2018-05") y[k] = NaN; });
  return y;
}
function rolling(y, w, minp) {
  return y.map((_, i) => {
    let s = 0, n = 0;
    const lo = i - Math.floor(w / 2);
    for (let k = Math.max(0, lo); k <= Math.min(y.length - 1, lo + w - 1); k++) if (!Number.isNaN(y[k])) { s += y[k]; n++; }
    return n >= minp ? s / n : NaN;
  });
}
function deseason(y, dates) {
  const sum = {}, cnt = {};
  y.forEach((v, i) => { if (Number.isNaN(v)) return; const m = dates[i].slice(5, 7); sum[m] = (sum[m] || 0) + v; cnt[m] = (cnt[m] || 0) + 1; });
  return y.map((v, i) => { const m = dates[i].slice(5, 7); return v - sum[m] / cnt[m]; });
}

/* ---------- priority index ---------- */
const clamp = v => Math.min(1, Math.max(0, v));
function priority(p, W, flag) {
  const ws = Object.values(W).reduce((a, b) => a + b, 0) || 1;
  const rows = BAS.map(b => {
    const r = REG[b], rb = r.residual_by_product[p] || {}, a = r.attributes || {};
    const {lo, hi, trend: t} = rb;
    const x = {
      loss: clamp(-(t || 0) / 10),
      conf: (isNum(lo) && hi && hi > lo) ? clamp((0 - lo) / (hi - lo)) : 0,
      gw: clamp((a.gw_share_pct || 0) / 17),
      irr: clamp((a.irrigated_pct || 0) / 40),
      decline: clamp(-(((r.trend.GRACE_ensemble || {}).sen) || 0) / 10),
      agree: TARG.filter(k => ((r.residual_by_product[k] || {}).trend ?? 0) < 0).length / 5
    };
    const score = 100 * Object.keys(W).reduce((s, k) => s + W[k] * x[k], 0) / ws;
    const unc = (flag && r.group === "M_S") || (r.mcmc && r.mcmc.converged === false);
    const cls = unc ? "Uncertain" : score >= 60 ? "High" : score >= 35 ? "Medium" : "Low";
    return {id: b, Basin: NAME[b], Class: cls, Score: Math.round(score), Residual: t, GW: a.gw_share_pct, Irr: a.irrigated_pct};
  });
  const o = c => (c === "Uncertain" ? 1 : 0);
  return rows.sort((u, v) => o(u.Class) - o(v.Class) || v.Score - u.Score);
}
const counts = df => df.reduce((n, r) => (n[r.Class]++, n), {High: 0, Medium: 0, Low: 0, Uncertain: 0});

/* ---------- map ---------- */
let proj;
const ringsOf = g => (g.type === "Polygon" ? g.coordinates : g.coordinates.flat());
function setupProj() {
  const pts = GEO.features.flatMap(f => ringsOf(f.geometry).flat());
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.cos((y0 + y1) / 2 * Math.PI / 180), H = 300, s = H / (y1 - y0);
  proj = {x0, y1, k, s, W: (x1 - x0) * k * s, H};
}
function mapPaths(maxPts) {
  return GEO.features.map(f => {
    let d = "";
    ringsOf(f.geometry).forEach(ring => {
      if (ring.length < 8) return;
      const step = Math.max(1, Math.floor(ring.length / maxPts));
      const xy = ring.filter((_, i) => i % step === 0).map(p => `${((p[0] - proj.x0) * proj.k * proj.s).toFixed(1)},${((proj.y1 - p[1]) * proj.s).toFixed(1)}`);
      d += "M" + xy.join("L") + "Z";
    });
    return {id: f.id, d};
  });
}
function svgMap(fill, maxPts, cls) {
  const body = mapPaths(maxPts).map(p => `<path data-id="${p.id}" d="${p.d}" fill="${fill(p.id)}"${cls ? ` class="${cls(p.id)}"` : ""}><title>${NAME[p.id]}</title></path>`).join("");
  return `<svg viewBox="-2 -2 ${(proj.W + 4).toFixed(1)} ${proj.H + 4}" role="img" aria-label="Map of the river basins of Thailand">${body}</svg>`;
}
function rdbu(v) {
  if (!isNum(v)) return "#e3e9ee";
  const t = clamp((v + 8) / 16) * (RDBU.length - 1), i = Math.min(RDBU.length - 2, Math.floor(t)), f = t - i;
  return "rgb(" + [0, 1, 2].map(c => Math.round(RDBU[i][c] + (RDBU[i + 1][c] - RDBU[i][c]) * f)).join(",") + ")";
}
function tapMap(el, onTap) {
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-id]");
    if (!p) return;
    el.querySelectorAll("path.on").forEach(n => n.classList.remove("on"));
    p.classList.add("on");
    p.parentNode.appendChild(p);
    onTap(p.dataset.id);
  });
}

/* ---------- charts ---------- */
let cleanups = [];
function runCleanups() { cleanups.forEach(f => f()); cleanups = []; }
function disposeCharts() { charts.forEach(c => c.dispose()); charts = []; }
function mount(el, option) {
  const c = echarts.init(el);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) option.animation = false;
  c.setOption(option);
  charts.push(c);
}
const axisFont = {color: MUTED, fontSize: 12, fontFamily: FONT};
function lineChart(el, list, ytitle, dates) {
  const phone = isPhone();
  const x = dates.map(d => d + "-01");
  const s = list.map((l, i) => ({
    name: l.name, type: "line", showSymbol: false, connectNulls: false, smooth: false,
    lineStyle: {color: l.color, width: l.width || 2, type: l.dash ? "dashed" : "solid"}, itemStyle: {color: l.color},
    data: l.y.map((v, k) => [x[k], Number.isNaN(v) ? null : +v.toFixed(3)]),
    ...(i === 0 ? {
      markLine: {silent: true, symbol: "none", animation: false, lineStyle: {color: "#dc2626", type: "dotted", width: 1.4}, data: [{xAxis: "2004-12-26"}], label: {formatter: "2004 earthquake", position: "end", color: "#dc2626", fontSize: 11, fontFamily: FONT}},
      markArea: {silent: true, animation: false, itemStyle: {color: "#e7edf2"}, label: {formatter: "Satellite gap", position: "top", color: MUTED, fontSize: 11, fontFamily: FONT}, data: [[{xAxis: "2017-07-01"}, {xAxis: "2018-05-31"}]]}
    } : {})
  }));
  mount(el, {
    animationDuration: 500,
    textStyle: {fontFamily: FONT, color: INK},
    grid: {left: 54, right: 12, top: 28, bottom: phone ? (list.length > 3 ? 72 : 52) : 56},
    legend: {bottom: 0, left: 0, icon: "roundRect", itemWidth: 16, itemHeight: 3, itemGap: 12, textStyle: {fontSize: 12, color: INK, fontFamily: FONT}},
    tooltip: {
      trigger: "axis", confine: true, textStyle: {fontFamily: FONT, fontSize: 13, color: INK}, axisPointer: {type: "line", lineStyle: {color: "#9fb1c0"}},
      formatter: ps => `<b>${ps[0].value[0].slice(0, 7)}</b><br>` + ps.map(q => `${q.marker}${q.seriesName}: <b>${fmt(q.value[1], 1, false)}</b>`).join("<br>")
    },
    xAxis: {type: "time", min: "2002-01-01", max: "2025-01-01", splitNumber: phone ? 4 : 6, axisLine: {lineStyle: {color: "#c6d3dd"}}, axisTick: {show: false}, splitLine: {show: false}, axisLabel: {...axisFont, formatter: "{yyyy}", hideOverlap: true}},
    yAxis: {type: "value", name: ytitle, nameLocation: "middle", nameGap: 40, nameTextStyle: {color: MUTED, fontSize: 12, fontFamily: FONT}, splitLine: {lineStyle: {color: "#edf2f6"}}, axisLabel: {...axisFont, formatter: v => String(v).replace("-", "−")}},
    series: s
  });
}
function barChart(el, sc) {
  const wg = sc[0].watergap;
  const names = ["CSR", "GSFC", "COST-G", "GFZ", "G3P"];
  mount(el, {
    animationDuration: 500,
    textStyle: {fontFamily: FONT, color: INK},
    grid: {left: 54, right: 8, top: 22, bottom: 28},
    tooltip: {show: false},
    xAxis: {type: "category", data: names, axisTick: {show: false}, axisLine: {onZero: false, lineStyle: {color: "#c6d3dd"}}, axisLabel: {...axisFont, color: INK, interval: 0}},
    yAxis: {type: "value", min: -170, max: 125, name: "Dec-2004 jump (mm)", nameLocation: "middle", nameGap: 42, nameTextStyle: {color: MUTED, fontSize: 12, fontFamily: FONT}, splitLine: {lineStyle: {color: "#edf2f6"}}, axisLabel: {...axisFont, formatter: v => String(v).replace("-", "−")}},
    series: [{
      type: "bar", barWidth: "62%",
      data: sc.map(r => ({
        value: r.jump, itemStyle: {color: PCOL[r.product], borderRadius: r.jump >= 0 ? [6, 6, 0, 0] : [0, 0, 6, 6]},
        label: {show: true, position: r.jump >= 0 ? "top" : "bottom", formatter: `${fmt(r.jump, 0)} mm\n${r.passed ? "PASS" : "FAIL"}`, color: INK, fontSize: 12, fontFamily: FONT, lineHeight: 15}
      })),
      markArea: {silent: true, animation: false, itemStyle: {color: "#e3f2ea"}, label: {formatter: "normal range", position: "insideBottomRight", color: MUTED, fontSize: 11, fontFamily: FONT}, data: [[{yAxis: wg - 83}, {yAxis: wg + 66}]]},
      markLine: {silent: true, symbol: "none", animation: false, lineStyle: {color: "#D55E00", type: "dotted", width: 1.6}, data: [{yAxis: wg}], label: {formatter: `WaterGAP ${fmt(wg, 0)} mm`, position: "insideEndTop", color: "#D55E00", fontSize: 11, fontFamily: FONT}}
    }]
  });
}

/* ---------- shared pieces ---------- */
const kpis = items => `<div class="kpis">${items.map(([v, l, a]) => `<div class="kpi" style="--a:${a}"><div class="d"></div><div class="v">${v}</div><div class="l">${l}</div></div>`).join("")}</div>`;
const options = (list, sel, lab = TLAB) => list.map(k => `<option value="${k}"${k === sel ? " selected" : ""}>${lab[k]}</option>`).join("");
const seg = (id, items, val) => `<div class="seg" id="${id}" role="group">${items.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${v === val}">${t}</button>`).join("")}</div>`;
const tags = df => { const n = counts(df); return `<div class="tags">${Object.keys(CLASS_COL).map(c => `<span class="tag" style="background:${CLASS_COL[c]}">${c}: ${n[c]}</span>`).join("")}</div>`; };
function rankRows(df) {
  return `<div class="rows">${df.map((r, i) => `<details><summary><span class="rk" style="background:${CLASS_COL[r.Class]}">${i + 1}</span><span class="nm">${r.Basin}<span class="tr"><i style="width:${r.Score}%;background:${CLASS_COL[r.Class]}"></i></span></span><span class="sc">${r.Score}</span><span class="ch"></span></summary><div class="dt"><div><b>${fmt(r.Residual)}</b>Residual, mm/yr</div><div><b>${fmt(r.GW, 0, false, "%")}</b>Groundwater share</div><div><b>${fmt(r.Irr, 0, false, "%")}</b>Area irrigated</div></div><a class="open" href="#basins/${r.id}">Open this basin →</a></details>`).join("")}</div>`;
}
const FOOT = '<div class="foot">Farzeen Khan · Master of Engineering, Water Engineering and Management · Asian Institute of Technology · 2026. Residual values include model error and should be confirmed with ground observations before management decisions.</div>';
function onSeg(id, fn) {
  document.getElementById(id).addEventListener("click", e => { const b = e.target.closest("button"); if (b) fn(b.dataset.v); });
}
const onVal = (id, fn) => document.getElementById(id).addEventListener("change", e => fn(e.target.value));

/* ---------- pages ---------- */
async function pageBasins() {
  const rid = ST.rid, prod = ST.prod, r = REG[rid], a = r.attributes || {}, tr = r.trend[prod] || {}, rb = r.residual_by_product[prod] || {};
  const labels = {TH: "Thailand (national)"};
  BAS.forEach(b => { labels[b] = `${b} · ${NAME[b]}`; });
  let tag = "";
  if (rid !== "TH") { const c = DEF.find(x => x.id === rid); tag = ` <span class="tag" style="background:${CLASS_COL[c.Class]}">${c.Class} · ${c.Score}</span>`; }
  const sk = (r.skill || {})[prod] || {};
  view.innerHTML = `
  <div class="card"><div class="ctl">
    <label class="f">Basin<select id="exB">${options(["TH", ...BAS], rid, labels)}</select></label>
    <label class="f">Product<select id="exP">${options(TARG, prod)}</select></label>
    ${seg("exV", [["five", "Five products"], ["dec", "Decomposition"], ["fit", "Model fit"]], ST.view)}
  </div>${ST.view === "five" ? "" : seg("exM", [["A", "Model A (physical)"], ["B", "Model B (random forest)"]], ST.mdl)}</div>
  <div class="sec" id="exTitle">${rid === "TH" ? "Thailand (national)" : NAME[rid]}${tag}</div>
  ${kpis([[fmt(tr.sen), "Storage trend, mm/yr", "#0d9488"], [fmt(rb.trend), "Residual trend, mm/yr", "#C0392B"], [fmt(rb.climate), "Climate trend, mm/yr", "#332288"], [fmt(a.irrigated_pct, 0, false, "%"), "Area irrigated", "#16a34a"], [fmt(a.gw_share_pct, 0, false, "%"), "Irrigation from groundwater", "#e8930c"]])}
  <div class="two wide">
    <div class="card"><div class="chart" id="exChart"></div></div>
    <div class="card"><div class="note" style="text-align:center">Tap a basin to open it</div><div class="map" id="exMap"></div></div>
  </div>
  ${rid !== "TH" ? `<div class="callout"><b>How well the model fits (${TLAB[prod]}).</b> Calibration NSE ${fmt(sk.cal, 2, false)} · prediction-test NSE ${fmt(sk.pred, 2, false)} · r ${fmt(sk.r, 2, false)}</div>` : ""}
  ${r.group === "M_S" ? '<div class="callout warn"><b>Southern peninsula basin.</b> Nearest the 2004 earthquake, so results are uncertain.</div>' : ""}
  ${FOOT}`;
  document.getElementById("exMap").innerHTML = svgMap(id => (rid === "TH" || id === rid ? "#0d9488" : "#d7e3ec"), 120);
  tapMap(document.getElementById("exMap"), id => { location.hash = `#basins/${id}`; });
  onVal("exB", v => { location.hash = v === "TH" ? "#basins" : `#basins/${v}`; });
  onVal("exP", v => { ST.prod = v; render(true); });
  onSeg("exV", v => { ST.view = v; render(true); });
  if (ST.view !== "five") onSeg("exM", v => { ST.mdl = v; render(true); });
  const s = await series(rid);
  let list;
  if (ST.view === "five") list = TARG.map(k => ({name: isPhone() ? SHORT[k] : TLAB[k], color: PCOL[k], width: 1.6, y: cont(s.model[k].grace, s.dates)}));
  else if (ST.view === "dec") list = DECOMP.map(([c, col, nm]) => ({name: c === "grace" ? nm : `${nm} (Model ${ST.mdl})`, color: col, width: 1.9, y: cont(s.model[prod][c === "grace" || ST.mdl === "A" ? c : c + "_B"], s.dates)}));
  else list = [{name: "Detrended GRACE TWSA", color: PCOL[prod], width: 2.5, y: cont(s.model[prod].detrended, s.dates)}, {name: `TWSA climate (Model ${ST.mdl})`, color: ST.mdl === "A" ? "#332288" : "#882255", width: 1.5, dash: true, y: cont(s.model[prod][ST.mdl === "A" ? "climate" : "climate_B"], s.dates)}];
  disposeCharts();
  lineChart(document.getElementById("exChart"), list, "TWSA (mm)", s.dates);
}

function pagePriority() {
  view.innerHTML = `
  <div class="sec">Which basins need action first?</div><div class="secsub">Change the weights and the map, ranking and actions update at once.</div>
  <div class="two side">
    <div class="card">
      <label class="f">GRACE product<select id="prP">${options(["GRACE_ensemble", ...TARG], ST.prP)}</select></label>
      <label class="chk"><input type="checkbox" id="prF"${ST.flag ? " checked" : ""}> Mark southern basins as Uncertain</label>
      <details class="w"${isPhone() ? "" : " open"}><summary>Adjust the weights</summary><div class="in">
        ${Object.keys(W0).map(k => `<label class="sl"><span>${WLAB[k]} <b id="v_${k}">${ST.W[k]}</b></span><input type="range" min="0" max="50" step="5" value="${ST.W[k]}" data-k="${k}"></label>`).join("")}
        <button type="button" class="btn" id="prReset">Reset weights</button>
      </div></details>
    </div>
    <div class="card"><div class="map mfirst" id="prMap"></div><div class="read" id="prRead">Tap a basin</div><div id="prTags"></div></div>
  </div>
  <div class="sec">What to do</div><div class="acts" id="prActs"></div>
  <div class="sec">Ranking of all 22 basins</div><div class="secsub">Tap a basin for details.</div><div id="prRows"></div>
  <button type="button" class="btn" id="prCsv">Download ranking (CSV)</button>
  ${FOOT}`;
  let df;
  const update = () => {
    df = priority(ST.prP, ST.W, ST.flag);
    const byId = {};
    df.forEach(r => { byId[r.id] = r; });
    const box = document.getElementById("prMap");
    if (!box.firstChild) box.innerHTML = svgMap(id => CLASS_COL[byId[id].Class], 180);
    else box.querySelectorAll("path").forEach(p => p.setAttribute("fill", CLASS_COL[byId[p.dataset.id].Class]));
    document.getElementById("prTags").innerHTML = tags(df);
    document.getElementById("prActs").innerHTML = Object.keys(CLASS_COL).map(c => `<div class="act"><div class="h"><i style="background:${CLASS_COL[c]}"></i>${c} priority</div><div class="t">${ACTIONS[c]}</div><div class="bs"><b>Basins:</b> ${df.filter(r => r.Class === c).map(r => r.Basin).join(", ") || "None at these settings"}</div></div>`).join("");
    document.getElementById("prRows").innerHTML = rankRows(df);
    document.getElementById("prRead").textContent = "Tap a basin";
    box.querySelectorAll("path.on").forEach(n => n.classList.remove("on"));
  };
  update();
  tapMap(document.getElementById("prMap"), id => { const r = df.find(x => x.id === id); document.getElementById("prRead").textContent = `${r.Basin}: ${r.Class}, score ${r.Score}`; });
  onVal("prP", v => { ST.prP = v; update(); });
  document.getElementById("prF").addEventListener("change", e => { ST.flag = e.target.checked; update(); });
  view.querySelectorAll('input[type="range"]').forEach(inp => inp.addEventListener("input", () => { ST.W[inp.dataset.k] = +inp.value; document.getElementById("v_" + inp.dataset.k).textContent = inp.value; update(); }));
  document.getElementById("prReset").addEventListener("click", () => { ST.W = {...W0}; view.querySelectorAll('input[type="range"]').forEach(inp => { inp.value = W0[inp.dataset.k]; document.getElementById("v_" + inp.dataset.k).textContent = inp.value; }); update(); });
  document.getElementById("prCsv").addEventListener("click", () => {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["Basin,Class,Score,Residual (mm/yr),Groundwater share (%),Irrigated (%),Recommended action", ...df.map(r => [q(r.Basin), r.Class, r.Score, r.Residual ?? "", r.GW ?? "", r.Irr ?? "", q(ACTIONS[r.Class])].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], {type: "text/csv"}));
    a.download = "priority_ranking.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

/* ---------- routing ---------- */
let PAGES;
let lastPage = null;
function render(keepScroll) {
  const [p, arg] = (location.hash.replace("#", "") || "story").split("/");
  const page = PAGES[p] ? p : "story";
  if (page === "basins") ST.rid = arg && REG[arg] && BAS.includes(arg) ? arg : "TH";
  document.querySelectorAll("#nav a").forEach(a => { if (a.dataset.p === page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  view.className = page === "basins" || page === "priority" ? "wrap" : "";
  const y = window.scrollY;
  runCleanups();
  disposeCharts();
  Promise.resolve(PAGES[page]()).catch(showError);
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastPage = page;
}
function showError() {
  view.innerHTML = '<div class="callout warn"><b>The data could not be loaded.</b> Please check the internet connection and reload this page.</div>';
}

let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => charts.forEach(c => c.resize()), 120); });
window.addEventListener("hashchange", () => render(false));

document.addEventListener("DOMContentLoaded", async function start() {
  PAGES = {story: pageStory, basins: pageBasins, priority: pagePriority, results: pageResults};
  try {
    [{meta: META, regions: REG}, GEO] = await Promise.all([getJSON("data/results.json").then(R => ({meta: R.meta, regions: R.regions})), getJSON("data/basins.geojson")]);
    BAS = META.order.filter(k => /^\d+$/.test(k));
    NAME = Object.fromEntries(Object.entries(REG).map(([k, v]) => [k, v.name]));
    GEO.features.forEach(f => { f.id = String(f.properties.region ?? f.properties.id ?? "").padStart(2, "0"); });
    GEO.features = GEO.features.filter(f => BAS.includes(f.id));
    setupProj();
    DEF = priority("GRACE_ensemble", W0, true);
    window.__dss = {priority, cont, rolling, deseason, W0, REG, META};
    render(false);
  } catch (e) { console.error(e); showError(); }
});
