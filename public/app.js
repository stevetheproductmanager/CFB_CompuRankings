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

// NEW: drawer nav controls
const drawerFirst = $('drawerFirst');
const drawerPrev  = $('drawerPrev');
const drawerNext  = $('drawerNext');
const drawerLast  = $('drawerLast');
let drawerIndex = -1;

// Click-away to close (closes either drawer if open)
if (overlay) overlay.addEventListener('click', () => {
  if (drawer)     drawer.classList.remove('open');
  if (confDrawer) confDrawer.classList.remove('open');
  overlay.classList.remove('show');
});


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

// ---------- robust helpers for games + names ----------
function firstDefined(...vals) { for (const v of vals) if (v !== undefined && v !== null) return v; }
function canonName(s) { return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, ''); }

function gWeek(g)     { return Number(firstDefined(g.week, g.week_number, g.weekNumber, g.w, 0)); }
function gHomeTeam(g) { return String(firstDefined(g.homeTeam, g.home_team, g.home, g.teamHome, g.home_name, g?.teams?.home) || ''); }
function gAwayTeam(g) { return String(firstDefined(g.awayTeam, g.away_team, g.away, g.teamAway, g.away_name, g?.teams?.away) || ''); }
function gHomePts(g)  { return firstDefined(g.homePoints, g.home_points, g.homeScore, g.pointsHome, g.home_points_total); }
function gAwayPts(g)  { return firstDefined(g.awayPoints, g.away_points, g.awayScore, g.pointsAway, g.away_points_total); }

const __gamesCache = new Map();
/** Try several likely endpoints; cache first success. */
async function getGamesForYear(year) {
  if (__gamesCache.has(year)) return __gamesCache.get(year);

  const qs = y => `year=${encodeURIComponent(String(y))}`;
  const candidates = [
    `/api/team-games?all=1&${qs(year)}`,
    `/api/games-from-cache?${qs(year)}`,
    `/api/games?${qs(year)}`
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (Array.isArray(data) && data.length) {
        __gamesCache.set(year, data);
        return data;
      }
      // some APIs return {games:[...]}
      if (data && Array.isArray(data.games)) {
        __gamesCache.set(year, data.games);
        return data.games;
      }
    } catch (_) { /* keep trying */ }
  }

  // graceful fallback
  __gamesCache.set(year, []);
  return [];
}

const toggleBtn = document.getElementById('toggleControls');
const controlsPanel = document.getElementById('controlsPanel');

if (toggleBtn && controlsPanel) {
  toggleBtn.addEventListener('click', () => {
    const isOpen = controlsPanel.classList.contains('open');
    if (isOpen) {
      controlsPanel.classList.remove('open');
      controlsPanel.classList.add('closed');
      toggleBtn.textContent = 'Show Controls ▼';
    } else {
      controlsPanel.classList.remove('closed');
      controlsPanel.classList.add('open');
      toggleBtn.textContent = 'Hide Controls ▲';
    }
  });
}



// ---------- utils ----------
function fmt(n, d = 2) { return n == null ? '—' : Number(n).toFixed(d); }
function confBadge(conf) { const c = conf || ''; const bg = CONF_COLORS[c] || 'var(--chip)'; return `<span class="conf" style="background:${bg};color:#fff;padding:2px 8px;border-radius:999px">${c}</span>`; }
function showConfirm(msg, cb) { const confirmText = $('confirmText'); const confirmDlg = $('confirmDlg'); if (!confirmDlg || !confirmText) return cb && cb(); confirmText.textContent = msg; confirmDlg.showModal(); const onOk = () => { cb && cb(); confirmDlg.close(); cleanup(); }; const onCancel = () => { confirmDlg.close(); cleanup(); }; const cleanup = () => { $('confirmOk')?.removeEventListener('click', onOk); $('confirmCancel')?.removeEventListener('click', onCancel); }; onId('confirmOk', 'click', onOk); onId('confirmCancel', 'click', onCancel); }

// --- robust field access helpers for cached games ---
function firstDefined(...vals) { for (const v of vals) if (v !== undefined && v !== null) return v; return undefined; }
function canonName(s) { return String(s || '').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,''); }

function gWeek(g) { return Number(firstDefined(g.week, g.week_number, g.weekNumber, g.w, 0)); }
function gHomeTeam(g) { return String(firstDefined(g.homeTeam, g.home_team, g.home, g.teamHome, g.home_name, g?.teams?.home) || ''); }
function gAwayTeam(g) { return String(firstDefined(g.awayTeam, g.away_team, g.away, g.teamAway, g.away_name, g?.teams?.away) || ''); }
function gHomePts(g) { return firstDefined(g.homePoints, g.home_points, g.homeScore, g.pointsHome, g.home_points_total); }
function gAwayPts(g) { return firstDefined(g.awayPoints, g.away_points, g.awayScore, g.pointsAway, g.away_points_total); }

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

function findTeamRowByName(name) {
  const list = (lastRankings && (lastRankings.rankings || lastRankings)) || [];
  return list.find(r => r.team === name) || null;
}

function perGame(val, games) {
  if (val == null || !Number.isFinite(val)) return null;
  const g = Math.max(1, Number(games || 0));
  return val / g;
}

// Return CSS classes for A and B cells. lowerBetter flips the comparison.
function cellClasses(va, vb, lowerBetter = false, epsilon = 1e-9) {
  const a = Number(va), b = Number(vb);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return ['', ''];
  const betterA = lowerBetter ? (a < b - epsilon) : (a > b + epsilon);
  const betterB = lowerBetter ? (b < a - epsilon) : (b > a + epsilon);
  if (betterA && !betterB) return ['twin', 'tloss'];
  if (betterB && !betterA) return ['tloss', 'twin'];
  return ['', '']; // tie
}

// Build simple “Key Edges” chips from array of [label, va(num), vb(num), lowerBetter?]
function renderKeyEdges(edgeInputs, teamAName, teamBName) {
  const box = document.getElementById('compareEdges');
  if (!box) return;

  const rows = edgeInputs
    .map(([label, va, vb, lowerBetter]) => {
      const a = Number(va), b = Number(vb);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      // positive diff => A leads; if lowerBetter, flip sense
      const diff = lowerBetter ? (b - a) : (a - b);
      return { label, diff, va: a, vb: b };
    })
    .filter(Boolean);

  if (!rows.length) { box.innerHTML = '<span class="tiny">No numeric edges available.</span>'; return; }

  rows.sort((x,y) => Math.abs(y.diff) - Math.abs(x.diff));
  const top = rows.slice(0, 5);

  box.innerHTML = top.map(e => {
    const aheadA = e.diff > 0;
    const who = aheadA ? teamAName : teamBName;
    return `
      <span class="edge-badge ${aheadA? 'aheadA':'aheadB'}">
        <span class="tag">${e.label}</span>
        <span>${who}</span>
        <span class="delta">+${fmt(Math.abs(e.diff), 2)}</span>
      </span>
    `;
  }).join('');
}


function renderStatComparison(a, b, perGameMode = false) {
  const body = document.getElementById('statCompareBody');
  const aHdr = document.getElementById('statTeamA');
  const bHdr = document.getElementById('statTeamB');
  if (!body || !a || !b) return;

  if (aHdr) aHdr.textContent = a.team;
  if (bHdr) bHdr.textContent = b.team;

  const gamesA = (a.wins||0) + (a.losses||0);
  const gamesB = (b.wins||0) + (b.losses||0);

  // Per-game toggles (use raw numbers for compare; format later)
  const PF_a = perGameMode ? perGame(a.pointsFor, gamesA) : a.pointsFor;
  const PF_b = perGameMode ? perGame(b.pointsFor, gamesB) : b.pointsFor;

  // ✅ fix: use each team's own pointsAgainst
  const PA_a = perGameMode ? perGame(a.pointsAgainst, gamesA) : a.pointsAgainst;
  const PA_b = perGameMode ? perGame(b.pointsAgainst, gamesB) : b.pointsAgainst;

  const AM_a = perGameMode ? perGame(a.pointDiff, gamesA) : a.avgMargin;
  const AM_b = perGameMode ? perGame(b.pointDiff, gamesB) : b.avgMargin;

  const rows = [
    ['Record', `${a.wins}-${a.losses}`, `${b.wins}-${b.losses}`, false, 'string'],
    ['Win %', a.winPct, b.winPct, false, 'pct'],
    ['Points For' + (perGameMode? ' (pg)':''), PF_a, PF_b, false, 'num'],
    ['Points Against' + (perGameMode? ' (pg)':''), PA_a, PA_b, true, 'num'], // lower is better
    ['Avg Margin' + (perGameMode? ' (pg)':''), AM_a, AM_b, false, 'num'],
    ['Elo', a.elo, b.elo, false, 'num0'],
    ['Play Quality', a.playQuality, b.playQuality, false, 'num2'],
    ['Prior', a.prior, b.prior, false, 'num2'],
    ['Score', a.score, b.score, false, 'num2'],
    ['MOV (Dom)', a.extras?.mov, b.extras?.mov, false, 'num2'],
    ['Off Dominance', a.extras?.offDom, b.extras?.offDom, false, 'num2'],
    ['Def Dominance', a.extras?.defDom, b.extras?.defDom, false, 'num2'],
    ['Top-25 Wins', a.qualityWins25 || 0, b.qualityWins25 || 0, false, 'int'],
    ['Top-50 Wins', a.qualityWins50 || 0, b.qualityWins50 || 0, false, 'int'],
    ['Bad Losses', a.badLosses || 0, b.badLosses || 0, true, 'int'], // lower better
    ['One-score +/-', (a.oneScoreWins||0)-(a.oneScoreLosses||0), (b.oneScoreWins||0)-(b.oneScoreLosses||0), false, 'int'],
  ];

  body.innerHTML = rows.map(([label, va, vb, lowerBetter, kind]) => {
    const [clsA, clsB] = cellClasses(va, vb, lowerBetter);
    const outA = (va == null || Number.isNaN(va)) ? '-' :
      (kind==='string' ? String(va) :
       kind==='pct' ? fmt(va,3) :
       kind==='num0' ? fmt(va,0) :
       kind==='int' ? fmt(va,0) :
       fmt(va,2));
    const outB = (vb == null || Number.isNaN(vb)) ? '-' :
      (kind==='string' ? String(vb) :
       kind==='pct' ? fmt(vb,3) :
       kind==='num0' ? fmt(vb,0) :
       kind==='int' ? fmt(vb,0) :
       fmt(vb,2));
    return `
      <tr>
        <td>${label}</td>
        <td class="right ${clsA}">${outA}</td>
        <td class="right ${clsB}">${outB}</td>
      </tr>
    `;
  }).join('');

  // Feed Key Edges a curated numeric set
  const edgeInputs = [
    ['Elo', a.elo, b.elo, false],
    ['Play', a.playQuality, b.playQuality, false],
    ['Prior', a.prior, b.prior, false],
    ['Score', a.score, b.score, false],
    ['Avg Margin' + (perGameMode? ' (pg)':''), AM_a, AM_b, false],
    ['Off Dom', a.extras?.offDom, b.extras?.offDom, false],
    ['Def Dom', a.extras?.defDom, b.extras?.defDom, false],
    ['Top-25 Wins', a.qualityWins25||0, b.qualityWins25||0, false],
    ['Top-50 Wins', a.qualityWins50||0, b.qualityWins50||0, false],
    ['Bad Losses', a.badLosses||0, b.badLosses||0, true], // lower better
  ];
  renderKeyEdges(edgeInputs, a.team, b.team);
}

async function renderH2HAndCommon(a, b) {
  const boxH2H = document.getElementById('compareH2H');
  const boxCommon = document.getElementById('compareCommon');
  if (!boxH2H || !boxCommon || !a || !b) return;

  // clear placeholder
  boxH2H.textContent = '';
  boxCommon.textContent = '';

  const year = (lastRankings && lastRankings.year) || new Date().getFullYear();
  const throughWeek = (lastRankings && lastRankings.throughWeek) || null;

  const games = await getGamesForYear(year);
  const upto = games.filter(g => (throughWeek ? (g.week||0) <= Number(throughWeek) : true));

  const isH2H = (g) =>
    (g.homeTeam === a.team && g.awayTeam === b.team) ||
    (g.homeTeam === b.team && g.awayTeam === a.team);

  const h2h = upto.filter(isH2H).sort((x,y) => (x.week||0) - (y.week||0));

  // ---- Head-to-Head
  if (h2h.length === 0) {
    boxH2H.innerHTML = '<div class="tiny" style="opacity:.8">No head-to-head games in range.</div>';
  } else {
    boxH2H.innerHTML = `
      <table class="compact" style="width:100%">
        <thead><tr><th>Week</th><th>Matchup</th><th class="right">Score</th><th class="right">Result</th></tr></thead>
        <tbody>
          ${h2h.map(g => {
            const home = g.homeTeam, away = g.awayTeam;
            const hp = g.homePoints, ap = g.awayPoints;
            const loc = g.neutralSite ? 'N' : 'H/A';
            const winner = hp>ap ? home : (ap>hp ? away : null);
            const resA = winner ? (winner===a.team ? 'A W' : (winner===b.team ? 'A L' : 'T')) : 'T';
            return `<tr>
              <td>${g.week ?? '—'}</td>
              <td>${away} @ ${home} ${g.neutralSite? '(N)' : ''}</td>
              <td class="right">${hp ?? '-'} : ${ap ?? '-'}</td>
              <td class="right">${resA}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // ---- Common Opponents
  const oppsA = new Map(); // opp -> [{us, them, week, home}]
  const oppsB = new Map();

  upto.forEach(g => {
    if (g.homeTeam === a.team) {
      const opp = g.awayTeam;
      const us = g.homePoints, them = g.awayPoints;
      (oppsA.get(opp) || oppsA.set(opp, [])).push({ us, them, week: g.week, home: true });
    } else if (g.awayTeam === a.team) {
      const opp = g.homeTeam;
      const us = g.awayPoints, them = g.homePoints;
      (oppsA.get(opp) || oppsA.set(opp, [])).push({ us, them, week: g.week, home: false });
    }
    if (g.homeTeam === b.team) {
      const opp = g.awayTeam;
      const us = g.homePoints, them = g.awayPoints;
      (oppsB.get(opp) || oppsB.set(opp, [])).push({ us, them, week: g.week, home: true });
    } else if (g.awayTeam === b.team) {
      const opp = g.homeTeam;
      const us = g.awayPoints, them = g.homePoints;
      (oppsB.get(opp) || oppsB.set(opp, [])).push({ us, them, week: g.week, home: false });
    }
  });

  const commons = [...oppsA.keys()].filter(k => oppsB.has(k)).sort((x,y)=>x.localeCompare(y));

  if (!commons.length) {
    boxCommon.innerHTML = '<div class="tiny" style="opacity:.8">No common opponents in range.</div>';
    return;
  }

  // summarize first matchup vs each common opp (keeps UI tight)
  const rows = commons.map(opp => {
    const a1 = oppsA.get(opp)[0];
    const b1 = oppsB.get(opp)[0];
    const aWin = (a1.us != null && a1.them != null) ? (a1.us > a1.them) : null;
    const bWin = (b1.us != null && b1.them != null) ? (b1.us > b1.them) : null;
    const aCls = aWin==null ? '' : (aWin ? 'twin' : 'tloss');
    const bCls = bWin==null ? '' : (bWin ? 'twin' : 'tloss');
    return `
      <tr>
        <td>${opp}</td>
        <td class="right ${aCls}">${a1.us ?? '-'} : ${a1.them ?? '-'} ${a1.home ? '(H)' : '(A)'}</td>
        <td class="right ${bCls}">${b1.us ?? '-'} : ${b1.them ?? '-'} ${b1.home ? '(H)' : '(A)'}</td>
      </tr>
    `;
  }).join('');

  boxCommon.innerHTML = `
    <table class="compact" style="width:100%">
      <thead><tr><th>Opponent</th><th class="right">${a.team}</th><th class="right">${b.team}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}



function drawMiniRadar(canvas, a, b) {
  if (!canvas || !a || !b) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  // Factors (7): pull z-scores for comparability
  const keys = ['elo','play','prior','ppa','market','returning','sos'];
  const labels = ['Elo','Play','Prior','PPA','Mkt','Ret','SoS'];
  const az = a.z || {}, bz = b.z || {};

  // clamp to [-2.5, 2.5] and normalize to [0,1]
  const clamp = (x) => Math.max(-2.5, Math.min(2.5, Number.isFinite(x)? x : 0));
  const norm = (x) => (clamp(x) + 2.5) / 5; // -2.5..+2.5 -> 0..1

  const aVals = keys.map(k => norm(az[k]));
  const bVals = keys.map(k => norm(bz[k]));

  const cx = W/2, cy = H/2, rMax = Math.min(W, H)*0.42;

  // grid + axes
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,.15)';
  ctx.lineWidth = 1;
  for (let ring=1; ring<=4; ring++) {
    const rr = (rMax*ring)/4;
    ctx.beginPath();
    for (let i=0;i<keys.length;i++) {
      const ang = (Math.PI*2*i/keys.length) - Math.PI/2;
      const x = cx + rr*Math.cos(ang), y = cy + rr*Math.sin(ang);
      (i===0)? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
  }
  // radial lines + labels
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  for (let i=0;i<keys.length;i++) {
    const ang = (Math.PI*2*i/keys.length) - Math.PI/2;
    const x = cx + rMax*Math.cos(ang), y = cy + rMax*Math.sin(ang);
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.stroke();
    const lx = cx + (rMax+10)*Math.cos(ang), ly = cy + (rMax+10)*Math.sin(ang);
    ctx.textAlign = Math.cos(ang) > 0.2 ? 'left' : (Math.cos(ang) < -0.2 ? 'right' : 'center');
    ctx.textBaseline = Math.sin(ang) > 0.2 ? 'top' : (Math.sin(ang) < -0.2 ? 'bottom' : 'middle');
    ctx.fillText(labels[i], lx, ly);
  }
  ctx.restore();

  // polygon helper
  function drawPoly(vals, stroke, fill) {
    ctx.beginPath();
    vals.forEach((v,i) => {
      const ang = (Math.PI*2*i/vals.length) - Math.PI/2;
      const rr = rMax * v;
      const x = cx + rr*Math.cos(ang), y = cy + rr*Math.sin(ang);
      (i===0)? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.closePath();
    ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = fill; ctx.fill();
  }

  // A = blue-ish, B = orange-ish (semi-transparent)
  drawPoly(aVals, 'rgba(30, 100, 200, 0.9)', 'rgba(30, 100, 200, 0.18)');
  drawPoly(bVals, 'rgba(230, 120, 20, 0.9)', 'rgba(230, 120, 20, 0.18)');
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
  runRank();
  alert(`Loaded preset "${name}".`);
});

function initPresetDropdown(selectEl = document.getElementById('presetSelect')) {
  if (!selectEl) return;
  const presets = getPresets();
  const names = Object.keys(presets).sort((a,b)=> a.localeCompare(b));
  if (!names.length) {
    selectEl.innerHTML = `<option value="" disabled selected>(no presets)</option>`;
    selectEl.disabled = true;
    return;
  }
  selectEl.disabled = false;
  selectEl.innerHTML = names.map(n => `<option value="${encodeURIComponent(n)}">${n}</option>`).join('');
}

function getSelectedPresetName() {
  const sel = document.getElementById('presetSelect');
  if (!sel || sel.disabled || !sel.value) return null;
  return decodeURIComponent(sel.value);
}


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
  runRank();
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
      <td class="right score-cell" data-score="${fmt(r.score,2)}">${fmt(r.score,2)}</td>
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

    tr.addEventListener('click', (e) => {
      const cell = e.target.closest('td');
      if (cell && cell.classList.contains('score-cell')) {
        const val = cell.dataset.score || cell.textContent.trim();
        navigator.clipboard.writeText(val).then(() => {
          cell.classList.add('copied');
          setTimeout(() => cell.classList.remove('copied'), 500);
        });
        e.stopPropagation(); // don’t open drawer
        return;
      }
      openDrawer(r);
    });

    rankTbody && rankTbody.appendChild(tr);
  });

  // populate compare selects
{
  const names = rows.map(r => r.team);
  setTeamLists(names);
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
// ---------- drawers ----------
let _gamesCache = new Map(); // key: year -> array of games

// Field helpers (robust to API/case/shape differences)
function _firstDefined(...vals) { for (const v of vals) if (v !== undefined && v !== null) return v; }
function _canonName(s) { return String(s || '').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,''); }

function gWeek(g)     { return Number(_firstDefined(g.week, g.week_number, g.weekNumber, g.w, 0)); }
function gHomeTeam(g) { return String(_firstDefined(g.homeTeam, g.home_team, g.home, g.teamHome, g.home_name, g?.teams?.home) || ''); }
function gAwayTeam(g) { return String(_firstDefined(g.awayTeam, g.away_team, g.away, g.teamAway, g.away_name, g?.teams?.away) || ''); }
function gHomePts(g)  { return _firstDefined(g.homePoints, g.home_points, g.homeScore, g.pointsHome, g.home_points_total); }
function gAwayPts(g)  { return _firstDefined(g.awayPoints, g.away_points, g.awayScore, g.pointsAway, g.away_points_total); }

/**
 * Try several endpoints and response shapes, cache the first success per year.
 * Update the `candidates` array if your backend uses a different path.
 */
async function getGamesForYear(year) {
  if (_gamesCache.has(year)) return _gamesCache.get(year);

  const qs = `year=${encodeURIComponent(String(year))}`;

  // Ordered by likelihood; add/remove to match your server.
  const candidates = [
    `/api/games-from-cache?${qs}`,
    `/api/team-games?all=1&${qs}`,
    `/api/games?${qs}`,
    // your previous (404) endpoint kept last, in case you add it later:
    `/api/cache-data?${qs}&kind=games`,
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) { console.debug('[getGamesForYear] skip', url, resp.status); continue; }
      let data = await resp.json();

      // normalize common shapes
      if (Array.isArray(data)) {
        _gamesCache.set(year, data);
        return data;
      }
      if (data && Array.isArray(data.games)) {
        _gamesCache.set(year, data.games);
        return data.games;
      }
      if (data && Array.isArray(data.data)) {
        _gamesCache.set(year, data.data);
        return data.data;
      }
      console.debug('[getGamesForYear] unrecognized JSON shape from', url, data);
    } catch (e) {
      console.debug('[getGamesForYear] fetch failed', url, e?.message || e);
    }
  }

  console.warn('[getGamesForYear] no game endpoint responded; returning []');
  _gamesCache.set(year, []);
  return [];
}

async function fillRecentGames(team, year, throughWeek) {
  const recentTbody = document.getElementById('recentGames');
  if (!recentTbody) return;

  const games = await getGamesForYear(year);
  const tw = throughWeek ? Number(throughWeek) : undefined;
  const teamKey = _canonName(team);
  
  const rankByTeam = new Map(
    ((lastRankings && lastRankings.rankings) || []).map(row => [row.team, row.rank])
  );

  const rows = games
    .filter(g => (tw ? gWeek(g) <= tw : true))
    .filter(g => {
      const h = _canonName(gHomeTeam(g));
      const a = _canonName(gAwayTeam(g));
      return h === teamKey || a === teamKey;
    })
    .sort((a, b) => gWeek(b) - gWeek(a))
    .slice(0, 5);

  if (!rows.length) {
    recentTbody.innerHTML = `<tr><td colspan="4" class="tiny">No games found for this team in the selected range.</td></tr>`;
    return;
  }

  recentTbody.innerHTML = rows.map(g => {
    const h = gHomeTeam(g);
    const a = gAwayTeam(g);
    const isHome = _canonName(h) === teamKey;

    const us   = isHome ? gHomePts(g) : gAwayPts(g);
    const them = isHome ? gAwayPts(g) : gHomePts(g);
    const wl   = (us != null && them != null) ? (us > them ? 'W' : (us < them ? 'L' : 'T')) : '';
    const loc  = isHome ? 'vs' : 'at';
    const opp  = isHome ? a : h;
    
    const oppRank = rankByTeam.get(opp);
    const oppHtml = oppRank ? `${opp} <span class="tiny">(${oppRank})</span>` : opp;

    return `<tr>
      <td>${g.week ?? '—'}</td>
      <td>${oppHtml}</td>
      <td>${loc}</td>
      <td class="right">${us != null ? us : '-'}:${them != null ? them : '-'} (${wl})</td>
    </tr>`;
  }).join('');
}

function getRankingList() {
  // Returns the array of current ranking rows in-order
  return (lastRankings && (lastRankings.rankings || lastRankings)) || [];
}

function updateDrawerNavButtons(total) {
  const invalid = !(Number.isInteger(drawerIndex) && drawerIndex >= 0 && total > 0);
  [drawerFirst, drawerPrev, drawerNext, drawerLast].forEach(btn => { if (btn) btn.disabled = invalid; });
  if (invalid) return;
  if (drawerFirst) drawerFirst.disabled = drawerIndex <= 0;
  if (drawerPrev)  drawerPrev.disabled  = drawerIndex <= 0;
  if (drawerNext)  drawerNext.disabled  = drawerIndex >= total - 1;
  if (drawerLast)  drawerLast.disabled  = drawerIndex >= total - 1;
}

function openByOffset(offset) {
  const list = getRankingList();
  if (!list.length || drawerIndex < 0) return;
  const next = Math.max(0, Math.min(list.length - 1, drawerIndex + offset));
  if (next === drawerIndex) return;
  openDrawer(list[next]); // re-renders drawer for new team
}



function renderResumeStats(r) {
  const box = document.getElementById('resumeBox'); // existing container
  if (!box) return;

  const qw25 = r.qualityWins25 ?? r.qw25 ?? 0;
  const qw50 = r.qualityWins50 ?? r.qw50 ?? 0;
  const badL = r.badLosses ?? r.bad ?? 0;
  const osW  = r.oneScoreW ?? r.oneScoreWins ?? 0;
  const osL  = r.oneScoreL ?? r.oneScoreLosses ?? 0;

  box.innerHTML = `
    <div class="resume-chips">
      <span class="badge">Top-25 wins: ${qw25}</span>
      <span class="badge">Top-50 wins: ${qw50}</span>
      <span class="badge">Bad losses: ${badL}</span>
      <span class="badge">One-score: ${osW}-${osL}</span>
    </div>
  `;
}



function renderZScores(z) {
  if (!zScoresBox) return;
  const labels = { elo:'Elo', play:'Play', prior:'Prior', ppa:'PPA', market:'Market', returning:'Returning',
                   mov:'MOV', off:'Off', def:'Def', sos:'SoS' };
  const entries = Object.entries(z || {})
    .filter(([,v]) => v != null)
    .sort((a,b) => Math.abs(b[1]) - Math.abs(a[1])); // biggest first

  if (!entries.length) { zScoresBox.innerHTML = '<span class="tiny">—</span>'; return; }

  zScoresBox.innerHTML = entries.map(([k, v]) => {
    const sign = v >= 0 ? '+' : '';
    const bg = v >= 0 ? 'rgba(16,133,72,.18)' : 'rgba(200,32,44,.18)';
    const bd = v >= 0 ? '#2e7d32' : '#c62828';
    return `<span class="badge" style="background:${bg}; border-color:${bd}">
      ${labels[k] || k}: ${sign}${fmt(v,2)}
    </span>`;
  }).join(' ');
}

function renderContribStack(contr) {
  if (!stackBar) return;
  // normalize + sort by magnitude for visual clarity
  const segs = [
    ['elo','Elo', contr?.elo],
    ['play','Play', contr?.play],
    ['prior','Prior', contr?.prior],
    ['ppa','PPA', contr?.ppa],
    ['market','Market', contr?.market],
    ['returning','Returning', contr?.returning],
    ['ext','Ext', contr?.ext],
    ['mov','MOV', contr?.mov],
    ['off','Off', contr?.off],
    ['def','Def', contr?.def],
    ['sos','SoS', contr?.sos],
  ].filter(([, , v]) => v != null).sort((a,b) => Math.abs(b[2]) - Math.abs(a[2]));

  const pos = segs.filter(([, , v]) => v > 0);
  const neg = segs.filter(([, , v]) => v < 0);
  const posSum = pos.reduce((s,[, , v]) => s + v, 0);
  const negSum = neg.reduce((s,[, , v]) => s + Math.abs(v), 0);
  const total = (posSum + negSum) || 1;

  stackBar.innerHTML = ''; // container (already flex per CSS .bar > div)
  // two wraps (left: negatives, right: positives)
  const negWrap = document.createElement('div');
  negWrap.style.display = 'flex';
  negWrap.style.flex = '0 0 auto';
  negWrap.style.width = `${(negSum/total*100).toFixed(1)}%`;

  const posWrap = document.createElement('div');
  posWrap.style.display = 'flex';
  posWrap.style.flex = '0 0 auto';
  posWrap.style.width = `${(posSum/total*100).toFixed(1)}%`;

  neg.forEach(([cls, label, val]) => {
    const d = document.createElement('div');
    d.className = 'seg ' + cls;
    d.style.width = `${(Math.abs(val)/(negSum || 1)*100).toFixed(1)}%`;
    d.title = `${label}: ${fmt(val,2)}`;
    negWrap.appendChild(d);
  });
  pos.forEach(([cls, label, val]) => {
    const d = document.createElement('div');
    d.className = 'seg ' + cls;
    d.style.width = `${(Math.abs(val)/(posSum || 1)*100).toFixed(1)}%`;
    d.title = `${label}: ${fmt(val,2)}`;
    posWrap.appendChild(d);
  });

  stackBar.appendChild(negWrap);
  stackBar.appendChild(posWrap);

  if (stackLegend) {
    stackLegend.innerHTML = segs.map(([cls, label, val]) => {
      const sign = val >= 0 ? '+' : '';
      return `<span class="badge"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px" class="seg ${cls}"></span>${label}: ${sign}${fmt(val,2)}</span>`;
    }).join(' ');
  }
}


// Renders the Résumé chips in a tidy way
function renderResumeStats(r) {
  // if you already have a cached reference, use it; otherwise query
  const box = (typeof resumeBox !== 'undefined' && resumeBox)
    ? resumeBox
    : document.getElementById('resumeBox');
  if (!box) return;

  const qw25 = r.qualityWins25 ?? r.qw25 ?? 0;
  const qw50 = r.qualityWins50 ?? r.qw50 ?? 0;
  const badL = r.badLosses ?? r.bad ?? 0;
  const osW  = r.oneScoreW ?? r.oneScoreWins ?? 0;
  const osL  = r.oneScoreL ?? r.oneScoreLosses ?? 0;

  box.innerHTML = `
    <div class="resume-chips">
      <span class="badge">Top-25 wins: ${qw25}</span>
      <span class="badge">Top-50 wins: ${qw50}</span>
      <span class="badge">Bad losses: ${badL}</span>
      <span class="badge">One-score: ${osW}-${osL}</span>
    </div>
  `;
}

// ===== MERGED VERSION =====
// ===== FIXED: sets drawerIndex and updates nav buttons =====
function openDrawer(r) {
  // Use existing refs if you have them; otherwise query
  const _drawer   = (typeof drawer !== 'undefined' && drawer) ? drawer : document.getElementById('explainDrawer');
  const _overlay  = (typeof overlay !== 'undefined' && overlay) ? overlay : document.getElementById('drawerOverlay');
  const _titleEl  = (typeof drawerTitle !== 'undefined' && drawerTitle) ? drawerTitle : document.getElementById('drawerTitle');
  const _subEl    = (typeof drawerSubtitle !== 'undefined' && drawerSubtitle) ? drawerSubtitle : document.getElementById('drawerSubtitle');

  if (!_drawer || !_overlay) return;

  // --- NEW: remember which team is open (enables Prev/Next) ---
  const list = getRankingList();                 // current sorted rows
  drawerIndex = list.findIndex(x => x.team === r.team);
  updateDrawerNavButtons(list.length);           // enable/disable buttons based on position

  // Header
  if (_titleEl) _titleEl.textContent = r.team;
  if (_subEl)   _subEl.textContent   = `Rank ${r.rank}${r.conference ? `, Conf ${r.conference}` : ''}`;

  // Stacked contributions, Z-scores, Résumé
  if (typeof renderContribStack === 'function') renderContribStack(r.contr);
  if (typeof renderZScores     === 'function') renderZScores(r.z);
  if (typeof renderResumeStats === 'function') renderResumeStats(r);

  // Recent games
  const yr = (typeof lastRankings !== 'undefined' && lastRankings && lastRankings.year) || new Date().getFullYear();
  const tw = (typeof lastRankings !== 'undefined' && lastRankings && lastRankings.throughWeek) || '';
  if (typeof fillRecentGames === 'function') fillRecentGames(r.team, yr, tw);

  // Open
  _overlay.classList.add('show');
  _drawer.classList.add('open');

  // Click-away + Esc to close (and clean up listeners)
  const closeDrawer = () => {
    _overlay.classList.remove('show');
    _drawer.classList.remove('open');
    document.removeEventListener('keydown', escHandler);
    _overlay.removeEventListener('click', overlayHandler);
  };
  const overlayHandler = (e) => { if (e.target === _overlay) closeDrawer(); };
  const escHandler     = (e) => { if (e.key === 'Escape') closeDrawer(); };

  _overlay.addEventListener('click', overlayHandler);
  document.addEventListener('keydown', escHandler);
}


// NEW: button click handlers
if (drawerPrev)  drawerPrev.addEventListener('click',  () => openByOffset(-1));
if (drawerNext)  drawerNext.addEventListener('click',  () => openByOffset(1));
if (drawerFirst) drawerFirst.addEventListener('click', () => {
  const list = getRankingList(); if (list.length) openDrawer(list[0]);
});
if (drawerLast)  drawerLast.addEventListener('click',  () => {
  const list = getRankingList(); if (list.length) openDrawer(list[list.length - 1]);
});

// NEW: keyboard nav while drawer is open
document.addEventListener('keydown', (e) => {
  if (!drawer || !drawer.classList.contains('open')) return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (['INPUT','SELECT','TEXTAREA'].includes(tag)) return; // avoid hijacking inputs
  if (e.key === 'ArrowLeft')  { e.preventDefault(); openByOffset(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); openByOffset(1); }
  if (e.key === 'Home')       { e.preventDefault(); const list = getRankingList(); if (list.length) openDrawer(list[0]); }
  if (e.key === 'End')        { e.preventDefault(); const list = getRankingList(); if (list.length) openDrawer(list[list.length - 1]); }
  if (e.key === 'Escape')     { e.preventDefault(); overlay?.click(); }
});



function openConfDrawer(confName) {
  if (!lastRankings || !confDrawer || !confTeamsTbody || !overlay) return;
  const rows = lastRankings.rankings || lastRankings || [];
  const teams = rows
    .filter(t => (t.conference || 'Independent') === confName)
    .sort((a,b) => (a.rank||9999) - (b.rank||9999));

  if (confDrawerTitle)    confDrawerTitle.textContent = confName;
  if (confDrawerSubtitle) confDrawerSubtitle.innerHTML = `${teams.length} teams • ${confBadge(confName)}`;

drawerIndex = -1;
updateDrawerNavButtons(0);

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

// Existing compare handler — append the two lines marked NEW
onId('compareBtn', 'click', async () => {
  const nameA = resolveTeamInput('compareA');
  const nameB = resolveTeamInput('compareB');

 // if (!_teamNames.includes(nameA) || !_teamNames.includes(nameB)) {
   // alert('Please pick valid teams from the list (type to search, then choose a suggestion).');
    // return;
  // }

  const a = findTeamRowByName(nameA);
  const b = findTeamRowByName(nameB);
  if (!a || !b) { return; }
//    if (!a || !b) { alert('Could not find teams in current rankings. Re-run rankings and try again.'); return; }


  const perGameChk = document.getElementById('comparePerGame');
  const perGameMode = !!(perGameChk && perGameChk.checked);

  renderStatComparison(a, b, perGameMode);
  const canvas = document.getElementById('radarCanvas');
  drawMiniRadar(canvas, a, b);

  // NEW: keep refs & render prediction
  lastCompare = { a, b };
  renderPrediction(a, b);

  await renderH2HAndCommon(a, b);
});

// Recompute when the site (Neutral/Home) changes
onId('predLoc', 'change', () => {
  if (lastCompare.a && lastCompare.b) renderPrediction(lastCompare.a, lastCompare.b);
});



// auto-recompare on change
['compareA','compareB','comparePerGame'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => {
    const btn = document.getElementById('compareBtn');
    if (btn) btn.click();
  });
});
['compareASearch','compareBSearch'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => {
    const btn = document.getElementById('compareBtn');
    // run automatically if both selects currently have a value
    const a = document.getElementById('compareA');
    const b = document.getElementById('compareB');
    if (btn && a && b && a.value && b.value) btn.click();
  });
});


// ---------- compare → prediction helpers ----------
let lastCompare = { a: null, b: null };

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function gamesPlayed(r) {
  return Math.max(1, safeNum(r.wins, 0) + safeNum(r.losses, 0));
}
function eloWinProb(dElo) {
  // Standard Elo logistic curve
  return 1 / (1 + Math.pow(10, -dElo / 400));
}
function eloDiffToMargin(dElo) {
  // Tunable: how many Elo points ≈ 1 scoreboard point.
  // 25 works well as a conservative default for CFB-like scoring.
  const ELO_PER_POINT = 25;
  return dElo / ELO_PER_POINT;
}

/**
 * Predict outcome (win%, spread, total, scores) from team rows.
 * site: 'neutral' | 'homeA' | 'homeB'
 */
function predictOutcome(a, b, site = 'neutral') {
  const hfa = Number(weights?.hfa ?? 65);         // Elo points from your UI slider
  let dElo = safeNum(a.elo, 0) - safeNum(b.elo, 0);
  if (site === 'homeA') dElo += hfa;
  else if (site === 'homeB') dElo -= hfa;

  const pA = eloWinProb(dElo);
  const pB = 1 - pA;
  const margin = eloDiffToMargin(dElo);          // A minus B, in points

  // Build a sane scoring baseline from PF/PA per game
  const gA = gamesPlayed(a), gB = gamesPlayed(b);
  const aPF = safeNum(a.pointsFor, 0) / gA;
  const aPA = safeNum(a.pointsAgainst, 0) / gA;
  const bPF = safeNum(b.pointsFor, 0) / gB;
  const bPA = safeNum(b.pointsAgainst, 0) / gB;

  // Expected points for each team = average(own offense, opponent defense)
  let aBase = (aPF + bPA) / 2;
  let bBase = (bPF + aPA) / 2;
  if (!Number.isFinite(aBase) || aBase <= 0) aBase = 28;
  if (!Number.isFinite(bBase) || bBase <= 0) bBase = 24;

  // Shift baseline so the difference matches the Elo-implied margin
  const baseDiff = aBase - bBase;
  const delta = margin - baseDiff;
  let aPts = Math.max(0, aBase + delta / 2);
  let bPts = Math.max(0, bBase - delta / 2);

  // Keep numbers in a realistic range
  aPts = Math.min(70, aPts);
  bPts = Math.min(70, bPts);

  return {
    pA, pB,
    spreadA: margin,            // positive → favors A
    total: aPts + bPts,
    aPts, bPts
  };
}

function renderPrediction(a, b) {
  const out = document.getElementById('predOut');
  const sel = document.getElementById('predLoc');
  if (!out || !sel) return;

  const site = sel.value || 'neutral';
  const pred = predictOutcome(a, b, site);

  const { pA, pB, spreadA, total, aPts, bPts } = pred;
  const aName = a.team, bName = b.team;
  const fav = spreadA >= 0 ? aName : bName;
  const absSpread = Math.abs(spreadA);

  out.innerHTML = `
    <div class="row" style="gap:8px; flex-wrap:wrap">
    <span class="badge">${fav} favored by ${absSpread.toFixed(1)}</span>  
    <span class="badge">${site === 'neutral' ? 'Neutral' : (site === 'homeA' ? aName + ' home' : bName + ' home')}</span>
    <span class="badge">Total ~ ${total.toFixed(1)}</span>
    <span class="badge">${aName} win %: ${(pA*100).toFixed(1)}%</span>
    <span class="badge">${bName} win %: ${(pB*100).toFixed(1)}%</span>
    </div>
    <div class="tiny" style="margin-top:6px">
      Projected score: <strong>${aName} ${aPts.toFixed(1)}</strong> — <strong>${bName} ${bPts.toFixed(1)}</strong>
    </div>
  `;
}


let _teamNames = [];

function setTeamLists(names) {
  _teamNames = Array.isArray(names) ? names.slice() : [];
  const aList = document.getElementById('compareAList');
  const bList = document.getElementById('compareBList');
  const opts = _teamNames.map(n => `<option value="${n}"></option>`).join('');
  if (aList) aList.innerHTML = opts;
  if (bList) bList.innerHTML = opts;
}

// Try to resolve what's typed to a valid team name.
// - exact (case-insens) match wins
// - if exactly one contains() match, use it
function resolveTeamInput(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return null;
  const raw = (el.value || '').trim();
  if (!raw) return null;
  const lc = raw.toLowerCase();
  const exact = _teamNames.find(n => n.toLowerCase() === lc);
  if (exact) { el.value = exact; return exact; }
  const matches = _teamNames.filter(n => n.toLowerCase().includes(lc));
  if (matches.length === 1) { el.value = matches[0]; return matches[0]; }
  return raw; // unresolved; caller will check validity
}

function findTeamRowByName(name) {
  const list = (lastRankings && (lastRankings.rankings || lastRankings)) || [];
  return list.find(r => r.team === name) || null;
}

['compareA','compareB'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;

  // When user picks a suggestion from the datalist, 'change' fires.
  el.addEventListener('change', () => {
    const a = document.getElementById('compareA');
    const b = document.getElementById('compareB');
    const btn = document.getElementById('compareBtn');
    if (a?.value && b?.value && btn) btn.click();
  });

  // If they just type and hit Enter:
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const btn = document.getElementById('compareBtn');
      if (btn) btn.click();
    }
  });
});

// Keep your existing 'compareSwap' handler — it still works, since these are inputs now.


// swap teams
onId('compareSwap', 'click', () => {
  const a = document.getElementById('compareA');
  const b = document.getElementById('compareB');
  if (!a || !b) return;
  const tmp = a.value; a.value = b.value; b.value = tmp;
  const btn = document.getElementById('compareBtn');
  if (btn) btn.click();
});

// Make a <select> searchable via an adjacent <input>
function setupSelectSearch(selectId, inputId, allNames) {
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(inputId);
  if (!sel || !inp) return;

  // keep the master list per select
  sel._allNames = Array.isArray(allNames) ? allNames.slice() : [];

  function rebuildOptions(query = '') {
    const q = query.trim().toLowerCase();
    const prior = sel.value;
    const source = sel._allNames || [];
    const filtered = q
      ? source.filter(n => n.toLowerCase().includes(q))
      : source;

    sel.innerHTML = '';
    filtered.forEach(n => sel.append(new Option(n, n)));

    // keep prior selection if still present
    if (prior && filtered.includes(prior)) {
      sel.value = prior;
    } else if (!sel.value && filtered.length) {
      sel.value = filtered[0];
    }
  }

  // Bind once
  if (!inp._boundSearch) {
    inp.addEventListener('input', () => rebuildOptions(inp.value));
    // Enter selects first filtered result and fires change
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (sel.options.length) {
          sel.value = sel.options[0].value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    inp._boundSearch = true;
  }

  // initial fill
  rebuildOptions(inp.value || '');
}


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
