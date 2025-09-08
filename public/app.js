/* global Chart */
'use strict';

// ---------- tiny helpers (safe binding) ----------
const $    = (id) => document.getElementById(id);
const onId = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn, { passive: true }); return el; };

// ---------- tabs & panels ----------
let activeTab = 'ingest';
const panels = {};
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    document.querySelectorAll('section[role="tabpanel"]').forEach(p => p.hidden = true);
    if (panels[activeTab]) panels[activeTab].hidden = false;
    // refresh conferences view when switching to it
    if (activeTab === 'conferences' && lastRankings) buildConferenceRankings();
  });
});

panels.ingest      = $('panel-ingest');
panels.rank        = $('panel-rank');
panels.compare     = $('panel-compare');
panels.conferences = $('panel-conferences');

// ---------- theme toggle ----------
onId('themeToggle', 'change', (e) => {
  document.documentElement.dataset.theme = e.target.value;
});

// ---------- elements ----------
const ingestBtn     = $('ingestBtn');
const yearIngest    = $('yearIngest');
const endWeek       = $('endWeek');
const ingestMeta    = $('ingestMeta');
const refreshCache  = $('refreshCache');
const clearYear     = $('clearYear');
const clearAll      = $('clearAll');
const previewKind   = $('previewKind');
const previewWeek   = $('previewWeek');
const previewBtn    = $('previewBtn');
const previewOut    = $('previewOut');
const cacheFiles    = $('cacheFiles');

const yearRank      = $('yearRank');
const weekRank      = $('weekRank');
const rankBtn       = $('rankBtn');
const deltaBtn      = $('deltaBtn');
const rankTbody     = $('rankTbody');
const dataBadges    = $('dataBadges');
const profileSel    = $('profile');
const savePresetBtn = $('savePreset');
const loadPresetBtn = $('loadPreset');
const exportCsvBtn  = $('exportCsv');
const resetDefaultsBtn = $('resetDefaults');
const exportPdfBtn  = $('exportPdf');

// compare
const compareA   = $('compareA');
const compareB   = $('compareB');
const compareBtn = $('compareBtn');
const commonOpp  = $('commonOpp');
const h2h        = $('h2h');

// drawers (team)
const overlay        = $('drawerOverlay');
const drawer         = $('explainDrawer');
const drawerTitle    = $('drawerTitle');
const drawerSubtitle = $('drawerSubtitle');
const stackBar       = $('stackBar');
const stackLegend    = $('stackLegend');
const zScoresBox     = $('zScores');
const resumeBox      = $('resumeBox');
const recentGamesBox = $('recentGames');
onId('drawerClose', 'click', () => { if (drawer) drawer.classList.remove('open'); if (overlay) overlay.classList.remove('show'); });

// drawers (conference)
const confDrawer         = $('confDrawer');
const confDrawerTitle    = $('confDrawerTitle');
const confDrawerSubtitle = $('confDrawerSubtitle');
const confTeamsTbody     = $('confTeamsTbody');
onId('confDrawerClose', 'click', () => { if (confDrawer) confDrawer.classList.remove('open'); if (overlay) overlay.classList.remove('show'); });

// conferences controls
const confTopN      = $('confTopN');
const buildConfBtn  = $('buildConfBtn');
const confTbody     = $('confTbody');
const exportConfPdf = $('exportConfPdf');

// ---------- utils ----------
function fmt(n, d = 2) { return n == null ? '—' : Number(n).toFixed(d); }
function confBadge(conf) { const c = conf || ''; const bg = CONF_COLORS[c] || 'var(--chip)'; return `<span class="conf" style="background:${bg};color:#fff;padding:2px 8px;border-radius:999px">${c}</span>`; }
function showConfirm(msg, cb) { const confirmText = $('confirmText'); const confirmDlg = $('confirmDlg'); if (!confirmDlg || !confirmText) return cb && cb(); confirmText.textContent = msg; confirmDlg.showModal(); const onOk = () => { cb && cb(); confirmDlg.close(); cleanup(); }; const onCancel = () => { confirmDlg.close(); cleanup(); }; const cleanup = () => { $('confirmOk')?.removeEventListener('click', onOk); $('confirmCancel')?.removeEventListener('click', onCancel); }; onId('confirmOk', 'click', onOk); onId('confirmCancel', 'click', onCancel); }

// ---------- conference colors ----------
const CONF_COLORS = {
  "SEC":"#1f6feb","Big Ten":"#ffb000","ACC":"#013ca6","Big 12":"#c8102e",
  "Pac-12":"#00629b","AAC":"#00a0b0","MWC":"#662d91","Mountain West":"#662d91",
  "Sun Belt":"#ffcc00","MAC":"#006747","C-USA":"#003da5","CUSA":"#003da5",
  "Ind":"#444","Independent":"#444"
};

// ---------- dropdown population ----------
async function populateYears() {
  const r = await fetch('/api/cache-info').then(r=>r.json()).catch(()=>({}));
  const current = new Date().getFullYear();
  const fullRange = Array.from({length: current-2005+1}, (_,i)=> String(current-i));
  const cachedYears = Array.isArray(r.years) && r.years.length ? r.years.map(String) : fullRange;

  if (yearIngest) { yearIngest.innerHTML = ''; fullRange.forEach(y=> yearIngest.append(new Option(y,y))); }
  if (yearRank)   { yearRank.innerHTML   = ''; cachedYears.forEach(y=> yearRank.append(new Option(y,y))); }

  if (yearIngest && !yearIngest.value) yearIngest.value = fullRange[0];
  if (yearRank && !yearRank.value) yearRank.value = cachedYears[0];

  await populateWeeksForYear(yearIngest?.value || fullRange[0]);
}

async function populateWeeksForYear(year) {
  const r = await fetch(`/api/cache-info?year=${year}`).then(r=>r.json()).catch(()=>({}));
  let weeks = Array.isArray(r.weeks) ? r.weeks.map(String) : [];
  if (!weeks.length) { weeks = Array.from({length:20},(_,i)=> String(i+1)); }
  if (endWeek)  { endWeek.innerHTML  = '<option value="">All weeks</option>';  weeks.forEach(w=> endWeek.append(new Option(w,w))); }
  if (weekRank) { weekRank.innerHTML = '<option value="">All weeks</option>';  weeks.forEach(w=> weekRank.append(new Option(w,w))); }
}

if (yearIngest) onId('yearIngest', 'change', async ()=>{ await populateWeeksForYear(yearIngest.value); await loadCacheInfo(); });
if (yearRank)   onId('yearRank', 'change',   async ()=>{ await populateWeeksForYear(yearRank.value); });

// ---------- weight profiles ----------
const DEFAULT_WEIGHTS = {
  wElo: 0.50, wPlay: 0.25, wPrior: 0.10, sosWeight: 0.15,
  wPPA: 0.10, wMarket: 0.03, wReturn: 0.02, wExt: 0.00,
  wMov: 0.08, wOff: 0.07, wDef: 0.07,
  k: 20, hfa: 65, fcsWeight: 0.60
};

const PROFILE_PRESETS = {
  balanced:   { wElo:0.50, wPlay:0.25, wPrior:0.10, sosWeight:0.15, wPPA:0.10, wMarket:0.03, wReturn:0.02, wExt:0.00, wMov:0.08, wOff:0.07, wDef:0.07, k:20, hfa:65, fcsWeight:0.60 },
  predictive: { wElo:0.35, wPlay:0.35, wPrior:0.06, sosWeight:0.10, wPPA:0.12, wMarket:0.10, wReturn:0.02, wExt:0.00, wMov:0.06, wOff:0.10, wDef:0.08, k:24, hfa:65, fcsWeight:0.60 },
  resume:     { wElo:0.62, wPlay:0.18, wPrior:0.03, sosWeight:0.20, wPPA:0.05, wMarket:0.00, wReturn:0.00, wExt:0.12, wMov:0.12, wOff:0.04, wDef:0.06, k:18, hfa:65, fcsWeight:0.60 }
};

let weights = { ...DEFAULT_WEIGHTS };

const binds = [
  ['wElo', 'wEloV'], ['wPlay','wPlayV'], ['wPrior','wPriorV'], ['sosWeight','sosWeightV'],
  ['wPPA','wPPAV'], ['wMarket','wMarketV'], ['wReturn','wReturnV'], ['wExt','wExtV'],
  ['wMov','wMovV'], ['wOff','wOffV'], ['wDef','wDefV'],  ['k','kV'], ['hfa','hfaV'], ['fcsWeight','fcsWeightV']
];
binds.forEach(([id,vid])=>{
  const el = $(id);
  const vv = $(vid);
  if (!el) return;
  const setV = ()=>{
    const val = Number(el.value);
    weights[id] = val;
    if (vv) vv.textContent = (id==='k'||id==='hfa')? String(val) : val.toFixed(2);
  };
  el.addEventListener('input', setV);
  el.addEventListener('change', setV);
  setV();
});

const PRESETS_KEY = 'cfb_presets_v1';
function getPresets() { try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || {}; } catch { return {}; } }
function setPresets(p) { localStorage.setItem(PRESETS_KEY, JSON.stringify(p)); }

function readWeightsFromUI() { return { ...weights, profile: profileSel?.value || 'balanced' }; }

function setWeightsUI(w) {
  Object.entries(w).forEach(([id, val]) => {
    const el = $(id);
    if (!el) return;
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function applyWeightsToUI(w) {
  if (!w) return;
  Object.entries(w).forEach(([k,v])=>{
    if (k === 'profile') { if (profileSel) profileSel.value = v; return; }
    const el = $(k);
    const vv = $(k + 'V');
    if (el) {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles:true }));
      el.dispatchEvent(new Event('change', { bubbles:true }));
      if (vv && (k==='k' || k==='hfa')) vv.textContent = String(v);
    }
  });
}

function mean(arr) { if (!arr.length) return 0; return arr.reduce((a,b)=>a+b,0) / arr.length; }
function median(arr) { if (!arr.length) return 0; const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; }

function applyProfile(name) {
  const preset = PROFILE_PRESETS[name] || PROFILE_PRESETS.balanced;
  Object.entries(preset).forEach(([id, val]) => {
    const el = $(id);
    if (!el) return;
    el.value = String(val);
    el.dispatchEvent(new Event('input',  { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  });
}

// profile change
if (profileSel) {
  profileSel.addEventListener('change', () => {
    applyProfile(profileSel.value);
    if (yearRank && rankBtn) runRank(false);
  });
}

// ---------- buttons (safe bindings) ----------
onId('savePreset', 'click', () => {
  const name = prompt('Preset name?');
  if (!name) return;
  const presets = getPresets();
  presets[name] = readWeightsFromUI();
  setPresets(presets);
  alert(`Saved preset "${name}".`);
});

onId('loadPreset', 'click', () => {
  const presets = getPresets();
  const names = Object.keys(presets);
  if (!names.length) { alert('No presets saved yet.'); return; }
  const name = prompt(`Enter a preset name:\n${names.join(', ')}`);
  if (!name || !presets[name]) { alert('Preset not found.'); return; }
  applyWeightsToUI(presets[name]);
  alert(`Loaded preset "${name}".`);
});

onId('exportCsv', 'click', () => {
  const rows = (lastRankings && (lastRankings.rankings || lastRankings)) || [];
  if (!rows.length) { alert('Run a ranking first.'); return; }
  const csv = toCsv(rows);
  const blob = new Blob([csv], {type: 'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const yr = (lastRankings && lastRankings.year) || new Date().getFullYear();
  const wk = (lastRankings && lastRankings.throughWeek) || 'all';
  a.download = `cfb_rankings_${yr}_week-${wk}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

onId('exportPdf', 'click', () => {
  const rows = (lastRankings && (lastRankings.rankings || lastRankings)) || [];
  if (!rows.length) { alert('Run a ranking first.'); return; }

  const yr = (lastRankings && lastRankings.year) || new Date().getFullYear();
  const wk = (lastRankings && lastRankings.throughWeek) || 'All Weeks';
  const title = 'CompuRankings';
  const headerText = `${title} — Season ${yr} • Week ${wk || 'All'}`;

  const head = [[
    '#','Team','Conf','W','L','PF','PA','Diff','Win%','AvgM',
    'Elo','Play','Prior','Score','ΔRank','ΔScore','PPA','Market','Returning',
    'SoS Avg Elo','QW25','QW50','BadL','T25','T50','One-score'
  ]];

  const body = rows.map(r => {
    const ex = r.extras || {};
    const t25 = `${r.recTop25W||0}-${r.recTop25L||0}`;
    const t50 = `${r.recTop50W||0}-${r.recTop50L||0}`;
    const one = `${r.oneScoreW||0}-${r.oneScoreL||0}`;
    return [
      r.rank,
      r.team,
      r.conference || '',
      r.wins ?? 0,
      r.losses ?? 0,
      r.pointsFor ?? 0,
      r.pointsAgainst ?? 0,
      r.pointDiff ?? 0,
      (r.winPct==null? '—' : Number(r.winPct).toFixed(2)),
      (r.avgMargin==null? '—' : Number(r.avgMargin).toFixed(1)),
      (r.elo==null? '—' : Number(r.elo).toFixed(0)),
      (r.playQuality==null? '—' : Number(r.playQuality).toFixed(2)),
      (r.prior==null? '—' : Number(r.prior).toFixed(2)),
      (r.score==null? '—' : Number(r.score).toFixed(2)),
      r.deltaRank ?? '',
      (r.deltaScore==null? '—' : Number(r.deltaScore).toFixed(2)),
      (ex.ppa==null? '—' : Number(ex.ppa).toFixed(2)),
      (ex.market==null? '—' : Number(ex.market).toFixed(2)),
      (ex.returning==null? '—' : Number(ex.returning).toFixed(2)),
      (r.sosAvgElo==null? '—' : Number(r.sosAvgElo).toFixed(0)),
      r.qualityWins25 || 0,
      r.qualityWins50 || 0,
      r.badLosses || 0,
      t25,
      t50,
      one,
    ];
  });

  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  const doc = new jsPDFCtor({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(headerText, 40, 40);

  if (doc.autoTable) {
    doc.autoTable({
      startY: 60,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [22, 32, 68] },
      didDrawPage: (data) => {
        const s = new Date().toLocaleString();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated ${s}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
      },
    });
  } else {
    let y = 86;
    const lineH = 16;
    doc.text('#  Team                            Conf  W   L   PF   PA  Diff  Win%  AvgM  Elo  Play  Prior  Score  ΔR  ΔS  PPA  Mkt  Ret  SoS  QW25  QW50  BadL  T25  T50  1-score', 40, y);
    y += 8; doc.line(40, y, 802, y); y += 14;
    body.forEach(row => {
      const line = row.map(v => String(v)).join('  ').slice(0, 120);
      doc.text(line, 40, y);
      y += lineH;
      if (y > 560) { doc.addPage(); y = 40; }
    });
  }

  const fname = `compu_rankings_${yr}_week-${wk || 'all'}.pdf`;
  doc.save(fname);
});

onId('resetDefaults', 'click', () => {
  if (profileSel) profileSel.value = 'balanced';
  applyProfile(profileSel?.value || 'balanced');
});

onId('rankBtn', 'click', () => runRank(false));
onId('deltaBtn', 'click', () => runRank(true));

onId('buildConfBtn', 'click', () => buildConferenceRankings());
onId('exportConfPdf', 'click', () => exportConferencePdf());
onId('confTopN', 'change', () => { if (activeTab === 'conferences') buildConferenceRankings(); });

// ingest & cache
onId('ingestBtn', 'click', async () => {
  const year = (yearIngest && yearIngest.value) || new Date().getFullYear();
  const endW = (endWeek && endWeek.value) || '';
  if (ingestMeta) ingestMeta.textContent = 'Fetching...';
  const r = await fetch(`/api/ingest?year=${year}&endWeek=${endW}`).then(r=>r.json()).catch(e=>({error:e.message}));
  if (r.error) { if (ingestMeta) ingestMeta.textContent = 'Error: '+r.error; return; }
  if (ingestMeta) ingestMeta.textContent = `Cached: Teams ${r.datasets?.teams ?? 0}, Games ${r.datasets?.games ?? 0}, Adv ${r.datasets?.advanced ?? 0} — Last fetched: ${r.ingestedAt ? new Date(r.ingestedAt).toLocaleString() : '—'}`;
  await loadCacheInfo();
});

onId('refreshCache', 'click', () => { loadCacheInfo(); });

onId('clearYear', 'click', () => showConfirm('Clear cached data for this year?', async ()=>{
  const yr = (yearIngest && yearIngest.value) || new Date().getFullYear();
  await fetch(`/api/clear-cache?year=${yr}`,{method:'DELETE'});
  await loadCacheInfo(); if (previewOut) previewOut.textContent='';
}));

onId('clearAll', 'click', () => showConfirm('Clear ALL cached data?', async ()=>{
  await fetch(`/api/clear-cache`,{method:'DELETE'});
  await loadCacheInfo(); if (previewOut) previewOut.textContent='';
}));

onId('previewBtn', 'click', async () => {
  const yr = (yearIngest && yearIngest.value) || new Date().getFullYear();
  const kind = previewKind?.value || 'teams';
  const wk = previewWeek?.value || '';
  const url = `/api/cache-data?year=${yr}&kind=${kind}${wk?`&week=${wk}`:''}`;
  const r = await fetch(url).then(r=>r.json()).catch(e=>({error:e.message}));
  if (previewOut) previewOut.textContent = JSON.stringify(r,null,2);
});

// ---------- CSV ----------
function toCsv(rows) {
  if (!rows || !rows.length) return '';
  const pick = (o, k) => (o?.[k] ?? '');
  const headers = [
    'rank','team','conference','wins','losses','pointsFor','pointsAgainst','pointDiff',
    'winPct','avgMargin','elo','playQuality','prior','score','deltaRank','deltaScore',
    'ppa','market','returning','sosAvgElo','qualityWins25','qualityWins50',
    'badLosses','recTop25W','recTop25L','recTop50W','recTop50L','oneScoreW','oneScoreL'
  ];
  const lines = [];
  lines.push(headers.join(','));
  rows.forEach(r=>{
    const ex = r.extras || {};
    const vals = [
      pick(r,'rank'), pick(r,'team'), pick(r,'conference'), pick(r,'wins'), pick(r,'losses'),
      pick(r,'pointsFor'), pick(r,'pointsAgainst'), pick(r,'pointDiff'),
      pick(r,'winPct'), pick(r,'avgMargin'), pick(r,'elo'), pick(r,'playQuality'),
      pick(r,'prior'), pick(r,'score'), pick(r,'deltaRank'), pick(r,'deltaScore'),
      pick(ex,'ppa'), pick(ex,'market'), pick(ex,'returning'), pick(r,'sosAvgElo'),
      pick(r,'qualityWins25'), pick(r,'qualityWins50'), pick(r,'badLosses'),
      pick(r,'recTop25W'), pick(r,'recTop25L'), pick(r,'recTop50W'), pick(r,'recTop50L'),
      pick(r,'oneScoreW'), pick(r,'oneScoreL'),
    ].map(v=>{
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    });
    lines.push(vals.join(','));
  });
  return lines.join('\n');
}

// ---------- ranking & rendering ----------
let lastRankings = null;
let lastConferenceRows = null;

async function runRank(delta=false) {
  if (!yearRank) { alert('Year dropdown not found.'); return; }
  const yr = yearRank.value;
  const wk = weekRank?.value || '';
  const params = new URLSearchParams({ year: String(yr) });
  if (wk) params.set(delta? 'week' : 'throughWeek', String(wk));
  Object.entries(weights).forEach(([k,v])=> params.set(k, String(v)));

  const url = delta ? `/api/rank-delta?${params.toString()}` : `/api/rank-from-cache?${params.toString()}`;

  let r;
  try {
    const resp = await fetch(url);
    const text = await resp.text();
    try { r = JSON.parse(text); } catch { r = { error: `Non-JSON response (${resp.status}): ${text.slice(0,200)}` }; }
    if (!resp.ok) {
      throw new Error(r?.error || `HTTP ${resp.status}`);
    }
  } catch (e) {
    alert(`Rank failed: ${e?.message || e}`);
    return;
  }

  if (r.error) { alert(r.error); return; }

  const rows = r.rankings || r.rows || r.data || (Array.isArray(r)? r : []);
  const meta = r.meta || {};
  renderTable(rows, meta);
  lastRankings = { rankings: rows, meta, year: yr, throughWeek: wk };
}


function badges(used) {
  if (!dataBadges) return;
  const def = { advanced:'Advanced', ppa:'PPA', lines:'Lines', returning:'Returning', eloExt:'Ext Elo', srsExt:'Ext SRS' };
  dataBadges.innerHTML = '';
  Object.entries(def).forEach(([k,label])=>{
    const span = document.createElement('span');
    span.className = 'badge ' + (used && used[k] ? 'on':'off');
    span.textContent = label;
    dataBadges.appendChild(span);
  });
}

function renderTable(rows, meta) {
  rows = rows || [];
  if (rankTbody) rankTbody.innerHTML = '';
  badges(meta && meta.used);
  rows.forEach(r=>{
    const ex = r.extras || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.rank}</td>
      <td class="teamcell nowrap">${r.logo?`<img src="${r.logo}">`:''}${r.team}</td>
      <td class="nowrap">${confBadge(r.conference)}</td>
      <td class="right">${r.wins??0}</td>
      <td class="right">${r.losses??0}</td>
      <td class="right">${r.pointsFor??0}</td>
      <td class="right">${r.pointsAgainst??0}</td>
      <td class="right">${r.pointDiff??0}</td>
      <td class="right">${fmt(r.winPct,2)}</td>
      <td class="right">${fmt(r.avgMargin,1)}</td>
      <td class="right">${fmt(r.elo,0)}</td>
      <td class="right">${fmt(r.playQuality,2)}</td>
      <td class="right">${fmt(r.prior,2)}</td>
      <td class="right">${fmt(r.score,2)}</td>
      <td class="right">${r.deltaRank||''}</td>
      <td class="right">${fmt(r.deltaScore,2)}</td>
      <td class="right">${fmt(ex.ppa,2)}</td>
      <td class="right">${fmt(ex.market,2)}</td>
      <td class="right">${fmt(ex.returning,2)}</td>
      <td class="right">${fmt(r.sosAvgElo,0)}</td>
      <td class="right">${r.qualityWins25||0}</td>
      <td class="right">${r.qualityWins50||0}</td>
      <td class="right">${r.badLosses||0}</td>
      <td class="right">${(r.recTop25W||0)}-${(r.recTop25L||0)}</td>
      <td class="right">${(r.recTop50W||0)}-${(r.recTop50L||0)}</td>
      <td class="right">${(r.oneScoreW||0)}-${(r.oneScoreL||0)}</td>
    `;
    tr.addEventListener('click', ()=> openDrawer(r));
    rankTbody && rankTbody.appendChild(tr);
  });
  // populate compare selects
  if (compareA && compareB) {
    compareA.innerHTML = ''; compareB.innerHTML = '';
    rows.forEach(r=>{ compareA.append(new Option(r.team, r.team)); compareB.append(new Option(r.team, r.team)); });
  }
}

// ---------- conference rankings ----------
function buildConferenceRankings() {
  if (!lastRankings) { alert('Run team rankings first on the Rankings tab.'); return; }
  const rows = lastRankings.rankings || lastRankings || [];
  const topN = Number(confTopN?.value) || 6;

  const byConf = new Map();
  rows.forEach(t => {
    const c = t.conference || 'Independent';
    if (!byConf.has(c)) byConf.set(c, []);
    byConf.get(c).push(t);
  });

  const confRows = [];
  for (const [conf, teams] of byConf.entries()) {
    const scores = teams.map(t => Number(t.score)||0).sort((a,b)=>b-a);
    const elos   = teams.map(t => Number(t.elo)||0);
    const N = topN >= 900 ? scores.length : Math.min(scores.length, topN);
    const agg = mean(scores.slice(0, N));
    const med = median(scores);
    const avgElo = mean(elos);
    const top25 = teams.filter(t => Number(t.rank)<=25).length;
    const top50 = teams.filter(t => Number(t.rank)<=50).length;

    confRows.push({ conference: conf, teamsCount: teams.length, aggScore: agg, medianScore: med, avgElo, top25, top50 });
  }

  confRows.sort((a,b)=> b.aggScore - a.aggScore);
  lastConferenceRows = confRows;

  if (confTbody) {
    confTbody.innerHTML = '';
    confRows.forEach((r,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td class="nowrap">${confBadge(r.conference)}</td>
        <td class="right">${r.teamsCount}</td>
        <td class="right">${fmt(r.aggScore,2)}</td>
        <td class="right">${fmt(r.medianScore,2)}</td>
        <td class="right">${fmt(r.avgElo,0)}</td>
        <td class="right">${r.top25}</td>
        <td class="right">${r.top50}</td>
      `;
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => openConfDrawer(r.conference));
      confTbody.appendChild(tr);
    });
  }
}

function exportConferencePdf() {
  if (!lastConferenceRows || !lastConferenceRows.length) buildConferenceRankings();
  const rows = lastConferenceRows || [];
  if (!rows.length) { alert('No conference rankings to export.'); return; }

  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDFCtor) { alert('jsPDF not found on page.'); return; }
  const doc = new jsPDFCtor({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const yr = (lastRankings && lastRankings.year) || new Date().getFullYear();
  const wk = (lastRankings && lastRankings.throughWeek) || '';
  const topN = Number(confTopN?.value) || 6;
  const metricLabel = topN >= 900 ? 'Average of All Teams' : `Average of Top ${topN}`;
  const title = `Conference Rankings — ${yr}${wk ? ` (Through Week ${wk})` : ''}`;
  const sub = `${metricLabel} • Generated ${new Date().toLocaleString()}`;

  const columns = [
    { header: '#',        dataKey: 'rank' },
    { header: 'Conference', dataKey: 'conf' },
    { header: 'Teams',    dataKey: 'teams' },
    { header: 'Agg Score', dataKey: 'agg' },
    { header: 'Median',   dataKey: 'median' },
    { header: 'Avg Elo',  dataKey: 'elo' },
    { header: 'Top 25',   dataKey: 't25' },
    { header: 'Top 50',   dataKey: 't50' },
  ];

  const body = rows.map((r, i) => ({
    rank:   i + 1,
    conf:   r.conference,
    teams:  r.teamsCount,
    agg:    Number(r.aggScore).toFixed(2),
    median: Number(r.medianScore).toFixed(2),
    elo:    Math.round(Number(r.avgElo) || 0),
    t25:    r.top25,
    t50:    r.top50,
  }));

  if (doc.autoTable) {
    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(sub, 40, 58);
    doc.setTextColor(0);

    doc.autoTable({
      startY: 74,
      head: [columns.map(c => c.header)],
      body: body.map(row => columns.map(c => row[c.dataKey])),
      styles: { fontSize: 9, cellPadding: 5, valign: 'middle' },
      headStyles: { fillColor: [240, 244, 255], textColor: 20 },
      columnStyles: {
        0: { cellWidth: 28, halign: 'left'  },
        1: { cellWidth: 160, halign: 'left' },
        2: { cellWidth: 50, halign: 'right' },
        3: { cellWidth: 70, halign: 'right' },
        4: { cellWidth: 70, halign: 'right' },
        5: { cellWidth: 60, halign: 'right' },
        6: { cellWidth: 55, halign: 'right' },
        7: { cellWidth: 55, halign: 'right' },
      },
      margin: { left: 40, right: 40 },
      didDrawPage: (data) => {
        const page = doc.getNumberOfPages();
        doc.setFontSize(9);
        doc.setTextColor(130);
        doc.text(`Page ${page}`, data.settings.margin.left, doc.internal.pageSize.getHeight() - 20);
        doc.setTextColor(0);
      },
    });
  } else {
    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.text(sub, 40, 58);
    doc.setFontSize(10);

    let y = 86;
    const lineH = 16;
    doc.text('#  Conference                      Teams  Agg   Med   Elo  T25  T50', 40, y);
    y += 8; doc.line(40, y, 572, y); y += 14;

    body.forEach(row => {
      const line = `${String(row.rank).padEnd(3)} ${String(row.conf).padEnd(28).slice(0,28)}  ${String(row.teams).padStart(5)}  ${String(row.agg).padStart(5)}  ${String(row.median).padStart(5)}  ${String(row.elo).padStart(4)}  ${String(row.t25).padStart(3)}  ${String(row.t50).padStart(3)}`;
      doc.text(line, 40, y);
      y += lineH;
      if (y > 760) { doc.addPage(); y = 40; }
    });
  }

  const fn = `conference-rankings-${yr}${wk ? `-wk${wk}` : ''}.pdf`;
  doc.save(fn);
}

// ---------- drawers ----------
let _gamesCache = null;
async function getGamesForYear(year){
  if (_gamesCache && _gamesCache.year===year) return _gamesCache.data;
  const r = await fetch(`/api/cache-data?year=${year}&kind=games`).then(r=>r.json()).catch(()=>[]);
  _gamesCache = {year, data: Array.isArray(r)? r : (r.data||[]) };
  return _gamesCache.data;
}

async function fillRecentGames(team, year, throughWeek){
  const games = await getGamesForYear(year);
  const upto = games.filter(g=> (throughWeek? (g.week||0) <= Number(throughWeek) : true));
  const any = upto.filter(g=> g.homeTeam===team || g.awayTeam===team).sort((a,b)=> (b.week||0)-(a.week||0)).slice(0,5);
  if (!recentGamesBox) return;
  recentGamesBox.innerHTML = any.map(g=>{
    const isHome = g.homeTeam===team, opp = isHome? g.awayTeam : g.homeTeam;
    const us = isHome? g.homePoints : g.awayPoints;
    const them = isHome? g.awayPoints : g.homePoints;
    const wl = (us!=null && them!=null) ? (us>them?'W':(us<them?'L':'T')) : '?';
    const loc = isHome? 'vs' : 'at';
    return `<tr><td>${g.week}</td><td>${opp}</td><td>${loc}</td><td class="right">${us!=null?us:'-'}:${them!=null?them:'-' } (${wl})</td></tr>`;
  }).join('');
}

function openDrawer(r) {
  if (!drawer || !overlay) return;
  if (drawerTitle)    drawerTitle.textContent = r.team;
  if (drawerSubtitle) drawerSubtitle.textContent = `Rank ${r.rank}, Conf ${r.conference||''}`;
  if (stackBar) stackBar.innerHTML='';
  const segs = [
    ['elo','Elo',r.contr?.elo],
    ['play','Play',r.contr?.play],
    ['prior','Prior',r.contr?.prior],
    ['ppa','PPA',r.contr?.ppa],
    ['market','Market',r.contr?.market],
    ['returning','Returning',r.contr?.returning],
    ['ext','Ext',r.contr?.ext],
    ['mov','MOV', r.contr?.mov],
    ['off','Off', r.contr?.off],
    ['def','Def', r.contr?.def],
    ['sos','SoS',r.contr?.sos],
  ].filter(x => x && x[2] != null);
  const tot = segs.reduce((a,b)=>a+Math.abs(b[2]||0),0)||1;
  if (stackBar) {
    segs.forEach(([cls,_label,val])=>{
      const div = document.createElement('div');
      div.className = 'seg '+cls;
      div.style.width = `${(Math.abs(val)/tot*100).toFixed(1)}%`;
      stackBar.appendChild(div);
    });
  }
  if (stackLegend) stackLegend.textContent = segs.map(([_,label,val])=>`${label}:${fmt(val,2)}`).join(' • ');
  if (zScoresBox)  zScoresBox.textContent = Object.entries(r.z||{}).map(([k,v])=>`${k}:${fmt(v,2)}`).join(' | ');
  if (resumeBox)   resumeBox.textContent = `QW25:${r.qualityWins25||0} QW50:${r.qualityWins50||0} BadL:${r.badLosses||0} One-score:${(r.oneScoreW||0)}-${(r.oneScoreL||0)}`;

  fillRecentGames(r.team, (lastRankings&&lastRankings.year)||new Date().getFullYear(), (lastRankings&&lastRankings.throughWeek)||'');
  overlay.classList.add('show'); drawer.classList.add('open');
}

function openConfDrawer(confName) {
  if (!lastRankings || !confDrawer || !confTeamsTbody || !overlay) return;
  const rows = lastRankings.rankings || lastRankings || [];
  const teams = rows
    .filter(t => (t.conference || 'Independent') === confName)
    .sort((a,b) => (a.rank||9999) - (b.rank||9999));

  if (confDrawerTitle)    confDrawerTitle.textContent = confName;
  if (confDrawerSubtitle) confDrawerSubtitle.innerHTML = `${teams.length} teams • ${confBadge(confName)}`;

  confTeamsTbody.innerHTML = teams.map(t => `
      <tr>
        <td>${t.rank ?? '—'}</td>
        <td class="teamcell nowrap">${t.logo?`<img src="${t.logo}">`:''}${t.team}</td>
        <td class="right">${t.wins ?? 0}</td>
        <td class="right">${t.losses ?? 0}</td>
        <td class="right">${fmt(t.score,2)}</td>
        <td class="right">${fmt(t.elo,0)}</td>
        <td class="right">${fmt(t.playQuality,2)}</td>
        <td class="right">${fmt(t.prior,2)}</td>
      </tr>
    `).join('');

  overlay.classList.add('show');
  confDrawer.classList.add('open');
}

// ---------- compare ----------
let radarChart = null;
onId('compareBtn', 'click', () => doCompare());

async function doCompare() {
  if (!lastRankings) { alert('Run a ranking first (Step 2) to load teams.'); return; }
  const rows = lastRankings.rankings || lastRankings;
  const a = rows.find(x => x.team === compareA?.value);
  const b = rows.find(x => x.team === compareB?.value);
  if (!a || !b) { alert('Select two valid teams.'); return; }
  const thA = $('thTeamA');
  const thB = $('thTeamB');
  if (thA) thA.textContent = a.team;
  if (thB) thB.textContent = b.team;

  const labels = ['Elo','Play','Prior','PPA','Market','Returning','SoS'];
  const da = [a.z?.elo,a.z?.play,a.z?.prior,a.z?.ppa,a.z?.market,a.z?.returning,a.z?.sos];
  const db = [b.z?.elo,b.z?.play,b.z?.prior,b.z?.ppa,b.z?.market,b.z?.returning,b.z?.sos];
  const canvas = $('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (radarChart) radarChart.destroy();
  if (typeof Chart === 'undefined') { alert('Chart library failed to load.'); return; }
  radarChart = new Chart(ctx, {
    type:'radar',
    data:{ labels, datasets:[
      { label:a.team, data:da, fill:true, backgroundColor:'rgba(100,181,246,0.3)', borderColor:'#64b5f6' },
      { label:b.team, data:db, fill:true, backgroundColor:'rgba(255,138,128,0.3)', borderColor:'#ff8a80' }
    ]},
    options:{ scales:{ r:{ min:-2, max:2 } } }
  });

  const year = (lastRankings && lastRankings.year) || new Date().getFullYear();
  const throughWeek = (lastRankings && lastRankings.throughWeek) || '';
  const games = await getGamesForYear(year);
  const upto = games.filter(g => (throughWeek ? (g.week || 0) <= Number(throughWeek) : true));

  const h2hGames = upto.filter(g =>
    (g.homeTeam === a.team && g.awayTeam === b.team) ||
    (g.homeTeam === b.team && g.awayTeam === a.team)
  ).sort((x,y)=> (x.week||0) - (y.week||0));

  const formatScore = (g) => {
    const home = `${g.homeTeam} ${g.homePoints ?? '-'}`;
    const away = `${g.awayTeam} ${g.awayPoints ?? '-'}`;
    return `${home} — ${away}`;
  };

  if (h2h) {
    h2h.innerHTML = h2hGames.map(g => {
      const date = g.startDate || g.start || `W${g.week||''}`;
      const res = formatScore(g);
      return `<tr><td>${date}</td><td class="right">${res}</td></tr>`;
    }).join('') || `<tr><td colspan="2">No head-to-head games found.</td></tr>`;
  }

  const oppsA = new Map();
  const oppsB = new Map();
  upto.forEach(g => {
    if (g.homeTeam === a.team || g.awayTeam === a.team) {
      const opp = g.homeTeam === a.team ? g.awayTeam : g.homeTeam;
      const us = g.homeTeam === a.team ? g.homePoints : g.awayPoints;
      const them = g.homeTeam === a.team ? g.awayPoints : g.homePoints;
      oppsA.set(opp, { us, them });
    }
    if (g.homeTeam === b.team || g.awayTeam === b.team) {
      const opp = g.homeTeam === b.team ? g.awayTeam : g.homeTeam;
      const us = g.homeTeam === b.team ? g.homePoints : g.awayPoints;
      const them = g.homeTeam === b.team ? g.awayPoints : g.homePoints;
      oppsB.set(opp, { us, them });
    }
  });

  const commons = [...oppsA.keys()].filter(k => oppsB.has(k)).sort();
  const fmtCell = (r) => {
    if (!r || r.us == null || r.them == null) return '—';
    const wl = r.us > r.them ? 'W' : (r.us < r.them ? 'L' : 'T');
    return `${r.us}:${r.them} (${wl})`;
  };

  if (commonOpp) {
    commonOpp.innerHTML = commons.map(opp => {
      const ra = oppsA.get(opp);
      const rb = oppsB.get(opp);
      return `<tr>
        <td>Common</td>
        <td>${opp}</td>
        <td class="right">${fmtCell(ra)}</td>
        <td class="right">${fmtCell(rb)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="4">No common opponents found.</td></tr>`;
  }
}

// ---------- cache info ----------
async function loadCacheInfo() {
  const yr = (yearIngest && yearIngest.value) || new Date().getFullYear();
  const r = await fetch(`/api/cache-info?year=${yr}`).then(r=>r.json()).catch(()=>({}));
  if (cacheFiles) {
    cacheFiles.innerHTML = '';
    (r.files||[]).forEach(f=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${f.name}</td><td class="right">${(f.bytes/1024).toFixed(1)} KB</td><td class="right">${new Date(f.mtime).toLocaleString()}</td>`;
      cacheFiles.appendChild(tr);
    });
  }
  if (refreshCache && clearYear && clearAll) {
    if ((r.files||[]).length) { refreshCache.style.display=clearYear.style.display=clearAll.style.display='inline-block'; }
    else { refreshCache.style.display=clearYear.style.display=clearAll.style.display='none'; }
  }
  await populateWeeksForYear(yr);
}

// ---------- init ----------
(async function init(){
  await populateYears();
  const yi = yearIngest?.value || String(new Date().getFullYear());
  await populateWeeksForYear(yi);
  await loadCacheInfo();
})();
