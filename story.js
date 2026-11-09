/* The Story page and the All Results library. */
"use strict";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sub = t => t.replace(/TWSA(climate|residual)/g, "TWSA<sub>$1</sub>");
const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const WAVE = (fill, d) => `<svg viewBox="0 0 2880 190" preserveAspectRatio="none" aria-hidden="true"><path fill="${fill}" d="${d}"/></svg>`;
const fg = n => `figs/${n}.webp`;
const figTag = (src, alt) => `<img class="fig" src="${src}" alt="${esc(alt)}" loading="lazy" data-zoom>`;

/* lightbox */
const box = document.getElementById("box");
document.addEventListener("click", e => {
  const im = e.target.closest("[data-zoom]");
  if (im) { box.querySelector("img").src = im.src; box.querySelector("img").alt = im.alt; box.hidden = false; }
});
box.addEventListener("click", e => { if (e.target === box || e.target.tagName === "BUTTON") box.hidden = true; });
document.addEventListener("keydown", e => { if (e.key === "Escape") box.hidden = true; });

function observeReveal() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    if (e.target.dataset.count !== undefined) countUp(e.target);
    e.target.querySelectorAll("[data-count]").forEach(countUp);
    io.unobserve(e.target);
  }), {rootMargin: "0px 0px -8% 0px", threshold: .08});
  view.querySelectorAll(".rv").forEach(n => io.observe(n));
  cleanups.push(() => io.disconnect());
}
function countUp(n) {
  if (n.dataset.done) return;
  n.dataset.done = "1";
  const to = +n.dataset.count, dec = +(n.dataset.dec || 0), pre = n.dataset.pre || "", suf = n.dataset.suf || "";
  const show = v => { n.textContent = pre + v.toFixed(dec).replace("-", "−") + suf; };
  if (reduced()) { show(to); return; }
  const t0 = performance.now(), dur = 1700;
  const tick = t => { const f = Math.min(1, (t - t0) / dur); show(to * (1 - Math.pow(1 - f, 3))); if (f < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* scroll progress */
function trackProgress() {
  const bar = document.getElementById("progress");
  const fn = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; };
  addEventListener("scroll", fn, {passive: true}); fn();
  cleanups.push(() => { removeEventListener("scroll", fn); bar.style.transform = "scaleX(0)"; });
}

/* scroll-driven steps */
function scrolly(root, onStep) {
  const steps = [...root.querySelectorAll(".st")];
  let cur = -1;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const i = steps.indexOf(e.target);
    if (i === cur) return;
    cur = i;
    steps.forEach((s, k) => s.classList.toggle("on", k === i));
    onStep(i);
  }), {rootMargin: isPhone() ? "-58% 0px -22% 0px" : "-45% 0px -45% 0px"});
  steps.forEach(s => io.observe(s));
  cleanups.push(() => io.disconnect());
  steps[0].classList.add("on");
  onStep(0); cur = 0;
}

/* story charts: same series names between steps, so lines glide from one state to the next */
function storyChart(el) {
  const c = echarts.init(el);
  charts.push(c);
  return c;
}
function range(list, x0, x1) {
  let lo = Infinity, hi = -Infinity;
  list.forEach(l => l.y.forEach((v, i) => { const d = l.x[i]; if (!Number.isNaN(v) && d >= x0 && d <= x1) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
  const pad = (hi - lo) * .08 || 10;
  return [Math.floor((lo - pad) / 10) * 10, Math.ceil((hi + pad) / 10) * 10];
}
function lineOpt(list, ytitle, x0 = "2002-01-01", x1 = "2025-01-01", marks = true) {
  const phone = isPhone();
  const [lo, hi] = range(list, x0, x1);
  return {
    animation: !reduced(), animationDuration: 900, animationDurationUpdate: 1000, animationEasingUpdate: "cubicInOut",
    textStyle: {fontFamily: FONT, color: INK},
    grid: {left: phone ? 46 : 54, right: 12, top: 24, bottom: phone ? 46 : 54},
    legend: {bottom: 0, left: 0, icon: "roundRect", itemWidth: 16, itemHeight: 3, itemGap: phone ? 8 : 12, textStyle: {fontSize: phone ? 11 : 12.5, color: INK, fontFamily: FONT}, selectedMode: false},
    tooltip: {trigger: "axis", confine: true, textStyle: {fontFamily: FONT, fontSize: 13, color: INK}, formatter: ps => `<b>${ps[0].value[0].slice(0, 7)}</b><br>` + ps.map(q => `${q.marker}${q.seriesName}: <b>${fmt(q.value[1], 1, false)}</b>`).join("<br>")},
    xAxis: {type: "time", min: x0, max: x1, splitNumber: phone ? 4 : 6, axisLine: {lineStyle: {color: "#c6d3dd"}}, axisTick: {show: false}, splitLine: {show: false}, axisLabel: {...axisFont, formatter: "{yyyy}", hideOverlap: true}},
    yAxis: {type: "value", min: lo, max: hi, name: ytitle, nameLocation: "middle", nameGap: phone ? 34 : 40, nameTextStyle: {color: MUTED, fontSize: 12, fontFamily: FONT}, splitLine: {lineStyle: {color: "#edf2f4"}}, axisLabel: {...axisFont, formatter: v => String(v).replace("-", "−")}},
    series: list.map((l, i) => ({
      id: l.id || l.name, name: l.name, type: "line", showSymbol: false, connectNulls: false, z: l.z || 2,
      lineStyle: {color: l.color, width: l.width || 2, type: l.dash ? "dashed" : "solid", opacity: l.fade ? .3 : 1}, itemStyle: {color: l.color},
      data: l.y.map((v, k) => [l.x[k], Number.isNaN(v) ? null : +v.toFixed(2)]),
      ...(i === 0 && marks ? {
        markLine: {silent: true, symbol: "none", animation: false, lineStyle: {color: "#dc2626", type: "dotted", width: 1.4}, data: [{xAxis: "2004-12-26"}], label: {formatter: "2004 earthquake", position: "end", color: "#dc2626", fontSize: 11, fontFamily: FONT}},
        markArea: {silent: true, animation: false, itemStyle: {color: "#e7edf0"}, label: {show: false}, data: [[{xAxis: "2017-07-01"}, {xAxis: "2018-05-31"}]]}
      } : {})
    }))
  };
}
function jumpOpt() {
  const order = ["CSR", "GSFC", "GravIS", "GravIS_GFZ", "G3P"], names = ["CSR", "GSFC", "COST-G", "GFZ", "G3P"];
  const sc = order.map(p => META.screening.find(r => r.product === p)), wg = sc[0].watergap;
  return {
    animation: !reduced(), animationDuration: 900,
    textStyle: {fontFamily: FONT, color: INK}, tooltip: {show: false},
    grid: {left: 54, right: 8, top: 24, bottom: 30},
    xAxis: {type: "category", data: names, axisTick: {show: false}, axisLine: {onZero: false, lineStyle: {color: "#c6d3dd"}}, axisLabel: {...axisFont, color: INK, interval: 0}},
    yAxis: {type: "value", min: -170, max: 125, name: "Dec-2004 jump (mm)", nameLocation: "middle", nameGap: 40, nameTextStyle: {color: MUTED, fontSize: 12, fontFamily: FONT}, splitLine: {lineStyle: {color: "#edf2f4"}}, axisLabel: {...axisFont, formatter: v => String(v).replace("-", "−")}},
    series: [{type: "bar", barWidth: "62%", data: sc.map(r => ({value: r.jump, itemStyle: {color: PCOL[r.product], borderRadius: r.jump >= 0 ? [6, 6, 0, 0] : [0, 0, 6, 6]}, label: {show: true, position: r.jump >= 0 ? "top" : "bottom", formatter: `${fmt(r.jump, 0)} mm\n${r.passed ? "PASS" : "FAIL"}`, color: INK, fontSize: 12, fontFamily: FONT, lineHeight: 15}})),
      markArea: {silent: true, animation: false, itemStyle: {color: "#e3f2ea"}, label: {formatter: "normal range", position: "insideBottomRight", color: MUTED, fontSize: 11, fontFamily: FONT}, data: [[{yAxis: wg - 83}, {yAxis: wg + 66}]]},
      markLine: {silent: true, symbol: "none", animation: false, lineStyle: {color: "#D55E00", type: "dotted", width: 1.6}, data: [{yAxis: wg}], label: {formatter: `WaterGAP ${fmt(wg, 0)} mm`, position: "insideEndTop", color: "#D55E00", fontSize: 11, fontFamily: FONT}}}]
  };
}

async function setupQuake() {
  const [th, so] = await Promise.all([series("TH"), series("M_S")]);
  const X = th.dates.map(d => d + "-01");
  const prep = (v, d) => {
    const y = deseason(cont(v, d), d);
    const base = y.filter((q, i) => d[i] <= "2004-11" && !Number.isNaN(q));
    const m = base.reduce((a, b) => a + b, 0) / base.length;
    return rolling(y.map(q => q - m), 3, 1);
  };
  const NM = {CSR: "CSR", GSFC: "GSFC", GravIS: "COST-G", GravIS_GFZ: "GFZ", G3P: "G3P"};
  const five = (s, fix) => ["CSR", "GSFC", "GravIS", "GravIS_GFZ", "G3P"].map(k => {
    const isF = fix && (k === "CSR" || k === "GSFC"), nc = !fix && (k === "CSR" || k === "GSFC");
    return {name: NM[k], color: PCOL[k], x: X, width: isF ? 2.8 : 2, dash: nc, z: isF ? 5 : 2, y: prep(isF ? s.model[k + "_seismic_adj"].grace : s.products[k], s.dates)};
  });
  const c = storyChart(document.getElementById("qChart")), ct = document.getElementById("qTitle");
  let wasBar = false;
  const line = (list, title, x0, x1) => { ct.textContent = title; c.setOption(lineOpt(list, "TWSA (mm), seasons removed", x0, x1), wasBar ? {notMerge: true} : false); wasBar = false; };
  scrolly(document.getElementById("qScroll"), i => {
    if (i === 0) line(five(th, false), "Thailand, before the earthquake (dashed = not corrected)", "2002-04-01", "2004-12-01");
    if (i === 1) line(five(th, false), "Thailand, all years (dashed = not corrected)");
    if (i === 2) { ct.textContent = "December 2004 jump of each product"; c.setOption(jumpOpt(), {notMerge: true}); wasBar = true; }
    if (i === 3) line(five(so, false), "Southern peninsula (dashed = not corrected)");
    if (i === 4) line(five(th, true), "Thailand, CSR and GSFC after correction");
  });
}

async function setupDecomp() {
  const s = await series("TH"), m = s.model.GRACE_ensemble;
  const X = s.dates.map(d => d + "-01");
  const prep = v => rolling(deseason(cont(v, s.dates), s.dates), 12, 6);
  const G = {id: "g", name: isPhone() ? "GRACE" : "Corrected GRACE TWSA", color: "#111111", width: 2.8, x: X, y: prep(m.grace)};
  const ph = isPhone(), nm = (a, b) => (ph ? b : a);
  const ca = {id: "ca", name: nm("TWSA climate, Model A", "Climate A"), color: "#332288", width: 2.2, x: X, y: prep(m.climate)};
  const cb = {id: "cb", name: nm("TWSA climate, Model B", "Climate B"), color: "#882255", width: 2.2, x: X, y: prep(m.climate_B)};
  const ra = {id: "ra", name: nm("TWSA residual, Model A", "Residual A"), color: "#C0392B", width: 2.6, x: X, y: prep(m.residual)};
  const rb = {id: "rb", name: nm("TWSA residual, Model B", "Residual B"), color: "#C0392B", width: 2.6, dash: true, x: X, y: prep(m.residual_B)};
  const c = storyChart(document.getElementById("dChart")), ct = document.getElementById("dTitle");
  const empty = l => ({...l, y: l.y.map(() => NaN)});
  scrolly(document.getElementById("dScroll"), i => {
    const fade = l => ({...l, fade: true});
    const sets = [[G, empty(ca), empty(cb), empty(ra), empty(rb)], [fade(G), ca, cb, empty(ra), empty(rb)], [fade(G), fade(ca), fade(cb), ra, rb]];
    ct.textContent = ["Corrected GRACE TWSA, Thailand (12-month average, seasons removed)", "TWSA climate from rain and temperature only", "TWSA residual = human water use + model error"][i];
    const o = lineOpt(sets[i], "TWSA (mm)");
    const [lo, hi] = range([G, ca, cb, ra, rb], "2002-01-01", "2025-01-01");
    o.yAxis.min = lo; o.yAxis.max = hi;
    if (ph) o.grid.bottom = 66;
    c.setOption(o);
  });
}

async function setupLapse() {
  const T = await getJSON("data/timelapse.json");
  const box = document.getElementById("lMap");
  box.innerHTML = svgMap(() => "#2a4256", 140);
  const paths = [...box.querySelectorAll("path")].map(p => [p, T.basins[p.dataset.id]]);
  const when = document.getElementById("lWhen"), ev = document.getElementById("lEv"), sl = document.getElementById("lSlide"), btn = document.getElementById("lPlay");
  const EV = [["2011-07", "2012-03", "2011 flood"], ["2015-05", "2016-07", "2015–16 drought"], ["2017-07", "2018-05", "Satellite gap"], ["2019-06", "2020-09", "2019–20 drought"]];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const color = v => { if (v === null) return "#2a4256"; const t = clamp((v + 150) / 300) * (RDBU.length - 1), i = Math.min(RDBU.length - 2, Math.floor(t)), f = t - i; return "rgb(" + [0, 1, 2].map(c => Math.round(RDBU[i][c] + (RDBU[i + 1][c] - RDBU[i][c]) * f)).join(",") + ")"; };

  // national sparkline
  const svg = document.getElementById("lSpark"), W = 400, H = 86, n = T.dates.length;
  const vals = T.th.filter(v => v !== null), lo = Math.min(...vals), hi = Math.max(...vals);
  const px = i => i / (n - 1) * W, py = v => H - 6 - (v - lo) / (hi - lo) * (H - 12);
  let d = "", pen = false;
  T.th.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`; pen = true; });
  svg.innerHTML = `<line x1="0" x2="${W}" y1="${py(0)}" y2="${py(0)}" stroke="rgba(255,255,255,.22)"/><path d="${d}" fill="none" stroke="#5eead4" stroke-width="1.800"/><line id="lHead" y1="0" y2="${H}" stroke="#ff6b5e" stroke-width="1.800"/><circle id="lDot" r="4" fill="#ff6b5e"/>`;
  const head = document.getElementById("lHead"), dot = document.getElementById("lDot");

  let k = 0;
  const draw = i => {
    k = i;
    paths.forEach(([p, v]) => p.setAttribute("fill", color(v[i])));
    const dt = T.dates[i];
    when.textContent = `${MON[+dt.slice(5, 7) - 1]} ${dt.slice(0, 4)}`;
    const e = EV.find(x => dt >= x[0] && dt <= x[1]);
    ev.textContent = e ? e[2] : "";
    sl.value = i;
    head.setAttribute("x1", px(i)); head.setAttribute("x2", px(i));
    const v = T.th[i];
    dot.setAttribute("cx", px(i)); dot.setAttribute("cy", v === null ? -20 : py(v));
  };
  let playing = false, last = 0, raf = 0;
  const frame = t => {
    if (!playing) return;
    if (t - last > 95) { last = t; draw(k >= n - 1 ? 0 : k + 1); }
    raf = requestAnimationFrame(frame);
  };
  const setPlay = on => { if (on === playing) return; playing = on; btn.textContent = on ? "❚❚" : "▶"; btn.setAttribute("aria-label", on ? "Pause" : "Play"); if (on) raf = requestAnimationFrame(frame); else cancelAnimationFrame(raf); };
  let userStopped = reduced();
  btn.addEventListener("click", () => { userStopped = playing; setPlay(!playing); });
  sl.max = n - 1;
  sl.addEventListener("input", () => { userStopped = true; setPlay(false); draw(+sl.value); });
  draw(reduced() ? n - 1 : 0);
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { if (!userStopped) setPlay(true); } else setPlay(false); }), {threshold: .35});
  io.observe(document.getElementById("lapse"));
  cleanups.push(() => { io.disconnect(); setPlay(false); });
}

function pageStory() {
  const H = META.headline, n = counts(DEF), cl = {};
  DEF.forEach(r => { cl[r.id] = r.Class; });
  const trendRows = BAS.map(b => ({id: b, name: NAME[b], ...(REG[b].trend.GRACE_ensemble || {})})).sort((a, b) => a.sen - b.sen);
  const maxAbs = Math.max(...trendRows.map(r => Math.abs(r.sen)));
  const bars = trendRows.map((r, i) => {
    const sig = r.q !== undefined && r.q !== null && r.q < .05, pos = r.sen >= 0;
    return `<div class="b ${sig ? "" : "ns"}" style="--d:${(i * .035).toFixed(2)}s"><span class="n">${r.name}</span><span class="t"><i style="--w:${(Math.abs(r.sen) / maxAbs * 100).toFixed(1)}%;--d:${(i * .035).toFixed(2)}s;--c:${pos ? "#2166ac" : "#c0392b"}"></i></span><span class="x">${fmt(r.sen)}</span></div>`;
  }).join("");
  const nse = [["CSR (corrected)", .75, .85, .85, .92], ["GSFC (corrected)", .44, .65, .81, .90], ["COST-G GravIS", .78, .87, .90, .94], ["GFZ GravIS", .72, .81, .86, .94], ["G3P", .83, .88, .91, .93]];
  const heat = v => { const t = clamp((v - .4) / .55); return `background:rgba(13,148,136,${(.08 + t * .62).toFixed(2)})`; };
  const heatCell = v => `<td class="c" style="${v < .5 ? "background:#fde2df;color:#b42318" : heat(v)}">${v.toFixed(2)}</td>`;

  view.innerHTML = `
  <section class="hero" id="hero">
    <div class="waves">${WAVE("rgba(94,234,212,.16)", "M0,70 C240,20 480,120 720,70 C960,20 1200,120 1440,70 C1680,20 1920,120 2160,70 C2400,20 2640,120 2880,70 L2880,190 L0,190 Z")}${WAVE("#f2f6f7", "M0,110 C240,70 480,150 720,110 C960,70 1200,150 1440,110 C1680,70 1920,150 2160,110 C2400,70 2640,150 2880,110 L2880,190 L0,190 Z")}</div>
    <div class="in-hero"><div>
      <div class="eye rv in">Decision Support System · 2002–2024</div>
      <h1 class="rv in">Thailand is <em>losing water.</em> Rain and temperature cannot explain the decline.</h1>
      <div class="lead rv in">Twenty-two years of satellite gravity data, corrected for the 2004 earthquake, separated into climate and human parts, and turned into basin priorities.</div>
      <div class="by rv in">Farzeen Khan · Master of Engineering, Water Engineering and Management · Asian Institute of Technology</div>
      <div class="nums rv in">
        <div class="num"><div class="v" data-count="${H.ens_sen}" data-dec="2">0</div><div class="l">mm/yr national storage trend, corrected</div></div>
        <div class="num"><div class="v" data-count="31" data-pre="≈ " data-suf=" km³">0</div><div class="l">water lost since 2002</div></div>
        <div class="num"><div class="v"><span data-count="${H.n_sig}">0</span> of 22</div><div class="l">basins with a significant decline</div></div>
        <div class="num"><div class="v"><span data-count="${n.High}">0</span> basins</div><div class="l">need action first</div></div>
      </div>
    </div><div class="hm">${svgMap(id => HERO_COL[cl[id]], 90, id => (cl[id] === "High" ? "pulse" : ""))}</div></div>
    <a class="cue" href="#" id="cue">Scroll to read ↓</a>
  </section>

  <section class="band" id="why"><div class="col">
    <div class="chap rv"><div class="no">01 · Why this study</div><h2>Satellites see the water disappear. They cannot say why.</h2><p>GRACE and GRACE-FO measure monthly changes in all water from gravity: soil, groundwater, rivers and reservoirs. A decline can come from dry years or from pumping.</p></div>
    <div class="cards3">
      <div class="tile rv"><h3>Water under pressure</h3><p>Thailand irrigates 12% of its land (37–40% in the central plains), increasingly from groundwater, and faced the 2011 flood and the 2015–16 and 2019–20 droughts.</p></div>
      <div class="tile rv" style="--d:.12s"><h3>The record is contaminated</h3><p>The 2004 Sumatra–Andaman earthquake left a gravity signal in Southeast Asia that looks like a loss of water.</p></div>
      <div class="tile rv" style="--d:.24s"><h3>The gap</h3><p>No study has separated climate and human storage change for Thailand with earthquake-corrected GRACE, or turned it into basin decisions.</p></div>
    </div>
    <ol class="qs">
      <li class="rv">How does terrestrial water storage vary across Thailand after accounting for the 2004 earthquake signal?</li>
      <li class="rv">How much of the storage change can rainfall and temperature explain, and is the unexplained part linked to human water use?</li>
      <li class="rv">How can this evidence be integrated into a basin-scale decision-support system?</li>
    </ol>
  </div></section>

  <section class="band white" id="approach"><div class="col">
    <div class="chap rv"><div class="no">02 · Approach</div><h2>22 basins, five satellite products, two climate models.</h2><p>The study covers 515,230 km² from 5.6 to 20.5°N, with rainfall of about 1,240–2,900 mm a year.</p></div>
    <div class="flow">${[["Five GRACE products", "CSR, GSFC, COST-G, GFZ, G3P on one 0.25° grid", "#0072B2"], ["Earthquake test", "Jump in Dec 2004 against WaterGAP and 780 normal months", "#dc2626"], ["Correct and trend", "Remove step and slow after-change; Sen slope, Mann–Kendall", "#E69F00"], ["Climate models", "Model A (physical) and Model B (random forest)", "#332288"], ["TWSA residual", "Human water use + model error; checked with wells and reservoirs", "#C0392B"], ["Decisions", "Priority index for all 22 basins", "#0d9488"]].map(([b, s, c], i) => `<div class="fl rv" style="--d:${i * .1}s;--c:${c}"><i></i><b>${b}</b><small>${s}</small></div>`).join("")}</div>
  </div></section>

  <section class="band" id="quake"><div class="col"><div class="chap rv"><div class="no">03 · The earthquake</div><h2>Half of the satellite products recorded a loss that never happened.</h2><p>Scroll to follow the test and the correction.</p></div></div>
    <div class="scrolly" id="qScroll">
      <div class="stick"><div class="ct" id="qTitle"></div><div class="chart" id="qChart"></div></div>
      <div class="steps">
        <div class="st"><h3>Before December 2004, all five agree</h3><p>Month by month the products tell the same story. The fall in late 2004 is a normal dry season, seen by all five. This is water.</p></div>
        <div class="st"><h3>Then CSR and GSFC split away</h3><p>From January 2005 they stay about 150 mm below the others for the whole record. The December 2004 solution covers the full month, so the 26 December earthquake shows up in January.</p></div>
        <div class="st"><h3>A test against 780 normal months</h3><p>CSR (−107 mm) and GSFC (−88 mm) drop while the others rise like WaterGAP (+15 mm). Their excess jumps of −122 and −103 mm lie outside the normal range of −83 to +66 mm.</p></div>
        <div class="st"><h3>The drop grows towards the epicentre</h3><p>In the southern peninsula the fall reaches −397 mm (CSR) and −256 mm (GSFC). Water does not depend on distance from an earthquake. Moving rock does.</p></div>
        <div class="st"><h3>Corrected: back with the others</h3><p>Fitting a sudden step and a slow after-change to GRACE − WaterGAP in every 0.25° cell lifts both products. The jump becomes +16 mm against WaterGAP's +15 mm, and CSR's trend moves from −7.3 to −3.2 mm/yr.</p></div>
      </div>
    </div>
  </section>

  <section class="band dark" id="lapse"><div class="col">
    <div class="chap rv"><div class="no">04 · Time-lapse</div><h2>Twenty-two years of Thailand's water, month by month.</h2><p>Corrected storage of the five-product ensemble in each basin, 12-month average. Watch the blue of 2011 give way to the red that follows.</p></div>
    <div class="lapse">
      <div class="map" id="lMap"></div>
      <div>
        <div class="when" id="lWhen" aria-live="off"></div>
        <div class="ev" id="lEv"></div>
        <svg class="spark" id="lSpark" viewBox="0 0 400 86" preserveAspectRatio="none" aria-label="National storage over time"></svg>
        <div class="note" style="color:#a9c1cf">Thailand, national storage</div>
        <div class="ctl2"><button class="play" id="lPlay" type="button" aria-label="Play">▶</button><input type="range" id="lSlide" min="0" value="0" aria-label="Month"></div>
        <div class="scale"><span>−150</span><i></i><span>+150 mm</span></div>
      </div>
    </div>
  </div></section>

  <section class="band white" id="trend"><div class="col">
    <div class="chap rv"><div class="no">05 · Where the water is going</div><h2>Nineteen of 22 basins are declining, most in the west and the central plains.</h2><p>All five corrected products decline. The northeast changes little. The far south is uncertain because it lies nearest the epicentre.</p></div>
    <div class="two2">
      <div class="bars rv">${bars}<div class="note" style="margin-top:8px">Sen slope of the ensemble, mm/yr. Hatched = not significant (FDR q ≥ 0.05).</div></div>
      <div>
        <div class="tile rv"><div class="big">−7.3 → ${fmt(REG.TH.trend.CSR_seismic_adj.sen)}</div><p>CSR national trend (mm/yr), not corrected → corrected</p></div>
        <div class="tile rv mt"><div class="big">−6.7 → ${fmt(REG.TH.trend.GSFC_seismic_adj.sen)}</div><p>GSFC national trend (mm/yr), not corrected → corrected. Without correction the loss was overstated about 2.5 times.</p></div>
        <div class="tile rv mt"><div class="big" data-count="${H.ens_sen}" data-dec="2">0</div><p>Ensemble trend (mm/yr), Mann–Kendall p &lt; 0.001: about 31 km³ lost since 2002.</p></div>
      </div>
    </div>
  </div></section>

  <section class="band" id="models"><div class="col">
    <div class="chap rv"><div class="no">06 · Two climate models</div><h2>If rain and temperature can rebuild the floods and droughts, what remains is not climate.</h2><p>Both models learn detrended GRACE TWSA, so the long-term decline stays out of the climate estimate. Neither can learn pumping.</p></div>
    <div class="cards3" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      <div class="tile rv"><h3>Model A: physical</h3><p>One water store keeps part of last month's storage and adds rain. Three parameters, calibrated by MCMC. Physically based and hard to overfit.</p></div>
      <div class="tile rv" style="--d:.12s"><h3>Model B: random forest</h3><p>300 decision trees use 15 rain and temperature inputs. Flexible, captures delays and droughts, and is tested on years it never saw.</p></div>
      <div class="tile rv" style="--d:.24s"><div class="big"><span data-count="19">0</span> of 20</div><p>tests on unseen years are satisfactory (NSE &gt; 0.5). Model B has higher NSE and lower RMSE in all ten pairs.</p></div>
    </div>
    <div class="tile rv mt"><h3>NSE on unseen years, TWSA climate vs detrended GRACE TWSA</h3>
      <div class="tw"><table class="heat"><tr><th>Product</th><th>A, test 2016–24</th><th>B, test 2016–24</th><th>A, test 2002–09</th><th>B, test 2002–09</th></tr>${nse.map(([p, ...v]) => `<tr><td>${p}</td>${v.map(heatCell).join("")}</tr>`).join("")}</table></div>
      <p class="note">Independent checks: WaterGAP r 0.94–0.97 · GLDAS r 0.81–0.88 (no groundwater or rivers) · ESA CCI soil moisture r 0.71–0.83.</p></div>
  </div></section>

  <section class="band white" id="split"><div class="col"><div class="chap rv"><div class="no">07 · Climate and people</div><h2>Climate gives the swings. The residual holds the decline.</h2></div></div>
    <div class="scrolly" id="dScroll">
      <div class="stick"><div class="ct" id="dTitle"></div><div class="chart" id="dChart"></div></div>
      <div class="steps">
        <div class="st"><h3>What the satellites measured</h3><p>Corrected GRACE TWSA rises and falls with floods and droughts, and drifts downward.</p></div>
        <div class="st"><h3>What climate can explain</h3><p>TWSA climate follows the 2011 flood and the 2015–16 and 2019–20 droughts, but its trend is near zero (Model A −0.1, Model B −0.6 mm/yr).</p></div>
        <div class="st"><h3>What climate cannot explain</h3><p>TWSA residual stays near zero until about 2010, then falls to about −80 mm after the 2019–20 drought, with only partial recovery after 2022. It declines −3.5 to −4.7 mm/yr (Model A) and −2.6 to −3.8 mm/yr (Model B), about 2 km³ a year. It equals human water use + model error.</p></div>
      </div>
    </div>
  </section>

  <section class="band" id="evidence"><div class="col">
    <div class="chap rv"><div class="no">08 · Testing the human signal</div><h2>Where irrigation relies more on groundwater, the residual matches wells better.</h2><p>The residual is tested only against independent ground records.</p></div>
    <div class="cards3">
      <div class="tile rv"><div class="big">ρ <span data-count="0.61" data-dec="2">0</span> / <span data-count="0.69" data-dec="2">0</span></div><p>Model A / Model B across 18 basins: agreement with wells against groundwater share of irrigation.</p></div>
      <div class="tile rv" style="--d:.12s"><div class="big">r <span data-count="0.30" data-dec="2">0</span> / <span data-count="0.39" data-dec="2">0</span></div><p>Model A / Model B against storage of 27 large reservoirs over 73 months: partial support.</p></div>
      <div class="tile rv" style="--d:.24s"><h3>Read with care</h3><p>National well records cover only eight years, too few to test. The residual also contains model error, and short records still limit attribution.</p></div>
    </div>
    <div class="tile rv mt">${figTag(fg("s39_1"), "Residual agreement with wells against groundwater irrigation share")}</div>
  </div></section>

  <section class="band dark" id="act"><div class="col">
    <div class="chap rv"><div class="no">09 · Decisions</div><h2>Five basins need action first.</h2><p>Priority scores combine residual loss, confidence, groundwater dependence, irrigation, total decline and product agreement.</p></div>
    <div class="rv">${rankRows(DEF.filter(r => r.Class === "High"))}</div>
    <div class="btns rv"><a class="btn go" href="#priority">Change the priorities yourself</a><a class="btn" href="#basins">Explore any basin</a><a class="btn" href="#results">See every result</a></div>
  </div></section>

  <section class="band white" id="end"><div class="col">
    <div class="chap rv"><div class="no">10 · Conclusions</div><h2>What this means.</h2></div>
    <div class="cards3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div class="tile rv"><h3>Earthquake</h3><p>Not-corrected CSR and GSFC contain a false drop after 2004 (−107 and −88 mm nationally, up to about −400 mm in the south). Correction reduces their trends from about −7 to −3 mm/yr.</p></div>
      <div class="tile rv"><h3>Storage decline</h3><p>Thailand is losing water at −2.68 mm/yr (p &lt; 0.001), about 31 km³ since 2002. 19 of 22 basins decline significantly.</p></div>
      <div class="tile rv"><h3>Climate and people</h3><p>Rain and temperature reproduce storage on unseen years but not the decline. TWSA residual falls −2.6 to −4.7 mm/yr.</p></div>
      <div class="tile rv"><h3>Management</h3><p>Priority goes to Phetchaburi–Prachuap, Chao Phraya, Tha Chin, Nan and Yom.</p></div>
    </div>
    <div class="two2 mt" style="margin-top:22px">
      <div class="tile rv"><h3>Limitations</h3><p>TWSA residual is not only pumping: it also contains model error and GRACE leakage. GRACE resolves about 300 km, so small and coastal basins are not independent and the south remains uncertain. Well records are short and mostly yearly, and no pumping records exist.</p></div>
      <div class="tile rv"><h3>Recommendations</h3><p>Do not use CSR or GSFC without earthquake correction in Southeast Asia. Start monthly groundwater monitoring in Yom, Nan, Chao Phraya and Tha Chin. Collect pumping and reservoir-operation records to test the ≈ 2 km³/yr TWSA residual.</p></div>
    </div>
    ${FOOT}
  </div></section>`;

  trackProgress();
  observeReveal();
  view.querySelectorAll(".hero [data-count]").forEach(countUp);
  requestAnimationFrame(() => setTimeout(() => document.getElementById("hero")?.classList.add("drained"), 300));
  document.getElementById("cue").addEventListener("click", e => { e.preventDefault(); document.getElementById("why").scrollIntoView({behavior: reduced() ? "auto" : "smooth"}); });
  return Promise.all([setupQuake(), setupDecomp(), setupLapse()]);
}

/* ---------- All results ---------- */
let LIB;
async function pageResults() {
  view.innerHTML = '<div class="wrap"><div class="loading">Loading all results…</div></div>';
  LIB = LIB || await getJSON("data/library.json");
  const active = ST.lib || "All";
  const list = LIB.items.filter(i => active === "All" || i.group === active);
  view.innerHTML = `<div class="wrap">
    <div class="sec">All results</div><div class="secsub">Every figure, table and finding of the study. Tap a figure to enlarge it.</div>
    <div class="chips" id="chips">${["All", ...LIB.groups].map(g => `<button type="button" data-g="${g}" aria-pressed="${g === active}">${g}</button>`).join("")}</div>
    ${list.map(it => `<article class="item"><div class="g">${it.group}</div><h3>${sub(esc(it.title))}</h3>
      ${it.text.length ? `<ul>${it.text.map(t => `<li>${sub(esc(t))}</li>`).join("")}</ul>` : ""}
      ${it.tables.map(rows => `<div class="tw"><table>${rows.map((r, i) => `<tr>${r.map(c => `<${i ? "td" : "th"}>${sub(esc(c))}</${i ? "td" : "th"}>`).join("")}</tr>`).join("")}</table></div>`).join("")}
      ${it.figs.length ? `<div class="figs ${it.figs.length > 1 ? "n2" : ""}">${it.figs.map(f => `<img class="fig" src="${f.src}" width="${f.w}" height="${f.h}" alt="${esc(it.title)}" loading="lazy" data-zoom>`).join("")}</div>` : ""}
    </article>`).join("")}${FOOT}</div>`;
  document.getElementById("chips").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) { ST.lib = b.dataset.g; pageResults().then(() => scrollTo(0, 0)); }
  });
}
