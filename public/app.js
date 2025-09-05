/* global Chart */
let activeTab = 'ingest';
const panels = {};
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    document.querySelectorAll('section[role="tabpanel"]').forEach(p => p.hidden = true);
    panels[activeTab].hidden = false;
  });
});

panels.ingest = document.getElementById('panel-ingest');
panels.rank = document.getElementById('panel-rank');
panels.compare = document.getElementById('panel-compare');

// theme toggle
document.getElementById('themeToggle').addEventListener('change', e => {
  document.documentElement.dataset.theme = e.target.value;
});

// elements
const ingestBtn = document.getElementById('ingestBtn');
const yearIngest = document.getElementById('yearIngest');
const endWeek = document.getElementById('endWeek');
const ingestMeta = document.getElementById('ingestMeta');
const refreshCache = document.getElementById('refreshCache');
const clearYear = document.getElementById('clearYear');
const clearAll = document.getElementById('clearAll');
const previewKind = document.getElementById('previewKind');
const previewWeek = document.getElementById('previewWeek');
const previewBtn = document.getElementById('previewBtn');
const previewOut = document.getElementById('previewOut');
const cacheFiles = document.getElementById('cacheFiles');

const yearRank = document.getElementById('yearRank');
const weekRank = document.getElementById('weekRank');
const rankBtn = document.getElementById('rankBtn');
const deltaBtn = document.getElementById('deltaBtn');
const rankTbody = document.getElementById('rankTbody');
const dataBadges = document.getElementById('dataBadges');
const profileSel = document.getElementById('profile');
const savePresetBtn = document.getElementById('savePreset');
const loadPresetBtn = document.getElementById('loadPreset');
const exportCsvBtn  = document.getElementById('exportCsv');
const resetDefaultsBtn = document.getElementById('resetDefaults');


// ---- conference colors
const CONF_COLORS = {
  "SEC":"#1f6feb","Big Ten":"#ffb000","ACC":"#013ca6","Big 12":"#c8102e",
  "Pac-12":"#00629b","AAC":"#00a0b0","MWC":"#662d91","Mountain West":"#662d91",
  "Sun Belt":"#ffcc00","MAC":"#006747","C-USA":"#003da5","CUSA":"#003da5",
  "Ind":"#444","Independent":"#444"
};

// utils
function fmt(n, d=2) { return n==null? '—' : Number(n).toFixed(d); }
function confBadge(conf) { const c = conf||''; const bg = CONF_COLORS[c]||'var(--chip)'; return `<span class="conf" style="background:${bg};color:#fff;padding:2px 8px;border-radius:999px">${c}</span>`; }
function showConfirm(msg, cb) { confirmText.textContent = msg; confirmCb = cb; confirmDlg.showModal(); }

// ---- dropdown population
async function populateYears() {
  const r = await fetch('/api/cache-info').then(r=>r.json()).catch(()=>({}));
  const current = new Date().getFullYear();
  const fullRange = Array.from({length: current-2005+1}, (_,i)=> String(current-i));
  const cachedYears = Array.isArray(r.years) && r.years.length ? r.years.map(String) : fullRange;

  // Ingest should allow ANY year in the full range
  if (yearIngest) { yearIngest.innerHTML = ''; fullRange.forEach(y=> yearIngest.append(new Option(y,y))); }

  // Rank should show only cached years (fallback to full range if nothing returned)
  if (yearRank)   { yearRank.innerHTML   = ''; cachedYears.forEach(y=> yearRank.append(new Option(y,y))); }

  // Defaults
  if (yearIngest && !yearIngest.value) yearIngest.value = fullRange[0];
  if (yearRank && !yearRank.value) yearRank.value = cachedYears[0];

  await populateWeeksForYear(yearIngest?.value || fullRange[0]);
}


async function populateWeeksForYear(year) {
  const r = await fetch(`/api/cache-info?year=${year}`).then(r=>r.json()).catch(()=>({}));
  let weeks = Array.isArray(r.weeks) ? r.weeks.map(String) : [];
  if (!weeks.length) { weeks = Array.from({length:20},(_,i)=> String(i+1)); } // fallback so it’s never empty
  if (endWeek) { endWeek.innerHTML = '<option value="">All weeks</option>'; weeks.forEach(w=> endWeek.append(new Option(w,w))); }
  if (weekRank){ weekRank.innerHTML= '<option value="">All weeks</option>'; weeks.forEach(w=> weekRank.append(new Option(w,w))); }
}

if (yearIngest) yearIngest.addEventListener('change', async ()=>{ await populateWeeksForYear(yearIngest.value); await loadCacheInfo(); });
if (yearRank)   yearRank.addEventListener('change', async ()=>{ await populateWeeksForYear(yearRank.value); });

// drawers
const overlay = document.getElementById('drawerOverlay');
const drawer = document.getElementById('explainDrawer');
const drawerTitle = document.getElementById('drawerTitle');
const drawerSubtitle = document.getElementById('drawerSubtitle');
const stackBar = document.getElementById('stackBar');
const stackLegend = document.getElementById('stackLegend');
const zScoresBox = document.getElementById('zScores');
const resumeBox = document.getElementById('resumeBox');
const recentGamesBox = document.getElementById('recentGames');
document.getElementById('drawerClose').onclick = () => { drawer.classList.remove('open'); overlay.classList.remove('show'); };

// confirm dialogs
const confirmDlg = document.getElementById('confirmDlg');
const confirmText = document.getElementById('confirmText');
const confirmCancel = document.getElementById('confirmCancel');
const confirmOk = document.getElementById('confirmOk');
let confirmCb = null;
confirmCancel.onclick = () => { confirmDlg.close(); };
confirmOk.onclick = () => { if (confirmCb) confirmCb(); confirmDlg.close(); };

// --- rank (weights + bindings)
const weights = {wElo:0.5,wPlay:0.25,wPrior:0.1,sosWeight:0.15,wPPA:0.1,wMarket:0.03,wReturn:0.02,wExt:0,k:20,hfa:65,fcsWeight:0.6};

const binds = [
  ['wElo', 'wEloV'], ['wPlay','wPlayV'], ['wPrior','wPriorV'], ['sosWeight','sosWeightV'],
  ['wPPA','wPPAV'], ['wMarket','wMarketV'], ['wReturn','wReturnV'], ['wExt','wExtV'],
  ['k','kV'], ['hfa','hfaV'], ['fcsWeight','fcsWeightV']
];
binds.forEach(([id,vid])=>{
  const el = document.getElementById(id);
  const vv = document.getElementById(vid);
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

// ---- presets (localStorage)
const PRESETS_KEY = 'cfb_presets_v1';
function getPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || {}; }
  catch { return {}; }
}
function setPresets(p) { localStorage.setItem(PRESETS_KEY, JSON.stringify(p)); }
function readWeightsFromUI() {
  // 'weights' is already updated live by the slider bindings:contentReference[oaicite:4]{index=4}
  return { ...weights, profile: profileSel?.value || 'balanced' };
}
function applyWeightsToUI(w) {
  if (!w) return;
  Object.entries(w).forEach(([k,v])=>{
    if (k === 'profile') {
      if (profileSel) profileSel.value = v;
      return;
    }
    const el = document.getElementById(k);
    const vv = document.getElementById(k + 'V');
    if (el) {
      el.value = v;
      // Reuse existing logic to update labels & weights map
      el.dispatchEvent(new Event('input', { bubbles:true }));
      el.dispatchEvent(new Event('change', { bubbles:true }));
      if (vv && (k==='k' || k==='hfa')) vv.textContent = String(v);
    }
  });
}

// ---- profile presets -> auto-apply to sliders
const PROFILE_PRESETS = {
  balanced: {     // your current defaults
    wElo:0.50, wPlay:0.25, wPrior:0.10, sosWeight:0.15,
    wPPA:0.10, wMarket:0.03, wReturn:0.02, wExt:0.00,
    k:20, hfa:65, fcsWeight:0.60,
  },
  predictive: {   // tilt toward forecasting "true strength"
    wElo:0.60, wPlay:0.30, wPrior:0.05, sosWeight:0.05,
    wPPA:0.15, wMarket:0.05, wReturn:0.02, wExt:0.00,
    k:30, hfa:65, fcsWeight:0.60,
  },
  resume: {       // tilt toward results & schedule
    wElo:0.35, wPlay:0.20, wPrior:0.05, sosWeight:0.25,
    wPPA:0.10, wMarket:0.00, wReturn:0.00, wExt:0.00,
    k:15, hfa:65, fcsWeight:0.60,
  },
};

function applyProfile(name) {
  const preset = PROFILE_PRESETS[name] || PROFILE_PRESETS.balanced;
  Object.entries(preset).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(val);
    // reuse existing bindings to update `weights` and tiny value labels
    el.dispatchEvent(new Event('input',  { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  });
}

// when the user changes the Profile dropdown, apply the preset
if (profileSel) {
  profileSel.addEventListener('change', () => applyProfile(profileSel.value));
}


// wire up buttons
savePresetBtn.onclick = () => {
  const name = prompt('Preset name?');
  if (!name) return;
  const presets = getPresets();
  presets[name] = readWeightsFromUI();
  setPresets(presets);
  alert(`Saved preset "${name}".`);
};

loadPresetBtn.onclick = () => {
  const presets = getPresets();
  const names = Object.keys(presets);
  if (!names.length) { alert('No presets saved yet.'); return; }
  const name = prompt(`Enter a preset name:\n${names.join(', ')}`);
  if (!name || !presets[name]) { alert('Preset not found.'); return; }
  applyWeightsToUI(presets[name]);
  alert(`Loaded preset "${name}".`);
};

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

exportCsvBtn.onclick = () => {
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
};

// ---- reset defaults
const DEFAULTS = {
  wElo: 0.5,
  wPlay: 0.25,
  wPrior: 0.10,
  sosWeight: 0.15,
  wPPA: 0.10,
  wMarket: 0.03,
  wReturn: 0.02,
  wExt: 0.00,
  k: 20,
  hfa: 65,
  fcsWeight: 0.60,
  // not a slider, but good to reset too:
  profile: 'balanced',
};

function resetToDefaults() {
  // sliders + numeric ranges
  Object.entries(DEFAULTS).forEach(([k, v]) => {
    if (k === 'profile') return;
    const el = document.getElementById(k);
    if (el) {
      el.value = v;
      // trigger existing binding logic to update `weights` + tiny labels
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  // profile select
  if (profileSel && DEFAULTS.profile) {
    profileSel.value = DEFAULTS.profile;
  }
}

resetDefaultsBtn.onclick = resetToDefaults;


rankBtn.onclick = ()=> runRank(false);
deltaBtn.onclick = ()=> runRank(true);

async function runRank(delta=false) {
  const yr = yearRank.value;
  const wk = weekRank.value || '';
  const params = new URLSearchParams({ year: String(yr) });
  if (wk) params.set(delta? 'week' : 'throughWeek', String(wk));
  Object.entries(weights).forEach(([k,v])=> params.set(k, String(v)));
  const url = delta ? `/api/rank-delta?${params.toString()}` : `/api/rank-from-cache?${params.toString()}`;
  const r = await fetch(url).then(r=>r.json()).catch(e=>({error:e.message}));
  if (r.error) { alert(r.error); return; }
  const rows = r.rankings || r.rows || r.data || (Array.isArray(r)? r : []);
  const meta = r.meta || {};
  renderTable(rows, meta);
  lastRankings = { rankings: rows, meta, year: yr, throughWeek: wk };
}

function badges(used) {
  used = used || {};
  dataBadges.innerHTML = '';
  const def = { advanced:'Advanced', ppa:'PPA', lines:'Lines', returning:'Returning', eloExt:'Ext Elo', srsExt:'Ext SRS' };
  Object.entries(def).forEach(([k,label])=>{
    const span = document.createElement('span');
    span.className = 'badge ' + (used && used[k] ? 'on':'off');
    span.textContent = label;
    dataBadges.appendChild(span);
  });
}

let lastRankings=null;

function renderTable(rows, meta) {
  rows = rows || [];
  rankTbody.innerHTML = '';
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
    rankTbody.appendChild(tr);
  });
  // populate compare selects
  compareA.innerHTML = ''; compareB.innerHTML = '';
  rows.forEach(r=>{ compareA.append(new Option(r.team, r.team)); compareB.append(new Option(r.team, r.team)); });
}

// --- drawer helpers (recent games)
let _gamesCache=null;
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
  recentGamesBox.innerHTML = any.map(g=>{
    const isHome = g.homeTeam===team, opp = isHome? g.awayTeam : g.homeTeam;
    const us = isHome? g.homePoints : g.awayPoints;
    const them = isHome? g.awayPoints : g.homePoints;
    const wl = (us!=null && them!=null) ? (us>them?'W':(us<them?'L':'T')) : '?';
    const loc = isHome? 'vs' : 'at';
    return `<tr><td>${g.week}</td><td>${opp}</td><td>${loc}</td><td class="right">${us!=null?us:'-'}:${them!=null?them:'-' } (${wl})</td></tr>`;
  }).join('');
}

// --- drawer
function openDrawer(r) {
  drawerTitle.textContent = r.team;
  drawerSubtitle.textContent = `Rank ${r.rank}, Conf ${r.conference||''}`;
  stackBar.innerHTML='';
  const segs = [
    ['elo','Elo',r.contr.elo],
    ['play','Play',r.contr.play],
    ['prior','Prior',r.contr.prior],
    ['ppa','PPA',r.contr.ppa],
    ['market','Market',r.contr.market],
    ['returning','Returning',r.contr.returning],
    ['ext','Ext',r.contr.ext],
    ['sos','SoS',r.contr.sos],
  ];
  const tot = segs.reduce((a,b)=>a+Math.abs(b[2]||0),0)||1;
  segs.forEach(([cls,label,val])=>{
    const div = document.createElement('div');
    div.className = 'seg '+cls;
    div.style.width = `${(Math.abs(val)/tot*100).toFixed(1)}%`;
    stackBar.appendChild(div);
  });
  stackLegend.textContent = segs.map(([cls,label,val])=>`${label}:${fmt(val,2)}`).join(' • ');
  zScoresBox.textContent = Object.entries(r.z||{}).map(([k,v])=>`${k}:${fmt(v,2)}`).join(' | ');
  resumeBox.textContent = `QW25:${r.qualityWins25||0} QW50:${r.qualityWins50||0} BadL:${r.badLosses||0} One-score:${(r.oneScoreW||0)}-${(r.oneScoreL||0)}`;

  // recent games
  fillRecentGames(r.team, (lastRankings&&lastRankings.year)||new Date().getFullYear(), (lastRankings&&lastRankings.throughWeek)||'');
  overlay.classList.add('show'); drawer.classList.add('open');
}

// --- compare
const compareA = document.getElementById('compareA');
const compareB = document.getElementById('compareB');
const compareBtn = document.getElementById('compareBtn');
const commonOpp = document.getElementById('commonOpp');
const h2h = document.getElementById('h2h');
let radarChart=null;

compareBtn.onclick = () => doCompare();

async function doCompare() {
  if (!lastRankings) { alert('Run a ranking first (Step 2) to load teams.'); return; }
  const rows = lastRankings.rankings || lastRankings;
  const a = rows.find(x => x.team === compareA.value);
  const b = rows.find(x => x.team === compareB.value);
  if (!a || !b) { alert('Select two valid teams.'); return; }
const thA = document.getElementById('thTeamA');
const thB = document.getElementById('thTeamB');
if (thA) thA.textContent = a.team;
if (thB) thB.textContent = b.team;
  // --- Radar (existing behavior)
  const labels = ['Elo','Play','Prior','PPA','Market','Returning','SoS'];
  const da = [a.z?.elo,a.z?.play,a.z?.prior,a.z?.ppa,a.z?.market,a.z?.returning,a.z?.sos];
  const db = [b.z?.elo,b.z?.play,b.z?.prior,b.z?.ppa,b.z?.market,b.z?.returning,b.z?.sos];
  const ctx = document.getElementById('radarCanvas').getContext('2d');
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

  // --- Tables (H2H + Common Opponents)
  const year = (lastRankings && lastRankings.year) || new Date().getFullYear();
  const throughWeek = (lastRankings && lastRankings.throughWeek) || '';
  const games = await getGamesForYear(year); // uses your existing cache helper:contentReference[oaicite:5]{index=5}
  const upto = games.filter(g => (throughWeek ? (g.week || 0) <= Number(throughWeek) : true));

  // Head-to-head games
  const h2hGames = upto.filter(g =>
    (g.homeTeam === a.team && g.awayTeam === b.team) ||
    (g.homeTeam === b.team && g.awayTeam === a.team)
  ).sort((x,y)=> (x.week||0) - (y.week||0));

  const formatScore = (g) => {
    const home = `${g.homeTeam} ${g.homePoints ?? '-'}`;
    const away = `${g.awayTeam} ${g.awayPoints ?? '-'}`;
    return `${home} — ${away}`;
  };

  h2h.innerHTML = h2hGames.map(g => {
    const date = g.startDate || g.start || `W${g.week||''}`;
    const res = formatScore(g);
    return `<tr><td>${date}</td><td class="right">${res}</td></tr>`;
  }).join('') || `<tr><td colspan="2">No head-to-head games found.</td></tr>`;

  // Common opponents
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


// ingest & cache

ingestBtn.onclick = async () => {
  const year = (yearIngest && yearIngest.value) || new Date().getFullYear();
  const endW = (endWeek && endWeek.value) || '';
  ingestMeta.textContent = 'Fetching...';
  const r = await fetch(`/api/ingest?year=${year}&endWeek=${endW}`).then(r=>r.json()).catch(e=>({error:e.message}));
  if (r.error) { ingestMeta.textContent = 'Error: '+r.error; return; }
  ingestMeta.textContent = `Cached: Teams ${r.datasets.teams}, Games ${r.datasets.games}, Adv ${r.datasets.advanced} — Last fetched: ${new Date(r.ingestedAt).toLocaleString()}`;
  await loadCacheInfo();
};

async function loadCacheInfo() {
  const yr = (yearIngest && yearIngest.value) || new Date().getFullYear();
  const r = await fetch(`/api/cache-info?year=${yr}`).then(r=>r.json()).catch(()=>({}));
  cacheFiles.innerHTML = '';
  (r.files||[]).forEach(f=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${f.name}</td><td class="right">${(f.bytes/1024).toFixed(1)} KB</td><td class="right">${new Date(f.mtime).toLocaleString()}</td>`;
    cacheFiles.appendChild(tr);
  });
  if ((r.files||[]).length) { refreshCache.style.display=clearYear.style.display=clearAll.style.display='inline-block'; }
  else { refreshCache.style.display=clearYear.style.display=clearAll.style.display='none'; }
  // refresh week selects for this year
  await populateWeeksForYear(yr);
}
refreshCache.onclick = loadCacheInfo;

clearYear.onclick = () => showConfirm('Clear cached data for this year?', async ()=>{
  const yr = (yearIngest && yearIngest.value) || new Date().getFullYear();
  await fetch(`/api/clear-cache?year=${yr}`,{method:'DELETE'});
  await loadCacheInfo(); previewOut.textContent='';
});
clearAll.onclick = () => showConfirm('Clear ALL cached data?', async ()=>{
  await fetch(`/api/clear-cache`,{method:'DELETE'});
  await loadCacheInfo(); previewOut.textContent='';
});
previewBtn.onclick = async () => {
  const yr = (yearIngest && yearIngest.value) || new Date().getFullYear();
  const kind = previewKind.value; const wk = previewWeek.value;
  const url = `/api/cache-data?year=${yr}&kind=${kind}${wk?`&week=${wk}`:''}`;
  const r = await fetch(url).then(r=>r.json()).catch(e=>({error:e.message}));
  previewOut.textContent = JSON.stringify(r,null,2);
};

// init
(async function init(){
  await populateYears();
  await populateWeeksForYear(yearIngest.value);
  await loadCacheInfo();
})();
