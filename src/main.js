const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('pitlink-scout', 2);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains('records')) {
      const store = request.result.createObjectStore('records', { keyPath: 'id' });
      store.createIndex('team', 'team');
      store.createIndex('match', 'match');
    }
    if (!request.result.objectStoreNames.contains('assets')) {
      request.result.createObjectStore('assets', { keyPath: 'id' });
    }
  };
  request.onsuccess = () => {
    const db = request.result;
    resolve({
      getAll: (store = 'records') => transact(store, 'readonly', s => s.getAll()),
      get: (store, key) => transact(store, 'readonly', s => s.get(key)),
      put: (store, value) => transact(store, 'readwrite', s => s.put(value)),
      delete: (store, key) => transact(store, 'readwrite', s => s.delete(key)),
      clear: (store = 'records') => transact(store, 'readwrite', s => s.clear())
    });
    function transact(storeName, mode, action) {
      return new Promise((res, rej) => {
        const tx = db.transaction(storeName, mode);
        const req = action(tx.objectStore(storeName));
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    }
  };
  request.onerror = () => reject(request.error);
});

const makeId = () => crypto.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

const CRI_EVENT = Object.freeze({
  id: 'cri-2026',
  name: 'CRI 2026',
  fullName: 'Chesapeake Robotics Icebreaker',
  tbaKey: '2026vaale1',
  year: '2026',
  tournamentDate: 'Saturday, September 26',
  showcaseDate: 'Sunday, September 27',
  location: 'Hayfield Secondary School · Alexandria, VA',
  teams: ['116','422','449','614','620','623','686','888','1599','1727','1731','1915','2106','2186','2199','2377','2421','2537','4099','4472','4638','5115','5243','5338','5549','5587','5830','8230','9033','9072','9072B','11415']
});

function prepareCriDevice(showToast = true) {
  let savedEvents = [];
  try { savedEvents = JSON.parse(localStorage.getItem('tiger-saved-events') || '[]'); } catch {}
  const previousTbaEvent = localStorage.getItem('tiger-tba-event') || '';
  localStorage.setItem('tiger-saved-events', JSON.stringify([...new Set([...savedEvents, CRI_EVENT.name])].sort()));
  localStorage.setItem('tiger-selected-event', CRI_EVENT.name);
  localStorage.setItem('tiger-last-scout-event', CRI_EVENT.name);
  localStorage.setItem('tiger-tba-event', CRI_EVENT.tbaKey);
  localStorage.setItem('tiger-tba-year', CRI_EVENT.year);
  localStorage.setItem('tiger-matchprep-team', '9072');
  localStorage.setItem('tiger-cri-preset-version', CRI_EVENT.id);
  if (previousTbaEvent && previousTbaEvent !== CRI_EVENT.tbaKey) {
    localStorage.removeItem('tiger-tba-schedule');
    localStorage.removeItem('tiger-tba-last-sync');
    localStorage.removeItem('tiger-matchprep-match');
  }
  draft.event = CRI_EVENT.name;
  if (showToast) toast('CRI 2026 is selected and ready for scouting.');
}

const blank = () => ({
  id: makeId(),
  v: 3,
  event: '',
  match: '',
  team: '',
  scout: '',
  alliance: 'red',
  autoFuel: 0,
  autoFuelRate: 0,
  autoFuelSeconds: 0,
  autoTower: 'None',
  teleFuel: 0,
  teleFuelRate: 0,
  teleFuelSeconds: 0,
  teleTower: 'None',
  trench: false,
  bump: false,
  groundIntake: false,
  defense: 0,
  playedDefense: false,
  fouls: 0,
  broke: false,
  notes: '',
  createdAt: Date.now()
});

let draft = blank();
let scanner;
let chart;
let editorSearch = '';
let editorEvent = 'all';
QrScanner.WORKER_PATH = new URL('public/vendor/qr-scanner-worker.min.js', location.href).href;

const app = document.querySelector('#app');

app.innerHTML = `
  <header class="topbar">
    <button class="brand" data-go="home" aria-label="Tiger Scout home">
      <span class="mark"><img src="team-9072-logo.png" alt=""></span><span><b>Tiger Scout</b><small>TEAM 9072</small></span>
    </button>
    <nav class="topnav" aria-label="Primary navigation">
      <button data-go="scout">Scout</button>
      <button data-go="events">Events</button>
      <button data-go="data" class="analysis-nav">Data Readout</button>
      <button data-go="picklist" class="analysis-nav">Picklist</button>
      <button data-go="notes" class="notes-nav" data-feature-hidden hidden>Notes</button>
      <button data-go="matchprep" class="matchprep-nav" hidden>Match Prep</button>
      <button data-go="compare" class="compare-nav" data-feature-hidden hidden>Compare</button>
      <button data-go="prescout" class="prescout-nav" data-feature-hidden hidden>Pre-Scout</button>
      <button data-go="scan" class="scan-nav">Scan</button>
      <button data-go="editor" class="admin-nav" hidden>Editor</button>
    </nav>
    <div class="top-actions">
      <button class="settings-button" data-go="settings" aria-label="Open settings" title="Settings"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.25"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.53-1H3v-4h.08A1.7 1.7 0 0 0 4.6 8.97a1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.03 4.2l.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg></button>
    </div>
  </header>
  <main id="view"></main>
  <nav class="tabs">
    <button data-go="home"><span>⌂</span>Home</button>
    <button data-go="scout"><span>＋</span>Scout</button>
    <button data-go="events"><span>◆</span>Events</button>
    <button data-go="data" class="analysis-nav"><span>▥</span>Readout</button>
    <button data-go="picklist" class="analysis-nav"><span>★</span>Picks</button>
    <button data-go="notes" class="notes-nav" data-feature-hidden hidden><span>✎</span>Notes</button>
    <button data-go="matchprep" class="matchprep-nav" hidden><span>VS</span>Prep</button>
    <button data-go="compare" class="compare-nav" data-feature-hidden hidden><span>⇄</span>Compare</button>
    <button data-go="prescout" class="prescout-nav" data-feature-hidden hidden><span>◫</span>Pre</button>
    <button data-go="scan" class="scan-nav"><span>⌗</span>Scan</button>
    <button data-go="editor" class="admin-nav" hidden><span>✎</span>Edit</button>
  </nav>
  <div id="toast" role="status"></div>
`;

const view = document.querySelector('#view');
const toast = (message, bad = false) => {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.className = bad ? 'show bad' : 'show';
  setTimeout(() => el.className = '', 2500);
};

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const records = async () => (await dbPromise).getAll();
const appMode = () => localStorage.getItem('tiger-app-mode') || 'scouting';
const colorTheme = () => localStorage.getItem('tiger-color-theme') || 'dark';
function applyColorTheme() {
  document.body.dataset.theme = colorTheme();
}
function applyAppMode() {
  const viewer = appMode() === 'database';
  const command = appMode() === 'command';
  document.querySelectorAll('[data-go="scout"]').forEach(element => element.hidden = viewer);
  document.querySelectorAll('.analysis-nav').forEach(element => element.hidden = appMode() === 'scouting' || appMode() === 'notes');
  document.querySelectorAll('.notes-nav, .compare-nav, .prescout-nav').forEach(element => element.hidden = true);
  document.querySelectorAll('.matchprep-nav').forEach(element => element.hidden = appMode() !== 'matchprep' && !command);
  document.querySelectorAll('.scan-nav').forEach(element => element.hidden = appMode() === 'scouting' || appMode() === 'notes');
  document.querySelectorAll('.admin-nav').forEach(element => element.hidden = !command && (!adminUnlocked() || appMode() === 'scouting' || appMode() === 'notes'));
  if (command) document.querySelectorAll('.topnav button, .tabs button').forEach(element => {
    if (!element.hasAttribute('data-feature-hidden')) element.hidden = false;
  });
  document.body.classList.toggle('database-mode', viewer);
  document.body.classList.toggle('notes-mode', appMode() === 'notes');
  document.body.classList.toggle('matchprep-mode', appMode() === 'matchprep');
  document.body.classList.toggle('scouting-mode', appMode() === 'scouting');
  document.body.classList.toggle('command-mode', command);
}
const score = r => Number(r.autoFuel || 0) + Number(r.teleFuel || 0) +
  ({None:0,'Level 1':15}[r.autoTower] || 0) +
  ({None:0,'Level 1':10,'Level 2':20,'Level 3':30}[r.teleTower] || 0);

function setActive(page) {
  document.querySelectorAll('.tabs button, .topnav button, .settings-button').forEach(b => b.classList.toggle('active', b.dataset.go === page));
}

async function go(page) {
  if (page === 'scout' && appMode() === 'database') page = 'data';
  if (scanner) { scanner.stop(); scanner.destroy(); scanner = null; }
  if (chart) { chart.destroy(); chart = null; }
  if (page === 'editor' && !adminUnlocked()) {
    toast('Enter the editor password in Settings.', true);
    page = 'settings';
  }
  setActive(page);
  if (page === 'scout') renderScout();
  else if (page === 'events') renderEventCreator();
  else if (page === 'scan') await renderScan();
  else if (page === 'data') await renderData();
  else if (page === 'picklist') await renderPicklist();
  else if (page === 'notes') await renderNotes();
  else if (page === 'matchprep') await renderMatchPrep();
  else if (page === 'compare') await renderCompareRobots();
  else if (page === 'prescout') await renderPreScouting();
  else if (page === 'settings') renderSettings();
  else if (page === 'editor') await renderEditor();
  else await renderHome();
  applyAppMode();
}

async function renderHome() {
  const allRecords = await records();
  let savedEvents = [];
  try { savedEvents = JSON.parse(localStorage.getItem('tiger-saved-events') || '[]'); } catch {}
  const events = [...new Set([...savedEvents, ...allRecords.map(r => r.event || 'Unspecified event')])].sort();
  let selectedEvent = localStorage.getItem('tiger-selected-event') || events[0] || 'all';
  if (selectedEvent !== 'all' && !events.includes(selectedEvent)) selectedEvent = events[0] || 'all';
  const all = selectedEvent === 'all' ? allRecords : allRecords.filter(r => (r.event || 'Unspecified event') === selectedEvent);
  const teamRows = [...new Set(all.map(r => String(r.team)).filter(Boolean))].map(team => {
    const matches = all.filter(r => String(r.team) === team);
    const totalFuel = matches.reduce((sum, r) => sum + Number(r.autoFuel || 0) + Number(r.teleFuel || 0), 0);
    return {
      team,
      fuel: matches.length ? totalFuel / matches.length : 0,
      points: matches.length ? matches.reduce((sum, r) => sum + score(r), 0) / matches.length : 0
    };
  }).sort((a, b) => b.fuel - a.fuel || b.points - a.points);
  const recent = [...all].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 5);
  let schedule = [];
  try { schedule = JSON.parse(localStorage.getItem('tiger-tba-schedule') || '[]'); } catch {}
  const focusTeam = localStorage.getItem('tiger-matchprep-team') || '9072';
  const nextMatch = schedule
    .filter(match => (match.red.includes(focusTeam) || match.blue.includes(focusTeam)) && match.redScore < 0 && match.blueScore < 0)
    .sort((a,b) => a.number-b.number)[0];
  const tigerOfficialMatches = schedule.filter(match =>
    (match.red.includes('9072') || match.blue.includes('9072')) &&
    match.redScore >= 0 && match.blueScore >= 0
  );
  const tigerOfficial = tigerOfficialMatches.reduce((summary, match) => {
    const red = match.red.includes('9072');
    const ours = red ? match.redScore : match.blueScore;
    const theirs = red ? match.blueScore : match.redScore;
    summary.highScore = Math.max(summary.highScore, ours);
    if (ours > theirs) summary.wins++;
    else if (ours < theirs) summary.losses++;
    else summary.ties++;
    return summary;
  }, { wins:0, losses:0, ties:0, highScore:0 });
  const tigerWinRate = tigerOfficialMatches.length
    ? Math.round((tigerOfficial.wins + tigerOfficial.ties * .5) / tigerOfficialMatches.length * 100)
    : 0;
  let tigerSeason = null;
  try { tigerSeason = JSON.parse(localStorage.getItem('tiger-tba-9072-season') || 'null'); } catch {}
  const scheduledTeams = [...new Set(schedule.flatMap(match => [...match.red, ...match.blue]))];
  const coveredTeams = scheduledTeams.length ? scheduledTeams.filter(team => all.some(record => String(record.team) === String(team))).length : teamRows.length;
  const eventRoster = selectedEvent === CRI_EVENT.name ? CRI_EVENT.teams : [];
  const coverageTeams = scheduledTeams.length ? scheduledTeams : eventRoster;
  const coveredTeamsForEvent = coverageTeams.length ? coverageTeams.filter(team => all.some(record => String(record.team).toUpperCase() === String(team).toUpperCase())).length : coveredTeams;
  const coverageTotal = coverageTeams.length || teamRows.length;
  const coveragePercent = coverageTotal ? Math.round(coveredTeamsForEvent / coverageTotal * 100) : 0;
  const syncCursor = Number(localStorage.getItem('tiger-sql-cursor') || 0);
  const unsyncedRecords = allRecords.filter(record => Number(record.createdAt || 0) > syncCursor).length;
  const lastDatabaseSync = localStorage.getItem('tiger-sql-last-sync');
  const tigerRecords = all.filter(record => String(record.team) === '9072').sort((a,b) => Number(a.match)-Number(b.match));
  const tigerPoints = tigerRecords.map(record => score(record));
  const tigerAverage = tigerPoints.length ? tigerPoints.reduce((sum,value)=>sum+value,0)/tigerPoints.length : 0;
  const tigerRank = teamRows.findIndex(team => team.team === '9072') + 1;
  const tigerRecent = tigerPoints.slice(-3);
  const tigerEarlier = tigerPoints.slice(-6,-3);
  const tigerTrendChange = tigerRecent.length && tigerEarlier.length
    ? tigerRecent.reduce((sum,value)=>sum+value,0)/tigerRecent.length - tigerEarlier.reduce((sum,value)=>sum+value,0)/tigerEarlier.length
    : 0;
  let statbotics = null;
  try {
    const cached = JSON.parse(localStorage.getItem('tiger-statbotics-9072') || 'null');
    if (cached?.available && Date.now() - Number(cached.fetchedAt || 0) < 21600000) statbotics = cached;
  } catch {}
  view.innerHTML = `
    <section class="home-dashboard-head">
      <div><p class="eyebrow">EVENT COMMAND CENTER</p><h1>${escapeHtml(selectedEvent === 'all' ? 'All events' : selectedEvent)}</h1><p>Live preview of the scouting data stored on this device.</p></div>
      <div class="home-event-actions">
        <label>Current event<select id="homeEvent"><option value="all" ${selectedEvent==='all'?'selected':''}>All saved events</option>${events.map(event => `<option value="${escapeHtml(event)}" ${selectedEvent===event?'selected':''}>${escapeHtml(event)}</option>`).join('')}</select></label>
        <button class="primary" data-go="scout">Scout a match</button>
      </div>
    </section>
    <section class="cri-briefing ${selectedEvent === CRI_EVENT.name ? 'ready' : ''}">
      <div class="cri-date"><strong>26</strong><span>SEP<br>2026</span></div>
      <div class="cri-briefing-copy"><p class="eyebrow">${selectedEvent === CRI_EVENT.name ? 'CURRENT EVENT · READY' : 'UPCOMING EVENT'}</p><h2>${CRI_EVENT.fullName}</h2><p>${CRI_EVENT.tournamentDate} tournament · ${CRI_EVENT.showcaseDate} community showcase<br>${CRI_EVENT.location}</p></div>
      <div class="cri-briefing-status"><strong>${CRI_EVENT.teams.length}</strong><span>registered robots</span><small>${schedule.length ? `${schedule.length} qualification matches loaded` : 'Official schedule not published yet'}</small></div>
      <button id="prepareCri" class="${selectedEvent === CRI_EVENT.name ? 'secondary' : 'primary'}">${selectedEvent === CRI_EVENT.name ? 'Refresh CRI setup' : 'Prepare this device'}</button>
      <details><summary>Registered team list</summary><div class="cri-team-list">${CRI_EVENT.teams.map(team => `<span class="${team.toUpperCase().startsWith('9072') ? 'ours' : ''}">${escapeHtml(team)}</span>`).join('')}</div></details>
    </section>
    <section class="tiger-spotlight">
      <div class="tiger-spotlight-brand"><img src="team-9072-logo.png" alt=""><div><p class="eyebrow">TEAM 9072 SPOTLIGHT</p><h2>TigerBots</h2><p>${escapeHtml(selectedEvent === 'all' ? 'Across all saved events' : selectedEvent)}</p></div></div>
      ${tigerRecords.length || tigerOfficialMatches.length ? `<div class="tiger-spotlight-metrics">
        <span><strong>${tigerRecords.length ? (tigerRank || '—') : '—'}</strong><small>SCOUT RANK</small></span>
        <span><strong>${tigerRecords.length ? tigerAverage.toFixed(1) : '—'}</strong><small>AVG PTS</small></span>
        <span><strong>${tigerRecords.length ? `${Math.min(...tigerPoints).toFixed(0)}–${Math.max(...tigerPoints).toFixed(0)}` : '—'}</strong><small>POINT RANGE</small></span>
        <span class="${tigerTrendChange>3?'up':tigerTrendChange<-3?'down':'flat'}"><strong>${tigerTrendChange>3?'↗':tigerTrendChange<-3?'↘':'→'}</strong><small>RECENT TREND</small></span>
        <span><strong>${nextMatch ? `Q${nextMatch.number}` : '—'}</strong><small>NEXT MATCH</small></span>
        <span><strong>${tigerOfficialMatches.length ? `${tigerOfficial.wins}-${tigerOfficial.losses}-${tigerOfficial.ties}` : '—'}</strong><small>TBA RECORD</small></span>
        <span><strong>${tigerOfficialMatches.length ? `${tigerWinRate}%` : '—'}</strong><small>WIN RATE</small></span>
        <span><strong>${tigerOfficialMatches.length ? tigerOfficial.highScore : '—'}</strong><small>HIGH SCORE</small></span>
        ${tigerSeason ? `<span><strong>${tigerSeason.wins}-${tigerSeason.losses}-${tigerSeason.ties}</strong><small>2026 RECORD</small></span>
        <span><strong>${tigerSeason.winRate}%</strong><small>SEASON WIN RATE</small></span>` : ''}
        ${statbotics ? `<span><strong>${Number(statbotics.epa).toFixed(1)}</strong><small>STATBOTICS EPA</small></span>
        <span><strong>${statbotics.rank ? `#${escapeHtml(statbotics.rank)}` : '—'}</strong><small>EPA RANK</small></span>` : ''}
      </div>${tigerRecords.length ? '<button id="openTigerProfile">View Team 9072 →</button>' : ''}` : `<div class="tiger-spotlight-empty"><p>No Team 9072 or official TBA records in this event yet.</p><button data-go="scout">Scout 9072 →</button></div>`}
    </section>
    <section class="operations-strip">
      <article>
        <div class="operation-icon">VS</div>
        <div><p class="eyebrow">NEXT MATCH</p>${nextMatch ? `<h2>Qualification ${nextMatch.number}</h2><p>Team ${escapeHtml(focusTeam)} with ${(nextMatch.red.includes(focusTeam)?nextMatch.red:nextMatch.blue).filter(team=>team!==focusTeam).map(team=>`Team ${escapeHtml(team)}`).join(' + ')}</p>` : '<h2>Schedule needed</h2><p>Sync The Blue Alliance to show the next match.</p>'}</div>
        ${nextMatch ? '<button data-go="matchprep">Prepare →</button>' : '<button data-go="settings">Sync →</button>'}
      </article>
      <article>
        <div class="operation-icon coverage">${coveragePercent}%</div>
        <div><p class="eyebrow">SCOUTING COVERAGE</p><h2>${coveredTeamsForEvent} of ${coverageTotal || 0} teams</h2><p>${coverageTotal ? `${Math.max(0,coverageTotal-coveredTeamsForEvent)} teams still need records.` : 'Add a schedule or scouting records to measure coverage.'}</p></div>
        <button data-go="data">Readout →</button>
      </article>
      <article>
        <div class="operation-icon sync">${unsyncedRecords}</div>
        <div><p class="eyebrow">DATABASE STATUS</p><h2>${unsyncedRecords ? `${unsyncedRecords} pending` : 'Up to date'}</h2><p>${lastDatabaseSync ? `Last sync ${escapeHtml(lastDatabaseSync)}` : 'This device has not synced yet.'}</p></div>
        <button data-go="settings">${appMode()==='command'?'Sync →':'Details →'}</button>
      </article>
    </section>
    <section class="event-preview">
      <article class="event-leaders">
        <div class="panel-heading"><div><p class="eyebrow">FUEL LEADERS</p><h2>Top teams</h2></div><button data-go="picklist">Picklist →</button></div>
        ${teamRows.length ? `<div class="leader-list">${teamRows.slice(0, 5).map((team, index) => `<button data-team-preview="${escapeHtml(team.team)}"><b>${index + 1}</b><strong>Team ${escapeHtml(team.team)}</strong><span>${team.fuel.toFixed(1)} fuel/match</span></button>`).join('')}</div>` : '<p class="dashboard-empty">No records in this event yet.</p>'}
      </article>
      <article class="recent-scouting">
        <div class="panel-heading"><div><p class="eyebrow">LATEST ACTIVITY</p><h2>Recent scouting</h2></div><button data-go="scan">Scan QR →</button></div>
        ${recent.length ? `<div class="recent-list">${recent.map(record => `<div><strong>Team ${escapeHtml(record.team)}</strong><span>Match ${escapeHtml(record.match || '—')}</span><b>${Number(record.autoFuel || 0) + Number(record.teleFuel || 0)} fuel</b></div>`).join('')}</div>` : '<p class="dashboard-empty">Scout or scan a match to begin the event feed.</p>'}
      </article>
    </section>`;
  document.querySelector('#homeEvent').onchange = event => {
    localStorage.setItem('tiger-selected-event', event.target.value);
    renderHome();
  };
  document.querySelector('#prepareCri').onclick = () => {
    prepareCriDevice();
    renderHome();
  };
  document.querySelector('#openTigerProfile')?.addEventListener('click', () => showTeam('9072', tigerRecords));
  document.querySelectorAll('[data-team-preview]').forEach(button => button.onclick = () => {
    const team = button.dataset.teamPreview;
    showTeam(team, all.filter(record => String(record.team) === String(team)));
  });
}

const MAX_FUEL_RATE = 15;
const FUEL_BALL_TRAVEL_SECONDS = 1.2;
const MAX_VISUAL_FUEL_BALLS = Math.ceil(MAX_FUEL_RATE * FUEL_BALL_TRAVEL_SECONDS);
const fuelRateValue = value => Math.min(MAX_FUEL_RATE, Math.max(0, Math.round((Number(value) || 0) * 2) / 2));
const fuelSecondsValue = value => Math.min(180, Math.max(0, Math.round((Number(value) || 0) * 10) / 10));
const visualFuelBallCount = rate => rate > 0 ? Math.max(1, Math.round(fuelRateValue(rate) * FUEL_BALL_TRAVEL_SECONDS)) : 0;
const fuelBallDelay = (index, count) => count ? -index * FUEL_BALL_TRAVEL_SECONDS / count : 0;
const fuelBallPosition = (index, count) => count ? index * 100 / count : 0;
function updateFuelEstimate(record, phase) {
  record[`${phase}FuelRate`] = fuelRateValue(record[`${phase}FuelRate`]);
  record[`${phase}FuelSeconds`] = fuelSecondsValue(record[`${phase}FuelSeconds`]);
  record[`${phase}Fuel`] = Math.round(record[`${phase}FuelRate`] * record[`${phase}FuelSeconds`]);
}

function fuelFlowControl(phase, label) {
  const rate = fuelRateValue(draft[`${phase}FuelRate`]);
  const seconds = fuelSecondsValue(draft[`${phase}FuelSeconds`]);
  const ballCount = visualFuelBallCount(rate);
  return `<section class="fuel-flow" data-fuel-phase="${phase}" style="--flow-fill:${rate / MAX_FUEL_RATE * 100}%" data-stopped="${rate === 0}">
    <div class="fuel-flow-heading"><label for="${phase}FuelRate">${label}<small>Scored FUEL flow rate</small></label><output id="${phase}FuelRateValue" for="${phase}FuelRate">${rate} <small>BSP</small></output></div>
    <p id="${phase}FlowHelp" class="fuel-flow-help">BSP = balls per second. Ball speed stays constant; tighter spacing represents a higher scoring rate.</p>
    <div class="fuel-flow-preview" aria-hidden="true"><span class="flow-robot">ROBOT</span><div class="fuel-stream${ballCount ? ' fuel-stream-running' : ''}">${Array.from({length:MAX_VISUAL_FUEL_BALLS}, (_, index) => `<i style="--ball-delay:${fuelBallDelay(index, ballCount)}s;--ball-position:${fuelBallPosition(index, ballCount)}%"${index < ballCount ? '' : ' hidden'}></i>`).join('')}</div><span class="flow-hub">HUB</span></div>
    <input class="fuel-flow-slider" id="${phase}FuelRate" name="${phase}FuelRate" type="range" min="0" max="${MAX_FUEL_RATE}" step="0.5" value="${rate}" aria-describedby="${phase}FlowHelp" aria-valuetext="${rate} balls per second">
    <div class="fuel-flow-scale" aria-hidden="true"><span>0 BSP</span><span>5</span><span>10</span><span>15 BSP</span></div>
    <div class="fuel-flow-total"><label for="${phase}FuelSeconds">Seconds scoring<input id="${phase}FuelSeconds" name="${phase}FuelSeconds" type="number" inputmode="decimal" min="0" max="180" step="0.1" value="${seconds}" ${rate > 0 ? 'required' : ''} aria-describedby="${phase}TotalHelp"></label><div><span>Estimated FUEL scored</span><output id="${phase}FuelEstimate" for="${phase}FuelRate ${phase}FuelSeconds">${Math.round(rate * seconds)}</output></div></div>
    <p id="${phase}TotalHelp" class="fuel-flow-help">Rate × total seconds scoring in this phase. Count only time scoring in an active HUB. The estimate feeds your score graphs.</p>
  </section>`;
}

function fuelEditorCell(record, phase) {
  const hasRate = record[`${phase}FuelRate`] != null;
  return `<input data-field="${phase}Fuel" type="number" min="0" value="${Number(record[`${phase}Fuel`] || 0)}" ${hasRate ? 'readonly aria-label="Estimated FUEL scored"' : 'aria-label="FUEL scored"'}>${hasRate ? `<div class="editor-fuel-details"><label>BSP<input data-field="${phase}FuelRate" type="number" min="0" max="${MAX_FUEL_RATE}" step="0.5" required value="${fuelRateValue(record[`${phase}FuelRate`])}"></label><label>Seconds<input data-field="${phase}FuelSeconds" type="number" min="0" max="180" step="0.1" required value="${fuelSecondsValue(record[`${phase}FuelSeconds`])}"></label></div>` : ''}`;
}

function fuelMatchReadout(record, phase, label) {
  const hasRate = record[`${phase}FuelRate`] != null;
  return `<dt>${label} FUEL</dt><dd>${Number(record[`${phase}Fuel`] || 0)}${hasRate ? ' (est.)' : ''}</dd>${hasRate ? `<dt>${label} flow rate</dt><dd>${fuelRateValue(record[`${phase}FuelRate`])} BSP</dd><dt>${label} seconds scoring</dt><dd>${fuelSecondsValue(record[`${phase}FuelSeconds`])} s</dd>` : ''}`;
}

function updateFuelFlowControl(phase) {
  const control = document.querySelector(`[data-fuel-phase="${phase}"]`);
  const rateInput = control.querySelector(`[name="${phase}FuelRate"]`);
  const secondsInput = control.querySelector(`[name="${phase}FuelSeconds"]`);
  draft[`${phase}FuelRate`] = rateInput.value;
  draft[`${phase}FuelSeconds`] = secondsInput.value;
  updateFuelEstimate(draft, phase);
  const rate = draft[`${phase}FuelRate`];
  const ballCount = visualFuelBallCount(rate);
  const stream = control.querySelector('.fuel-stream');
  stream.classList.remove('fuel-stream-running');
  control.style.setProperty('--flow-fill', `${rate / MAX_FUEL_RATE * 100}%`);
  control.dataset.stopped = String(rate === 0);
  control.querySelectorAll('.fuel-stream i').forEach((ball, index) => {
    ball.hidden = index >= ballCount;
    ball.style.setProperty('--ball-delay', `${fuelBallDelay(index, ballCount)}s`);
    ball.style.setProperty('--ball-position', `${fuelBallPosition(index, ballCount)}%`);
  });
  // Restart the stream as one group so every rate change keeps equal intervals.
  void stream.offsetWidth;
  if (ballCount) stream.classList.add('fuel-stream-running');
  control.querySelector(`#${phase}FuelRateValue`).innerHTML = `${rate} <small>BSP</small>`;
  control.querySelector(`#${phase}FuelEstimate`).value = draft[`${phase}Fuel`];
  rateInput.setAttribute('aria-valuetext', `${rate} balls per second`);
  secondsInput.required = rate > 0;
  secondsInput.setCustomValidity(rate > 0 && Number(secondsInput.value) <= 0 ? 'Enter the total seconds spent scoring for this flow rate.' : '');
}

function eventConfigs() {
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem('tiger-event-configs') || '[]'); } catch {}
  const cri = {
    id: CRI_EVENT.id, name: CRI_EVENT.name, fullName: CRI_EVENT.fullName,
    eventKey: CRI_EVENT.tbaKey, year: CRI_EVENT.year,
    date: `${CRI_EVENT.tournamentDate} / ${CRI_EVENT.showcaseDate}`,
    location: CRI_EVENT.location, teams: CRI_EVENT.teams
  };
  const saved = Array.isArray(stored) ? stored.filter(event => event?.name) : [];
  const savedCri = saved.find(event => event.name === CRI_EVENT.name);
  return [savedCri || cri, ...saved.filter(event => event.name !== CRI_EVENT.name)];
}

function savedEventNames() {
  let names = [];
  try { names = JSON.parse(localStorage.getItem('tiger-saved-events') || '[]'); } catch {}
  return [...new Set([...eventConfigs().map(event => event.name), ...names].filter(Boolean))].sort();
}

function saveEventConfig(config) {
  const normalized = {
    ...config,
    id: config.id || `event-${makeId()}`,
    name: String(config.name || '').trim(),
    fullName: String(config.fullName || config.name || '').trim(),
    eventKey: String(config.eventKey || '').trim().toLowerCase(),
    year: String(config.year || new Date().getFullYear()),
    date: String(config.date || '').trim(),
    location: String(config.location || '').trim(),
    teams: [...new Set((config.teams || []).map(String).filter(team => /^\d+$/.test(team) && Number(team) > 0))].sort((a, b) => Number(a) - Number(b)),
    createdAt: Number(config.createdAt) || Date.now()
  };
  if (!normalized.name || !normalized.teams.length) throw new Error('Event name and teams are required');
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem('tiger-event-configs') || '[]'); } catch {}
  stored = [normalized, ...(Array.isArray(stored) ? stored : []).filter(event => event.id !== normalized.id && event.name !== normalized.name)];
  localStorage.setItem('tiger-event-configs', JSON.stringify(stored));
  let rosters = {};
  try { rosters = JSON.parse(localStorage.getItem('tiger-event-rosters') || '{}'); } catch {}
  rosters[normalized.name] = normalized.teams;
  localStorage.setItem('tiger-event-rosters', JSON.stringify(rosters));
  localStorage.setItem('tiger-saved-events', JSON.stringify([...new Set([...savedEventNames(), normalized.name])].sort()));
  return normalized;
}

function eventSetupPayload(config) {
  return `EVT1:${btoa(unescape(encodeURIComponent(JSON.stringify(config))))}`;
}

function decodeEventSetupPayload(payload) {
  if (!payload.startsWith('EVT1:')) throw new Error('Not an event setup');
  const config = JSON.parse(decodeURIComponent(escape(atob(payload.slice(5)))));
  if (!config?.name || !Array.isArray(config.teams)) throw new Error('Invalid event setup');
  return config;
}

function activateEvent(config) {
  localStorage.setItem('tiger-selected-event', config.name);
  localStorage.setItem('tiger-last-scout-event', config.name);
  if (config.eventKey) localStorage.setItem('tiger-tba-event', config.eventKey);
  if (config.year) localStorage.setItem('tiger-tba-year', config.year);
  draft.event = config.name;
}

function showEventSetupQr(config) {
  const panel = document.querySelector('#eventSetupQrPanel');
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = `<div><p class="eyebrow">EVENT SETUP QR</p><h2>${escapeHtml(config.name)}</h2><p>Scan this on each device's Events tab to select the event and preload ${config.teams.length} team numbers.</p></div><div class="qr-wrap"><div data-event-qr></div></div>`;
  new QRCode(panel.querySelector('[data-event-qr]'), {
    text: eventSetupPayload(config), width: 300, height: 300,
    colorDark: '#090807', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M
  });
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function importEventSetupPayload(payload) {
  try {
    const config = saveEventConfig(decodeEventSetupPayload(payload));
    activateEvent(config);
    if (scanner) { await scanner.stop(); scanner.destroy(); scanner = null; }
    toast(`${config.name} is ready with ${config.teams.length} teams.`);
    setTimeout(() => go('scout'), 650);
  } catch { toast('That is not a valid Tiger Scout event setup.', true); }
}

function renderEventCreator() {
  const configs = eventConfigs();
  const selectedName = localStorage.getItem('tiger-selected-event') || configs[0]?.name || '';
  const selected = configs.find(event => event.name === selectedName) || configs[0];
  view.innerHTML = `
    <section class="pagehead event-head"><p class="eyebrow">EVENT SETUP</p><h1>Create or join an event</h1><p>Build one event QR, then scan it on every scouting device to preload the same event and team roster.</p></section>
    <section class="event-creator-grid">
      <form id="eventCreatorForm" class="event-create-card">
        <p class="eyebrow">CREATE EVENT</p><h2>Event details</h2>
        <div class="grid"><label>Event name<input name="name" required value="${escapeHtml(selected?.name || '')}" placeholder="e.g. CRI 2026"></label><label>Season<input name="year" type="number" min="2026" max="2099" step="1" required value="${escapeHtml(selected?.year || '2026')}"></label><label>Event key<input name="eventKey" value="${escapeHtml(selected?.eventKey || '')}" placeholder="Optional TBA key"></label><label>Date<input name="date" value="${escapeHtml(selected?.date || '')}" placeholder="Event date"></label></div>
        <label>Location<input name="location" value="${escapeHtml(selected?.location || '')}" placeholder="Venue or city"></label>
        <label>Team numbers<textarea name="teams" rows="7" required placeholder="One per line, or separated by commas">${escapeHtml((selected?.teams || []).join('\n'))}</textarea><small>Numbers only. Duplicate team numbers are removed automatically.</small></label>
        <button class="primary wide" type="submit">Save event & create QR</button>
      </form>
      <section class="event-join-card">
        <p class="eyebrow">JOIN EVENT</p><h2>Scan an event setup</h2><p>Use the camera or a screenshot from the event lead. Scanning immediately selects the event and preloads its team list.</p>
        <div id="eventReader"><video playsinline muted></video><div class="scan-frame"></div></div>
        <button id="startEventScan" class="primary">Start camera</button>
        <label class="upload">Scan from screenshot<input id="eventQrFile" type="file" accept="image/*"></label>
        <details><summary>Camera unavailable? Paste event payload</summary><textarea id="eventPayload" rows="4"></textarea><button id="importEventText" class="secondary">Import event</button></details>
      </section>
    </section>
    <section id="eventSetupQrPanel" class="event-qr-panel" hidden></section>
    <section class="saved-event-card"><div><p class="eyebrow">SAVED EVENTS</p><h2>${configs.length} event setup${configs.length === 1 ? '' : 's'}</h2></div><div class="saved-event-list">${configs.map(config => `<article><div><strong>${escapeHtml(config.name)}</strong><span>${config.teams.length} teams${config.location ? ` · ${escapeHtml(config.location)}` : ''}</span></div><div><button class="secondary" data-use-event="${escapeHtml(config.id)}">Use event</button><button class="secondary" data-share-event="${escapeHtml(config.id)}">Show QR</button></div></article>`).join('')}</div></section>`;
  document.querySelector('#eventCreatorForm').onsubmit = event => {
    event.preventDefault();
    const fd = new FormData(event.target);
    const rawTeams = String(fd.get('teams') || '').split(/[\s,]+/).filter(Boolean);
    if (!rawTeams.length || rawTeams.some(team => !/^\d+$/.test(team) || Number(team) < 1)) return toast('Enter valid numeric team numbers only.', true);
    try {
      const config = saveEventConfig({
        name: fd.get('name'), fullName: fd.get('name'), year: fd.get('year'), eventKey: fd.get('eventKey'),
        date: fd.get('date'), location: fd.get('location'), teams: rawTeams
      });
      activateEvent(config);
      showEventSetupQr(config);
      toast(`${config.name} saved and selected.`);
    } catch { toast('Event name and at least one team are required.', true); }
  };
  const video = document.querySelector('#eventReader video');
  document.querySelector('#startEventScan').onclick = async () => {
    try {
      scanner = new QrScanner(video, result => importEventSetupPayload(result.data), { highlightScanRegion: true, returnDetailedScanResult: true });
      await scanner.start();
      document.querySelector('#startEventScan').hidden = true;
    } catch { toast('Camera could not start. Try a screenshot instead.', true); }
  };
  document.querySelector('#eventQrFile').onchange = async event => {
    try { await importEventSetupPayload(await QrScanner.scanImage(event.target.files[0])); }
    catch { toast('No event QR code was found in that image.', true); }
  };
  document.querySelector('#importEventText').onclick = () => importEventSetupPayload(document.querySelector('#eventPayload').value.trim());
  document.querySelectorAll('[data-use-event]').forEach(button => button.onclick = () => {
    const config = configs.find(event => event.id === button.dataset.useEvent);
    if (!config) return;
    activateEvent(config); toast(`${config.name} selected.`); go('scout');
  });
  document.querySelectorAll('[data-share-event]').forEach(button => button.onclick = () => {
    const config = configs.find(event => event.id === button.dataset.shareEvent);
    if (config) showEventSetupQr(config);
  });
}

function renderScout() {
  const selectedEvent = localStorage.getItem('tiger-selected-event') || 'all';
  const lastScoutEvent = localStorage.getItem('tiger-last-scout-event') || '';
  if (selectedEvent !== 'all') draft.event = selectedEvent;
  else if (!draft.event) draft.event = lastScoutEvent;
  const events = savedEventNames();
  if (!events.includes(draft.event)) draft.event = events.includes(selectedEvent) ? selectedEvent : events[0] || '';
  let rosters = {};
  try { rosters = JSON.parse(localStorage.getItem('tiger-event-rosters') || '{}'); } catch {}
  const roster = rosters[draft.event] || eventConfigs().find(event => event.name === draft.event)?.teams || [];
  view.innerHTML = `
    <section class="pagehead"><p class="eyebrow">NEW RECORD</p><h1>Match scouting</h1><p>Complete the card, save it locally, then show its QR to your collector.</p></section>
    <form id="scoutForm" class="form-card">
      <fieldset><legend>Match setup</legend>
        <div class="grid">
          <label>Event<select name="event" required>${events.map(event => `<option value="${escapeHtml(event)}" ${draft.event===event?'selected':''}>${escapeHtml(event)}</option>`).join('')}</select><small>Create or join events from the Events tab.</small></label>
          <label>Match #<input name="match" type="number" inputmode="numeric" min="1" step="1" required value="${escapeHtml(draft.match)}"></label>
          <label>Team #<input name="team" type="number" inputmode="numeric" min="1" step="1" list="scoutEventTeams" required value="${escapeHtml(draft.team)}"><datalist id="scoutEventTeams">${roster.map(team => `<option value="${escapeHtml(team)}"></option>`).join('')}</datalist></label>
          <label>Scout name<input name="scout" required autocomplete="name" value="${escapeHtml(draft.scout)}" placeholder="Required"></label>
        </div>
        <div class="segmented">
          <label><input type="radio" name="alliance" value="red" ${draft.alliance==='red'?'checked':''}><span>Red alliance</span></label>
          <label><input type="radio" name="alliance" value="blue" ${draft.alliance==='blue'?'checked':''}><span>Blue alliance</span></label>
        </div>
      </fieldset>
      <fieldset><legend>Autonomous</legend>
        ${fuelFlowControl('auto','Autonomous FUEL')}
        <label>Autonomous TOWER<select name="autoTower">${['None','Level 1'].map(x=>`<option ${draft.autoTower===x?'selected':''}>${x}</option>`).join('')}</select><small>Level 1 is worth 15 points in AUTO</small></label>
      </fieldset>
      <fieldset><legend>Teleoperated</legend>
        ${fuelFlowControl('tele','Teleop FUEL')}
        <label>Endgame TOWER<select name="teleTower">${['None','Level 1','Level 2','Level 3'].map(x=>`<option ${draft.teleTower===x?'selected':''}>${x}</option>`).join('')}</select></label>
        <div class="capabilities">
          <label class="check"><input name="groundIntake" type="checkbox" ${draft.groundIntake?'checked':''}><span>Ground intake</span></label>
          <label class="check"><input name="trench" type="checkbox" ${draft.trench?'checked':''}><span>Uses TRENCH</span></label>
          <label class="check"><input name="bump" type="checkbox" ${draft.bump?'checked':''}><span>Crosses BUMP</span></label>
        </div>
        <label>Defense rating<input name="defense" type="range" min="0" max="5" value="${draft.defense}"><small>0 = none · 5 = elite</small></label>
      </fieldset>
      <fieldset><legend>Endgame & notes</legend>
        <div class="grid">
          <label>Fouls observed<input name="fouls" type="number" min="0" value="${draft.fouls}"></label>
          <label class="check"><input name="broke" type="checkbox" ${draft.broke?'checked':''}><span>Robot disabled / broke</span></label>
          <label class="check"><input name="playedDefense" type="checkbox" ${draft.playedDefense?'checked':''}><span>Played defense</span></label>
        </div>
        <label>Notes<textarea name="notes" rows="3" maxlength="240" placeholder="Speed, consistency, driver skill…">${escapeHtml(draft.notes)}</textarea></label>
      </fieldset>
      <button class="primary wide" type="submit">Save & create QR <b>→</b></button>
    </form>`;

  document.querySelectorAll('[data-fuel-phase]').forEach(control => {
    control.querySelectorAll('input').forEach(input => input.addEventListener('input', () => updateFuelFlowControl(control.dataset.fuelPhase)));
    updateFuelFlowControl(control.dataset.fuelPhase);
  });
  document.querySelector('#scoutForm').addEventListener('input', event => {
    const input = event.target;
    if (input.name && !/^(auto|tele)Fuel/.test(input.name)) draft[input.name] = input.type === 'checkbox' ? input.checked : input.value;
  });
  document.querySelector('[name="event"]').addEventListener('change', event => {
    localStorage.setItem('tiger-selected-event', event.target.value);
    localStorage.setItem('tiger-last-scout-event', event.target.value);
    draft.event = event.target.value;
    draft.team = '';
    renderScout();
  });
  document.querySelector('#scoutForm').onsubmit = saveScout;
}

async function saveScout(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  ['event','match','team','scout','alliance','autoTower','teleTower','notes'].forEach(k => draft[k] = fd.get(k) || '');
  draft.scout = draft.scout.trim();
  if (!draft.scout) {
    toast('Scout name is required.', true);
    e.target.elements.scout.focus();
    return;
  }
  draft.match = String(draft.match).trim();
  draft.team = String(draft.team).trim();
  if (!/^\d+$/.test(draft.match) || Number(draft.match) < 1) {
    toast('Match number must be a positive whole number.', true);
    e.target.elements.match.focus();
    return;
  }
  if (!/^\d+$/.test(draft.team) || Number(draft.team) < 1) {
    toast('Team number must be a positive whole number.', true);
    e.target.elements.team.focus();
    return;
  }
  draft.event = draft.event.trim();
  if (draft.event) localStorage.setItem('tiger-last-scout-event', draft.event);
  draft.defense = Number(fd.get('defense'));
  draft.fouls = Number(fd.get('fouls'));
  draft.groundIntake = fd.has('groundIntake');
  draft.trench = fd.has('trench');
  draft.bump = fd.has('bump');
  draft.broke = fd.has('broke');
  draft.playedDefense = fd.has('playedDefense');
  for (const phase of ['auto', 'tele']) {
    draft[`${phase}FuelRate`] = fd.get(`${phase}FuelRate`);
    draft[`${phase}FuelSeconds`] = fd.get(`${phase}FuelSeconds`);
    updateFuelEstimate(draft, phase);
    if (draft[`${phase}FuelRate`] > 0 && draft[`${phase}FuelSeconds`] === 0) {
      toast('Enter seconds spent scoring for each nonzero flow rate.', true);
      e.target.elements[`${phase}FuelSeconds`].focus();
      return;
    }
  }
  await (await dbPromise).put('records', draft);
  const saved = {...draft};
  draft = {...blank(), event: draft.event, scout: draft.scout};
  await renderQr(saved);
}

async function renderQr(record) {
  setActive('scout');
  view.innerHTML = `
    <section class="qr-page">
      <p class="eyebrow">RECORD SAVED</p><h1>Team ${escapeHtml(record.team)} · Match ${escapeHtml(record.match)}</h1>
      <p>Have the collector scan this code. The record remains stored on this phone too.</p>
      <div class="qr-wrap"><div id="qr"></div></div>
      <div class="receipt"><span>Estimated points <b>${score(record)}</b></span><span>Record ID <b>${record.id.slice(0,8)}</b></span></div>
      <button class="primary" data-go="scout">Scout next match <b>→</b></button>
      <button class="secondary" data-go="data">View dataset</button>
    </section>`;
  const payload = `PL1:${btoa(unescape(encodeURIComponent(JSON.stringify(record))))}`;
  new QRCode(document.querySelector('#qr'), {
    text: payload, width: 300, height: 300,
    colorDark: '#090807', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

async function renderScan() {
  const localRecords = await records();
  view.innerHTML = `
    <section class="pagehead"><p class="eyebrow">COLLECTOR MODE</p><h1>Scan a Tiger Scout QR</h1><p>Collect a scouting record, every code in a Match Prep data packet, or a full-device backup. Duplicate records are ignored automatically.</p></section>
    <section class="scanner-card">
      <div id="reader"><video playsinline muted></video><div class="scan-frame"></div></div>
      <button id="startScan" class="primary">Start camera</button>
      <label class="upload">Or scan from a screenshot<input id="qrFile" type="file" accept="image/*"></label>
      <details><summary>Camera unavailable? Paste payload</summary><textarea id="payload" rows="4"></textarea><button id="importText" class="secondary">Import text</button></details>
      <section class="device-backup">
        <p class="eyebrow">OFFLINE BACKUP</p>
        <h2>Sync to another device</h2>
        <p>Show a sequence of backup QR codes to another Tiger Scout app. The receiving device scans every part here and merges the records automatically.</p>
        <button id="createBackupQr" class="secondary" ${localRecords.length ? '' : 'disabled'}>Create backup QR sequence (${localRecords.length})</button>
        <div id="backupQrPanel" hidden></div>
      </section>
    </section>`;
  const video = document.querySelector('#reader video');
  document.querySelector('#startScan').onclick = async () => {
    try {
      scanner = new QrScanner(video, result => importPayload(result.data), { highlightScanRegion: true, returnDetailedScanResult: true });
      await scanner.start();
      document.querySelector('#startScan').hidden = true;
    } catch (err) { toast('Camera could not start. Try a screenshot instead.', true); }
  };
  document.querySelector('#qrFile').onchange = async e => {
    try { const result = await QrScanner.scanImage(e.target.files[0]); await importPayload(result); }
    catch { toast('No QR code found in that image.', true); }
  };
  document.querySelector('#importText').onclick = () => importPayload(document.querySelector('#payload').value.trim());
  document.querySelector('#createBackupQr').onclick = () => showBackupQrSequence(localRecords);
}

async function importPayload(payload) {
  try {
    if (payload.startsWith('TSB1:') || payload.startsWith('TSB2:')) return importBackupChunk(payload);
    if (payload.startsWith('TMP2J:') || payload.startsWith('TMP2G:')) return importMatchPrepPacketChunk(payload);
    if (payload.startsWith('TMP1:')) return importMatchPrepPayload(payload);
    if (payload.startsWith('EVT1:')) return importEventSetupPayload(payload);
    if (!payload.startsWith('PL1:')) throw new Error();
    const record = JSON.parse(decodeURIComponent(escape(atob(payload.slice(4)))));
    if (!record.id || !record.team || !record.match) throw new Error();
    const db = await dbPromise;
    if (await db.get('records', record.id)) return toast('Already collected — duplicate skipped.');
    await db.put('records', record);
    toast(`Team ${record.team}, match ${record.match} collected!`);
    setTimeout(() => go('data'), 700);
  } catch { toast('That is not a valid Tiger Scout record.', true); }
}

async function showBackupQrSequence(allRecords) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(allRecords));
  let version = 'TSB1';
  let backupBytes = jsonBytes;
  if ('CompressionStream' in window) {
    const stream = new Blob([jsonBytes]).stream().pipeThrough(new CompressionStream('gzip'));
    backupBytes = new Uint8Array(await new Response(stream).arrayBuffer());
    version = 'TSB2';
  }
  let binary = '';
  for (let i = 0; i < backupBytes.length; i += 0x8000) {
    binary += String.fromCharCode(...backupBytes.subarray(i, i + 0x8000));
  }
  const encoded = btoa(binary);
  const parts = encoded.match(/.{1,1600}/g) || [''];
  const session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
  let index = 0;
  const panel = document.querySelector('#backupQrPanel');
  panel.hidden = false;
  const draw = () => {
    panel.innerHTML = `
      <div class="backup-qr-head"><b>Backup QR ${index + 1} of ${parts.length}</b><span>${allRecords.length} records</span></div>
      <div class="qr-wrap"><div id="backupQr"></div></div>
      <p>Scan every code on the receiving device. Progress is saved if scanning is interrupted.</p>
      <div class="backup-qr-actions">
        <button id="backupPrev" class="secondary" ${index === 0 ? 'disabled' : ''}>Previous</button>
        <button id="backupNext" class="primary">${index === parts.length - 1 ? 'Start over' : 'Next code'}</button>
      </div>`;
    new QRCode(document.querySelector('#backupQr'), {
      text: `${version}:${session}:${index}:${parts.length}:${parts[index]}`,
      width: 280, height: 280, colorDark: '#090807', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.L
    });
    document.querySelector('#backupPrev').onclick = () => { index--; draw(); };
    document.querySelector('#backupNext').onclick = () => { index = index === parts.length - 1 ? 0 : index + 1; draw(); };
  };
  draw();
}

async function importBackupChunk(payload) {
  try {
    const match = payload.match(/^(TSB[12]):([^:]+):(\d+):(\d+):(.+)$/);
    if (!match) throw new Error();
    const [, version, session, indexText, totalText, data] = match;
    const index = Number(indexText);
    const total = Number(totalText);
    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total || total > 1000) throw new Error();
    const key = `tiger-backup-${session}`;
    const state = JSON.parse(localStorage.getItem(key) || `{"version":"${version}","total":${total},"parts":{}}`);
    if (state.total !== total || state.version !== version) throw new Error();
    state.parts[index] = data;
    localStorage.setItem(key, JSON.stringify(state));
    const received = Object.keys(state.parts).length;
    if (received < total) return toast(`Backup part ${index + 1} saved — ${received} of ${total}.`);
    const joined = Array.from({length: total}, (_, i) => state.parts[i]).join('');
    const binary = atob(joined);
    let bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    if (version === 'TSB2') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    const incoming = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(incoming)) throw new Error();
    const db = await dbPromise;
    let added = 0;
    for (const record of incoming) {
      if (!record?.id || !record?.team || !record?.match || await db.get('records', record.id)) continue;
      await db.put('records', record);
      added++;
    }
    localStorage.removeItem(key);
    toast(`Backup complete — ${added} new records synced.`);
    setTimeout(() => go('data'), 900);
  } catch {
    toast('That backup QR part is invalid.', true);
  }
}

async function renderData() {
  const allRecords = await records();
  const logos = await teamLogoMap();
  let savedEvents = [];
  try { savedEvents = JSON.parse(localStorage.getItem('tiger-saved-events') || '[]'); } catch {}
  const events = [...new Set([...savedEvents, ...allRecords.map(r => r.event || 'Unspecified event')])].sort();
  let selectedEvent = localStorage.getItem('tiger-selected-event') || 'all';
  if (selectedEvent !== 'all' && !events.includes(selectedEvent)) selectedEvent = 'all';
  const all = selectedEvent === 'all' ? allRecords : allRecords.filter(r => (r.event || 'Unspecified event') === selectedEvent);
  const grouped = {};
  all.forEach(r => {
    grouped[r.team] ||= [];
    grouped[r.team].push(r);
  });
  const ranking = Object.entries(grouped).map(([team, rs]) => {
    const scores = rs.map(score);
    const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const variance = Math.sqrt(scores.reduce((sum, value) => sum + (value - avg) ** 2, 0) / scores.length);
    const peakBsp = Math.max(0, ...rs.map(record => Math.max(Number(record.autoFuelRate || 0), Number(record.teleFuelRate || 0))));
    return { team, matches: rs.length, avg, variance, peakBsp };
  }).sort((a,b)=>b.avg-a.avg);

  view.innerHTML = `
    <section class="data-head"><div><p class="eyebrow">DATA READOUT</p><h1>${all.length} records. ${ranking.length} teams.</h1><label class="event-select">Viewing event<select id="datasetEvent"><option value="all">All saved events</option>${events.map(event=>`<option value="${escapeHtml(event)}" ${selectedEvent===event?'selected':''}>${escapeHtml(event)}</option>`).join('')}<option value="__create__">＋ Create new event…</option></select></label></div>
      <div><button id="demoData" class="demo-button">Load demo event</button><button id="exportCsv" class="secondary" ${all.length?'':'disabled'}>Export CSV</button><label class="secondary file">Import JSON<input id="importJson" type="file" accept=".json"></label></div>
    </section>
    ${all.length ? `
      <section class="table-card"><div class="table-title"><h2>Team rankings</h2><small>Tap a team for match history</small></div>
        <div class="table-scroll"><table><thead><tr><th>Rank</th><th>Team</th><th>Matches</th><th>Peak BSP</th><th>Avg pts</th></tr></thead>
        <tbody>${ranking.map((x,i)=>`<tr data-team="${escapeHtml(x.team)}"><td>${i+1}</td><td>${teamIdentity(x.team, logos)}</td><td>${x.matches}</td><td><strong>${x.peakBsp.toFixed(1)}</strong></td><td>${x.avg.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <section class="chart-card"><div class="table-title"><h2>Score variance</h2><small>Standard deviation in points · lower is more predictable</small></div><div class="chartbox"><canvas id="chart"></canvas></div></section>
      <section class="backup"><button id="backupJson">Download full backup</button><button id="clearData">Clear all local data</button></section>`
      : `<section class="empty"><span>⌗</span><h2>No records yet</h2><p>Scout a match, scan your crew's records, or load a complete simulated REBUILT event.</p><button class="primary" data-go="scan">Scan first record</button><button id="emptyDemoData" class="demo-button">Load 360 test records</button></section>`}`;

  if (all.length) {
    if (document.querySelector('#chart')) chart = new Chart(document.querySelector('#chart'), {
      type: 'bar',
      data: { labels: ranking.slice(0,12).map(x=>x.team), datasets:[{data:ranking.slice(0,12).map(x=>Number(x.variance.toFixed(2))), backgroundColor:'#d9823f', borderRadius:6}] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{callbacks:{label:context=>`${context.parsed.y.toFixed(1)} pts standard deviation`}}}, scales:{x:{grid:{display:false},ticks:{color:'#9cb0bb'}},y:{beginAtZero:true,title:{display:true,text:'Points of variation',color:'#9cb0bb'},ticks:{color:'#9cb0bb'},grid:{color:'#193040'}}} }
    });
    document.querySelectorAll('[data-team]').forEach(row => row.onclick = () => showTeam(row.dataset.team, grouped[row.dataset.team]));
    document.querySelector('#exportCsv').onclick = () => downloadCsv(all);
    document.querySelector('#backupJson').onclick = () => download('tiger-scout-backup.json', JSON.stringify(all,null,2), 'application/json');
    document.querySelector('#clearData').onclick = async () => { if(confirm('Delete every local scouting record?')) { await (await dbPromise).clear('records'); go('data'); } };
  }
  document.querySelector('#demoData').onclick = generateDemoData;
  if (document.querySelector('#emptyDemoData')) document.querySelector('#emptyDemoData').onclick = generateDemoData;
  document.querySelector('#datasetEvent').onchange = event => {
    if (event.target.value === '__create__') return go('events');
    localStorage.setItem('tiger-selected-event', event.target.value);
    renderData();
  };
  document.querySelector('#importJson').onchange = importJson;
}

function tbaSettings() {
  return {
    apiKey: localStorage.getItem('tiger-tba-key') || '',
    eventKey: localStorage.getItem('tiger-tba-event') || '',
    year: localStorage.getItem('tiger-tba-year') || '2026'
  };
}

function tbaSeasonStatusText() {
  try {
    const season = JSON.parse(localStorage.getItem('tiger-tba-9072-season') || 'null');
    if (season) return `${season.wins}-${season.losses}-${season.ties} • ${season.winRate}% win rate • ${season.matches} matches`;
  } catch {}
  return 'Team 9072 season record has not been pulled yet.';
}

async function syncTbaSeasonRecord() {
  const status = document.querySelector('#tbaSeasonStatus') || { textContent:'', className:'' };
  const settings = tbaSettings();
  if (!settings.apiKey) {
    status.textContent = 'Enter and save a TBA API key first.';
    status.className = 'sync-status error';
    return;
  }
  status.textContent = 'Downloading Team 9072 season matches…';
  status.className = 'sync-status working';
  try {
    const response = await fetch(`https://www.thebluealliance.com/api/v3/team/frc9072/matches/${encodeURIComponent(settings.year || '2026')}`, {
      headers: tbaHeaders(settings.apiKey)
    });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'TBA API key was rejected.' : `TBA returned ${response.status}.`);
    const matches = await response.json();
    const played = matches.filter(match => {
      const redScore = Number(match.alliances?.red?.score);
      const blueScore = Number(match.alliances?.blue?.score);
      return redScore >= 0 && blueScore >= 0;
    });
    const season = played.reduce((summary, match) => {
      const red = (match.alliances?.red?.team_keys || []).includes('frc9072');
      const ours = Number(red ? match.alliances.red.score : match.alliances.blue.score);
      const theirs = Number(red ? match.alliances.blue.score : match.alliances.red.score);
      if (ours > theirs) summary.wins++;
      else if (ours < theirs) summary.losses++;
      else summary.ties++;
      return summary;
    }, { wins:0, losses:0, ties:0 });
    season.matches = played.length;
    season.winRate = played.length ? Math.round((season.wins + season.ties * .5) / played.length * 100) : 0;
    season.year = settings.year || '2026';
    season.fetchedAt = Date.now();
    localStorage.setItem('tiger-tba-9072-season', JSON.stringify(season));
    status.textContent = `${season.wins}-${season.losses}-${season.ties} • ${season.winRate}% win rate • ${season.matches} matches`;
    status.className = 'sync-status success';
    toast('Team 9072 season record updated.');
  } catch (error) {
    status.textContent = error.message || 'Could not pull the Team 9072 season record.';
    status.className = 'sync-status error';
  }
}

function statboticsStatusText() {
  if (localStorage.getItem('tiger-statbotics-enabled') !== 'yes') return 'Statbotics is disabled.';
  try {
    const cached = JSON.parse(localStorage.getItem('tiger-statbotics-9072') || 'null');
    if (cached?.available) return `Available • EPA ${Number(cached.epa).toFixed(1)}${cached.rank ? ` • Rank #${cached.rank}` : ''}`;
  } catch {}
  return 'No active Statbotics connection.';
}

function statboticsAvailability() {
  if (localStorage.getItem('tiger-statbotics-enabled') !== 'yes') return { state:'disabled', label:'Disabled' };
  try {
    const cached = JSON.parse(localStorage.getItem('tiger-statbotics-9072') || 'null');
    if (cached?.available) return { state:'success', label:'Pull succeeded' };
    if (cached?.available === false) return { state:'failed', label:'Pull failed' };
  } catch {}
  return { state:'disabled', label:'Not checked' };
}

function statboticsTeamMap() {
  try { return JSON.parse(localStorage.getItem('tiger-statbotics-teams') || '{}'); }
  catch { return {}; }
}

function parseStatboticsTeam(data) {
  const epa = data?.epa?.total_points?.mean ?? data?.epa?.total_points ?? data?.epa?.mean ?? data?.epa?.current ??
    data?.epa_end ?? data?.epa_mean ?? data?.norm_epa?.current;
  const rank = data?.epa?.total_points?.rank ?? data?.epa?.ranks?.total?.rank ?? data?.epa?.rank ?? data?.epa_rank ??
    data?.rank?.epa ?? data?.ranks?.epa;
  const breakdown = data?.epa?.breakdown || {};
  return Number.isFinite(Number(epa)) ? {
    epa:Number(epa), rank:rank || null,
    autoEpa:Number(breakdown.auto_points ?? breakdown.auto ?? 0),
    teleopEpa:Number(breakdown.teleop_points ?? breakdown.teleop ?? 0),
    endgameEpa:Number(breakdown.endgame_points ?? breakdown.endgame ?? 0),
    fuelEpa:Number(breakdown.total_fuel ?? 0),
    towerEpa:Number(breakdown.total_tower ?? 0)
  } : null;
}

async function fetchStatboticsTeam(team, year = '2026') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.statbotics.io/v3/team_year/${encodeURIComponent(team)}/${encodeURIComponent(year)}`, {
      signal:controller.signal, headers:{Accept:'application/json'}
    });
    if (!response.ok) return null;
    return parseStatboticsTeam(await response.json());
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

async function fetchStatboticsMatch(matchKey) {
  if (localStorage.getItem('tiger-statbotics-enabled') !== 'yes' || !matchKey) return null;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem('tiger-statbotics-matches') || '{}'); } catch {}
  if (cache[matchKey] && Date.now() - Number(cache[matchKey].fetchedAt || 0) < 1800000) return cache[matchKey];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://api.statbotics.io/v3/match/${encodeURIComponent(matchKey)}`, {
      signal:controller.signal, headers:{Accept:'application/json'}
    });
    if (!response.ok) return null;
    const data = await response.json();
    const prediction = data?.pred || data?.prediction || {};
    const redWin = prediction.red_win_prob ?? prediction.redWinProb ?? data?.red_win_prob;
    const redScore = prediction.red_score ?? prediction.redScore ?? data?.red_score;
    const blueScore = prediction.blue_score ?? prediction.blueScore ?? data?.blue_score;
    if (!Number.isFinite(Number(redWin))) return null;
    const parsed = { redWin:Number(redWin), redScore:Number(redScore), blueScore:Number(blueScore), fetchedAt:Date.now() };
    cache[matchKey] = parsed;
    localStorage.setItem('tiger-statbotics-matches', JSON.stringify(cache));
    return parsed;
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

async function syncAllStatboticsTeams() {
  const status = document.querySelector('#statboticsTeamsStatus') || { textContent:'', className:'' };
  if (localStorage.getItem('tiger-statbotics-enabled') !== 'yes') {
    status.textContent = 'Enable Statbotics first.';
    status.className = 'sync-status error';
    return;
  }
  const allRecords = await records();
  const selectedEvent = localStorage.getItem('tiger-selected-event') || 'all';
  const eventRecords = selectedEvent === 'all' ? allRecords : allRecords.filter(record => (record.event || 'Unspecified event') === selectedEvent);
  const teams = [...new Set(eventRecords.map(record => String(record.team)).filter(Boolean))];
  const results = statboticsTeamMap();
  let completed = 0;
  let saved = 0;
  status.className = 'sync-status working';
  for (let index = 0; index < teams.length; index += 5) {
    const batch = teams.slice(index,index+5);
    const responses = await Promise.all(batch.map(team => fetchStatboticsTeam(team)));
    responses.forEach((result, offset) => {
      completed++;
      if (!result) return;
      results[batch[offset]] = {...result, fetchedAt:Date.now()};
      saved++;
    });
    status.textContent = `Checked ${completed} of ${teams.length} teams…`;
  }
  localStorage.setItem('tiger-statbotics-teams', JSON.stringify(results));
  status.textContent = `Saved EPA data for ${saved} of ${teams.length} teams. Unavailable teams were ignored.`;
  status.className = saved ? 'sync-status success' : 'sync-status error';
}

function updateStatboticsIndicator() {
  const indicator = document.querySelector('#statboticsIndicator');
  if (!indicator) return;
  const availability = statboticsAvailability();
  indicator.className = `availability-badge ${availability.state}`;
  indicator.innerHTML = `<i></i>${availability.label}`;
}

async function syncStatbotics() {
  const status = document.querySelector('#statboticsStatus') || { textContent:'', className:'' };
  if (localStorage.getItem('tiger-statbotics-enabled') !== 'yes') {
    status.textContent = 'Enable Statbotics first.';
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  status.textContent = 'Checking Statbotics…';
  status.className = 'sync-status working';
  try {
    const response = await fetch('https://api.statbotics.io/v3/team_year/9072/2026', {
      signal: controller.signal,
      headers: { Accept:'application/json' }
    });
    if (!response.ok) throw new Error('Unavailable');
    const data = await response.json();
    const parsed = parseStatboticsTeam(data);
    if (!parsed) throw new Error('EPA missing');
    const cached = { available:true, ...parsed, fetchedAt:Date.now() };
    localStorage.setItem('tiger-statbotics-9072', JSON.stringify(cached));
    updateStatboticsIndicator();
    status.textContent = `Available • EPA ${cached.epa.toFixed(1)}${cached.rank ? ` • Rank #${cached.rank}` : ''}`;
    status.className = 'sync-status success';
  } catch {
    localStorage.setItem('tiger-statbotics-9072', JSON.stringify({ available:false, fetchedAt:Date.now() }));
    updateStatboticsIndicator();
    status.textContent = 'Statbotics is unavailable. Its data will be ignored.';
    status.className = 'sync-status';
  } finally {
    clearTimeout(timeout);
  }
}

const adminUnlocked = () => sessionStorage.getItem('tiger-admin-unlocked') === 'yes';

async function ensureDefaultAdminPassword() {
  if (localStorage.getItem('tiger-admin-hash')) return;
  const salt = makeId();
  localStorage.setItem('tiger-admin-salt', salt);
  localStorage.setItem('tiger-admin-hash', await hashPassword('Tigerbots', salt));
}

function updateAdminNav() {
  const focusedMode = appMode() === 'scouting' || appMode() === 'notes';
  document.querySelectorAll('.admin-nav').forEach(button => button.hidden = appMode() !== 'command' && (!adminUnlocked() || focusedMode));
}

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}

function adminSettingsMarkup() {
  const configured = Boolean(localStorage.getItem('tiger-admin-hash'));
  if (!configured) return `
    <p class="settings-copy">Create a password to protect access to the full editable record table.</p>
    <label>New editor password<input id="newAdminPassword" type="password" autocomplete="new-password" minlength="4"></label>
    <label>Confirm password<input id="confirmAdminPassword" type="password" autocomplete="new-password" minlength="4"></label>
    <button id="setAdminPassword" class="demo-button">Create editor password</button>
    <div id="adminStatus" class="sync-status">Use at least 4 characters.</div>`;
  return `
    <p class="settings-copy">Enter the device password to reveal the Editor tab for this browser session.</p>
    <label>Editor password<input id="adminPassword" type="password" autocomplete="current-password"></label>
    <div class="settings-actions">
      <button id="unlockAdmin" class="primary">${adminUnlocked()?'Open data editor':'Unlock editor'}</button>
      ${adminUnlocked()?'<button id="lockAdmin" class="secondary">Lock editor</button>':''}
    </div>
    <details class="password-change"><summary>Change editor password</summary>
      <label>Current password<input id="currentAdminPassword" type="password" autocomplete="current-password"></label>
      <label>New password<input id="replacementAdminPassword" type="password" autocomplete="new-password" minlength="4"></label>
      <button id="changeAdminPassword" class="secondary">Change password</button>
    </details>
    <div id="adminStatus" class="sync-status">${adminUnlocked()?'Editor is unlocked for this session.':'Editor is locked. Initial password: Tigerbots'}</div>`;
}

async function renderPreScouting() {
  const allRecords = await records();
  const assetDb = await dbPromise;
  const currentEvent = localStorage.getItem('tiger-selected-event') || 'all';
  const events = [...new Set(allRecords.map(record => record.event || 'Unspecified event'))].sort();
  const previousEvents = events.filter(event => event !== currentEvent);
  let sourceEvent = localStorage.getItem('tiger-prescout-event') || previousEvents[0] || events[0] || '';
  if (!events.includes(sourceEvent)) sourceEvent = previousEvents[0] || events[0] || '';
  const sourceRecords = allRecords.filter(record => (record.event || 'Unspecified event') === sourceEvent);
  const teams = [...new Set(sourceRecords.map(record => String(record.team)).filter(Boolean))].map(team => {
    const matches = sourceRecords.filter(record => String(record.team) === team);
    const points = matches.map(record => score(record));
    const average = values => values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : 0;
    return {
      team,
      matches: matches.length,
      average: average(points),
      minimum: points.length ? Math.min(...points) : 0,
      maximum: points.length ? Math.max(...points) : 0,
      fuel: average(matches.map(record => Number(record.autoFuel || 0) + Number(record.teleFuel || 0))),
      auto: average(matches.map(record => Number(record.autoFuel || 0))),
      tower: average(matches.map(record => ({None:0,'Level 1':10,'Level 2':20,'Level 3':30}[record.teleTower] || 0))),
      reliability: matches.length ? 100 * matches.filter(record => !record.broke).length / matches.length : 0
    };
  }).sort((a,b) => b.average-a.average);
  const teamPhotos = {};
  await Promise.all(teams.map(async team => {
    const photo = await assetDb.get('assets', `team-photo-${team.team}`);
    if (photo?.dataUrl) teamPhotos[team.team] = photo.dataUrl;
  }));
  view.innerHTML = `
    <section class="pagehead prescout-head"><p class="eyebrow">HISTORICAL INTELLIGENCE</p><h1>Pre-scouting</h1><p>Use a previous event as a baseline before new scouting records arrive.</p></section>
    <section class="prescout-toolbar">
      <label>Previous event<select id="prescoutEvent">${events.map(event => `<option value="${escapeHtml(event)}" ${event===sourceEvent?'selected':''}>${escapeHtml(event)}</option>`).join('')}</select></label>
      <div><strong>${teams.length}</strong><span>teams</span></div>
      <div><strong>${sourceRecords.length}</strong><span>records</span></div>
    </section>
    ${teams.length ? `<section class="table-card prescout-table">
      <div class="table-title"><div><p class="eyebrow">PRIOR EVENT RANKING</p><h2>${escapeHtml(sourceEvent)}</h2></div><small>Historical data—not a prediction of current performance</small></div>
      <div class="table-scroll"><table><thead><tr><th>Rank</th><th>Photo</th><th>Team</th><th>Matches</th><th>Avg pts</th><th>Range</th><th>Fuel</th><th>Auto</th><th>Tower</th><th>Reliable</th></tr></thead>
      <tbody>${teams.map((team,index) => `<tr><td>${index+1}</td><td><label class="prescout-photo-button" title="Take or choose a photo for Team ${escapeHtml(team.team)}">${teamPhotos[team.team] ? `<img src="${escapeHtml(teamPhotos[team.team])}" alt="Team ${escapeHtml(team.team)} robot">` : '<span>＋</span>'}<input type="file" accept="image/*" capture="environment" data-prescout-photo="${escapeHtml(team.team)}"></label></td><td><b>${escapeHtml(team.team)}</b></td><td>${team.matches}</td><td><strong>${team.average.toFixed(1)}</strong></td><td>${team.minimum.toFixed(0)}–${team.maximum.toFixed(0)}</td><td>${team.fuel.toFixed(1)}</td><td>${team.auto.toFixed(1)}</td><td>${team.tower.toFixed(1)}</td><td>${Math.round(team.reliability)}%</td></tr>`).join('')}</tbody></table></div>
    </section>` : '<section class="empty"><span>◫</span><h2>No previous-event records</h2><p>Store or import another event to build a pre-scouting baseline.</p></section>'}`;
  document.querySelector('#prescoutEvent')?.addEventListener('change', event => {
    localStorage.setItem('tiger-prescout-event', event.target.value);
    renderPreScouting();
  });
  document.querySelectorAll('[data-prescout-photo]').forEach(input => input.onchange = async event => {
    const file = event.target.files?.[0];
    const team = event.target.dataset.prescoutPhoto;
    if (!file || !team) return;
    try {
      const dataUrl = await resizeTeamPhoto(file);
      await assetDb.put('assets', { id:`team-photo-${team}`, team, dataUrl, savedAt:Date.now() });
      toast(`Photo saved for Team ${team}.`);
      renderPreScouting();
    } catch {
      toast('That photo could not be saved.', true);
    }
  });
}

async function renderCompareRobots() {
  const allRecords = await records();
  const selectedEvent = localStorage.getItem('tiger-selected-event') || 'all';
  const eventRecords = selectedEvent === 'all' ? allRecords : allRecords.filter(record => (record.event || 'Unspecified event') === selectedEvent);
  const teams = [...new Set(eventRecords.map(record => String(record.team)).filter(Boolean))].sort((a,b) => Number(a)-Number(b));
  let left = localStorage.getItem('tiger-compare-left') || teams[0] || '';
  let right = localStorage.getItem('tiger-compare-right') || teams.find(team => team !== left) || teams[0] || '';
  if (!teams.includes(left)) left = teams[0] || '';
  if (!teams.includes(right)) right = teams.find(team => team !== left) || teams[0] || '';
  const summarize = team => {
    const matches = eventRecords.filter(record => String(record.team) === team);
    const points = matches.map(record => score(record));
    const average = values => values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : 0;
    const pointAverage = average(points);
    const deviation = Math.sqrt(average(points.map(value => (value-pointAverage) ** 2)));
    return {
      matches: matches.length,
      average: pointAverage,
      minimum: points.length ? Math.min(...points) : 0,
      maximum: points.length ? Math.max(...points) : 0,
      fuel: average(matches.map(record => Number(record.autoFuel || 0) + Number(record.teleFuel || 0))),
      auto: average(matches.map(record => Number(record.autoFuel || 0))),
      tower: average(matches.map(record => ({None:0,'Level 1':10,'Level 2':20,'Level 3':30}[record.teleTower] || 0))),
      defense: average(matches.map(record => Number(record.defense || 0))),
      reliability: matches.length ? 100 * matches.filter(record => !record.broke).length / matches.length : 0,
      consistency: Math.max(0, 100 - deviation * 3)
    };
  };
  const a = summarize(left);
  const b = summarize(right);
  const rows = [
    ['Matches','matches',0],['Average points','average',1],['Minimum points','minimum',0],['Maximum points','maximum',0],
    ['Fuel / match','fuel',1],['Auto fuel','auto',1],['Tower points','tower',1],['Defense','defense',1],
    ['Reliability','reliability',0,'%'],['Consistency','consistency',0,'%']
  ];
  const value = (data, key, decimals, suffix='') => `${Number(data[key]).toFixed(decimals)}${suffix}`;
  view.innerHTML = `
    <section class="pagehead compare-head"><p class="eyebrow">COMMAND ANALYSIS</p><h1>Compare robots</h1><p>Put two teams side-by-side using records from ${escapeHtml(selectedEvent === 'all' ? 'all saved events' : selectedEvent)}.</p></section>
    ${teams.length >= 2 ? `<section class="compare-selectors">
      <label>Robot A<select id="compareLeft">${teams.map(team=>`<option value="${escapeHtml(team)}" ${team===left?'selected':''}>Team ${escapeHtml(team)}</option>`).join('')}</select></label>
      <span>VS</span>
      <label>Robot B<select id="compareRight">${teams.map(team=>`<option value="${escapeHtml(team)}" ${team===right?'selected':''}>Team ${escapeHtml(team)}</option>`).join('')}</select></label>
    </section>
    <section class="compare-card">
      <div class="compare-team-head"><strong>Team ${escapeHtml(left)}</strong><span>Metric</span><strong>Team ${escapeHtml(right)}</strong></div>
      ${rows.map(([label,key,decimals,suffix]) => {
        const leftWins = Number(a[key]) > Number(b[key]);
        const rightWins = Number(b[key]) > Number(a[key]);
        return `<div class="compare-row"><b class="${leftWins?'winner':''}">${value(a,key,decimals,suffix)}</b><span>${label}</span><b class="${rightWins?'winner':''}">${value(b,key,decimals,suffix)}</b></div>`;
      }).join('')}
    </section>` : '<section class="empty"><span>⇄</span><h2>Two teams needed</h2><p>Collect records for at least two teams to compare robots.</p></section>'}`;
  document.querySelector('#compareLeft')?.addEventListener('change', event => {
    localStorage.setItem('tiger-compare-left', event.target.value);
    renderCompareRobots();
  });
  document.querySelector('#compareRight')?.addEventListener('change', event => {
    localStorage.setItem('tiger-compare-right', event.target.value);
    renderCompareRobots();
  });
}

function matchPrepCatalog() {
  try {
    const saved = JSON.parse(localStorage.getItem('tiger-matchprep-catalog') || '[]');
    return Array.isArray(saved) ? saved.filter(item => item?.id && Array.isArray(item.ours) && Array.isArray(item.opponents)) : [];
  } catch { return []; }
}

function saveMatchPrepSnapshot(snapshot) {
  const saved = {
    ...snapshot,
    id: snapshot.id || `prep-${makeId()}`,
    v: 1,
    savedAt: Number(snapshot.savedAt) || Date.now(),
    ours: (snapshot.ours || []).slice(0, 3).map(String),
    opponents: (snapshot.opponents || []).slice(0, 3).map(String)
  };
  const catalog = [saved, ...matchPrepCatalog().filter(item => item.id !== saved.id)].slice(0, 60);
  localStorage.setItem('tiger-matchprep-catalog', JSON.stringify(catalog));
  return saved;
}

function matchPrepPayload(prep) {
  return `TMP1:${btoa(unescape(encodeURIComponent(JSON.stringify(prep))))}`;
}

function decodeMatchPrepPayload(payload) {
  if (!payload.startsWith('TMP1:')) throw new Error('Not a match prep');
  const prep = JSON.parse(decodeURIComponent(escape(atob(payload.slice(5)))));
  if (!prep?.id || !['schedule', 'manual'].includes(prep.kind) || !Array.isArray(prep.ours) || !Array.isArray(prep.opponents)) throw new Error('Invalid match prep');
  return {
    ...prep,
    ours: prep.ours.slice(0, 3).map(String),
    opponents: prep.opponents.slice(0, 3).map(String),
    ourScore: Number(prep.ourScore) || 0,
    opponentScore: Number(prep.opponentScore) || 0,
    winChance: Math.min(100, Math.max(0, Number(prep.winChance) || 0)),
    savedAt: Number(prep.savedAt) || Date.now()
  };
}

async function buildMatchPrepPacket(prep) {
  const relevantTeams = [...new Set([...(prep.ours || []), ...(prep.opponents || [])].map(String).filter(Boolean))];
  const teamSet = new Set(relevantTeams);
  const eventName = prep.event || localStorage.getItem('tiger-selected-event') || 'Unspecified event';
  const allRecords = await records();
  const eventRecords = allRecords.filter(record => teamSet.has(String(record.team)) &&
    (eventName === 'All saved events' || (record.event || 'Unspecified event') === eventName));
  let schedule = [];
  try { schedule = JSON.parse(localStorage.getItem('tiger-tba-schedule') || '[]'); } catch {}
  const relevantSchedule = schedule.filter(match => [...(match.red || []), ...(match.blue || [])].some(team => teamSet.has(String(team))));
  const analytics = statboticsTeamMap();
  const relevantAnalytics = Object.fromEntries(relevantTeams.filter(team => analytics[team]).map(team => [team, analytics[team]]));
  return {
    v: 2,
    createdAt: Date.now(),
    prep,
    competition: {
      name: eventName,
      tbaEventKey: localStorage.getItem('tiger-tba-event') || '',
      year: localStorage.getItem('tiger-tba-year') || '',
      teams: relevantTeams,
      schedule: relevantSchedule,
      details: eventName === CRI_EVENT.name ? CRI_EVENT : null
    },
    records: eventRecords,
    teamAnalytics: relevantAnalytics
  };
}

function validateMatchPrepPacket(packet) {
  if (!packet || Number(packet.v) !== 2 || !packet.prep || !Array.isArray(packet.records) || !Array.isArray(packet.competition?.teams)) throw new Error('Invalid match prep packet');
  const prep = decodeMatchPrepPayload(matchPrepPayload(packet.prep));
  const relevantTeams = new Set([...prep.ours, ...prep.opponents].map(String));
  if (!packet.competition.teams.every(team => relevantTeams.has(String(team)))) throw new Error('Unexpected team data');
  return { ...packet, prep };
}

async function showMatchPrepQr(prep) {
  const panel = document.querySelector('#matchPrepQrPanel');
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = '<div class="matchprep-qr-copy"><p class="eyebrow">BUILDING PACKET</p><h2>Collecting the six teams’ data…</h2><p>Scouting records and competition details are being compressed for transfer.</p></div>';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try {
    const packet = await buildMatchPrepPacket(prep);
    const summary = {
      teamCount: packet.competition.teams.length,
      recordCount: packet.records.length,
      scheduleCount: packet.competition.schedule.length
    };
    packet.prep = saveMatchPrepSnapshot({ ...prep, packetSummary: summary });
    const jsonBytes = new TextEncoder().encode(JSON.stringify(packet));
    let version = 'TMP2J';
    let packetBytes = jsonBytes;
    if ('CompressionStream' in window) {
      const stream = new Blob([jsonBytes]).stream().pipeThrough(new CompressionStream('gzip'));
      packetBytes = new Uint8Array(await new Response(stream).arrayBuffer());
      version = 'TMP2G';
    }
    let binary = '';
    for (let offset = 0; offset < packetBytes.length; offset += 0x8000) binary += String.fromCharCode(...packetBytes.subarray(offset, offset + 0x8000));
    const parts = (btoa(binary).match(/.{1,1500}/g) || ['']);
    const session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    let index = 0;
    const draw = () => {
      panel.innerHTML = `
        <div class="matchprep-qr-copy"><p class="eyebrow">MATCH DATA PACKET</p><h2>${escapeHtml(packet.prep.title || 'Saved matchup')}</h2><p>Scan all ${parts.length} code${parts.length === 1 ? '' : 's'} in Tiger Scout's Scan tab. This sends ${summary.recordCount} scouting records and ${summary.scheduleCount} schedule entries for the ${summary.teamCount} teams in this match.</p><div class="packet-progress"><b>Code ${index + 1} of ${parts.length}</b><span>${summary.teamCount} teams · ${summary.recordCount} records</span></div></div>
        <div><div class="qr-wrap"><div data-matchprep-qr></div></div><div class="backup-qr-actions"><button data-packet-prev class="secondary" ${index === 0 ? 'disabled' : ''}>Previous</button><button data-packet-next class="primary">${index === parts.length - 1 ? 'Start over' : 'Next code'}</button></div></div>`;
      new QRCode(panel.querySelector('[data-matchprep-qr]'), {
        text: `${version}:${session}:${index}:${parts.length}:${parts[index]}`,
        width: 300, height: 300, colorDark: '#090807', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.L
      });
      panel.querySelector('[data-packet-prev]').onclick = () => { index--; draw(); };
      panel.querySelector('[data-packet-next]').onclick = () => { index = index === parts.length - 1 ? 0 : index + 1; draw(); };
    };
    draw();
  } catch {
    panel.innerHTML = '<div class="matchprep-qr-copy"><p class="eyebrow">PACKET ERROR</p><h2>Could not build this handoff</h2><p>Return to the matchup and try saving it again.</p></div>';
    toast('Match Prep packet could not be created.', true);
  }
}

async function importMatchPrepPayload(payload) {
  try {
    const prep = saveMatchPrepSnapshot(decodeMatchPrepPayload(payload));
    localStorage.setItem('tiger-matchprep-view', 'catalog');
    toast(`${prep.title || 'Match prep'} saved to the catalog.`);
    if (appMode() === 'matchprep' || appMode() === 'command') setTimeout(() => go('matchprep'), 500);
  } catch { toast('That is not a valid Tiger Scout match prep.', true); }
}

async function importMatchPrepPacketChunk(payload) {
  try {
    const match = payload.match(/^(TMP2[JG]):([^:]+):(\d+):(\d+):(.+)$/);
    if (!match) throw new Error();
    const [, version, session, indexText, totalText, data] = match;
    const index = Number(indexText);
    const total = Number(totalText);
    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total || total > 100) throw new Error();
    const key = `tiger-matchprep-packet-${session}`;
    const state = JSON.parse(localStorage.getItem(key) || `{"version":"${version}","total":${total},"parts":{}}`);
    if (state.total !== total || state.version !== version) throw new Error();
    state.parts[index] = data;
    localStorage.setItem(key, JSON.stringify(state));
    const received = Object.keys(state.parts).length;
    if (received < total) return toast(`Match packet code ${index + 1} saved — ${received} of ${total}.`);
    const joined = Array.from({ length: total }, (_, partIndex) => state.parts[partIndex]).join('');
    const binary = atob(joined);
    let bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    if (version === 'TMP2G') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    const packet = validateMatchPrepPacket(JSON.parse(new TextDecoder().decode(bytes)));
    const db = await dbPromise;
    let added = 0;
    for (const record of packet.records) {
      if (!record?.id || !record?.team || !record?.match || await db.get('records', record.id)) continue;
      await db.put('records', record);
      added++;
    }
    const analytics = { ...statboticsTeamMap(), ...(packet.teamAnalytics || {}) };
    localStorage.setItem('tiger-statbotics-teams', JSON.stringify(analytics));
    const prep = saveMatchPrepSnapshot({
      ...packet.prep,
      competition: packet.competition,
      teamAnalytics: packet.teamAnalytics || {},
      packetSummary: {
        teamCount: packet.competition.teams.length,
        recordCount: packet.records.length,
        scheduleCount: packet.competition.schedule?.length || 0
      }
    });
    if (packet.competition.name && packet.competition.name !== 'All saved events') {
      let savedEvents = [];
      try { savedEvents = JSON.parse(localStorage.getItem('tiger-saved-events') || '[]'); } catch {}
      localStorage.setItem('tiger-saved-events', JSON.stringify([...new Set([...savedEvents, packet.competition.name])].sort()));
    }
    localStorage.removeItem(key);
    localStorage.setItem('tiger-matchprep-view', 'catalog');
    toast(`${prep.title || 'Match prep'} imported with ${added} new scouting records.`);
    if (appMode() === 'matchprep' || appMode() === 'command') setTimeout(() => go('matchprep'), 700);
  } catch {
    toast('That Match Prep packet code is invalid.', true);
  }
}

async function renderMatchPrep() {
  const allRecords = await records();
  const selectedEvent = localStorage.getItem('tiger-selected-event') || 'all';
  const eventRecords = selectedEvent === 'all' ? allRecords : allRecords.filter(record => (record.event || 'Unspecified event') === selectedEvent);
  let schedule = [];
  try { schedule = JSON.parse(localStorage.getItem('tiger-tba-schedule') || '[]'); } catch {}
  const recordTeams = [...new Set(eventRecords.map(record => String(record.team)).filter(Boolean))];
  const scheduleTeams = [...new Set(schedule.flatMap(match => [...match.red, ...match.blue]))];
  const teams = [...new Set([...recordTeams, ...scheduleTeams])].sort((a,b) => Number(a)-Number(b));
  let selectedTeam = localStorage.getItem('tiger-matchprep-team') || teams[0] || '';
  if (!teams.includes(selectedTeam)) selectedTeam = teams[0] || '';
  const teamMatches = schedule.filter(match => match.red.includes(selectedTeam) || match.blue.includes(selectedTeam)).sort((a,b) => a.number-b.number);
  let selectedKey = localStorage.getItem('tiger-matchprep-match') || teamMatches.find(match => match.redScore < 0 && match.blueScore < 0)?.key || teamMatches[0]?.key || '';
  if (!teamMatches.some(match => match.key === selectedKey)) selectedKey = teamMatches[0]?.key || '';
  const match = teamMatches.find(item => item.key === selectedKey);
  const statboticsPrediction = match ? await fetchStatboticsMatch(match.key) : null;
  const projection = team => {
    const samples = eventRecords.filter(record => String(record.team) === String(team));
    return samples.length ? samples.reduce((sum, record) => sum + score(record), 0) / samples.length : 0;
  };
  const redProjected = match ? match.red.reduce((sum, team) => sum + projection(team), 0) : 0;
  const blueProjected = match ? match.blue.reduce((sum, team) => sum + projection(team), 0) : 0;
  const selectedRed = match?.red.includes(selectedTeam);
  const ourScore = selectedRed ? redProjected : blueProjected;
  const opponentScore = selectedRed ? blueProjected : redProjected;
  const winChance = match ? Math.round(100 / (1 + Math.exp(-(ourScore - opponentScore) / 18))) : 50;
  const outcome = winChance >= 65 ? 'Likely win' : winChance <= 35 ? 'Likely loss' : 'Toss-up';
  const teamCard = (team, ours) => `<article class="${ours?'our-team':''}"><span>Team ${escapeHtml(team)}</span><strong>${projection(team).toFixed(1)}</strong><small>projected points</small></article>`;
  const prepView = localStorage.getItem('tiger-matchprep-view') || 'schedule';
  let manual = { ours:['','',''], opponents:['','',''] };
  try { manual = {...manual, ...JSON.parse(localStorage.getItem('tiger-matchprep-manual') || '{}')}; } catch {}
  manual.ours = [...(manual.ours || []), '', '', ''].slice(0,3);
  manual.opponents = [...(manual.opponents || []), '', '', ''].slice(0,3);
  const manualOurScore = manual.ours.reduce((sum, team) => sum + projection(team), 0);
  const manualOpponentScore = manual.opponents.reduce((sum, team) => sum + projection(team), 0);
  const manualChance = Math.round(100 / (1 + Math.exp(-(manualOurScore - manualOpponentScore) / 18)));
  const manualOutcome = manualChance >= 65 ? 'Likely win' : manualChance <= 35 ? 'Likely loss' : 'Toss-up';
  const manualInputs = (side, values) => values.map((team, index) => `<label>Team ${index + 1}<input data-manual-side="${side}" data-manual-index="${index}" inputmode="numeric" value="${escapeHtml(team)}" placeholder="Team number"></label>`).join('');
  const eventLabel = selectedEvent === 'all' ? 'All saved events' : selectedEvent;
  const manualSnapshot = {
    kind: 'manual', title: 'Manual matchup', event: eventLabel,
    ours: manual.ours, opponents: manual.opponents,
    ourScore: manualOurScore, opponentScore: manualOpponentScore,
    winChance: manualChance, outcome: manualOutcome
  };
  const scheduleSnapshot = match ? {
    id: `schedule-${selectedEvent}-${match.key}`,
    kind: 'schedule', title: `Qualification ${match.number}`, event: eventLabel,
    matchNumber: match.number, focusTeam: selectedTeam,
    ours: selectedRed ? match.red : match.blue,
    opponents: selectedRed ? match.blue : match.red,
    ourScore, opponentScore, winChance, outcome
  } : null;
  const catalog = matchPrepCatalog();
  const shareControls = snapshot => {
    const complete = snapshot && [...snapshot.ours, ...snapshot.opponents].every(Boolean);
    return `<section class="matchprep-share"><div><p class="eyebrow">OFFLINE HANDOFF</p><h2>Save and share this prep</h2><p>Create a compressed QR packet with this matchup, event details, and the selected event's scouting data for these six teams.</p></div><button id="saveMatchPrep" class="primary" ${complete ? '' : 'disabled'}>Save & build QR packet</button>${complete ? '' : '<small>Enter all six teams to create the handoff.</small>'}</section>`;
  };
  const catalogMarkup = `<section class="matchprep-catalog">
    <div class="matchprep-catalog-head"><div><p class="eyebrow">SAVED MATCH PREPS</p><h2>${catalog.length} in this device</h2></div><p>Imported QR handoffs and locally saved matchups stay available offline.</p></div>
    ${catalog.length ? `<div class="matchprep-catalog-grid">${catalog.map(prep => `<article class="matchprep-catalog-card"><div class="catalog-card-head"><div><small>${escapeHtml(prep.event || 'Unspecified event')} · ${new Date(Number(prep.savedAt) || Date.now()).toLocaleString()}</small><h3>${escapeHtml(prep.title || 'Saved matchup')}</h3></div><strong>${Math.round(Number(prep.winChance) || 0)}%</strong></div><div class="catalog-score"><span>${escapeHtml((prep.ours || []).join(' · ') || 'No alliance')}</span><b>${Number(prep.ourScore || 0).toFixed(1)}–${Number(prep.opponentScore || 0).toFixed(1)}</b><span>${escapeHtml((prep.opponents || []).join(' · ') || 'No opponents')}</span></div><p>${escapeHtml(prep.outcome || 'Saved projection')}</p>${prep.packetSummary ? `<p class="packet-summary">${Number(prep.packetSummary.teamCount) || 6} teams · ${Number(prep.packetSummary.recordCount) || 0} scouting records · ${Number(prep.packetSummary.scheduleCount) || 0} schedule entries</p>` : ''}<div class="catalog-actions"><button class="secondary" data-prep-load="${escapeHtml(prep.id)}">Load matchup</button><button class="secondary" data-prep-data="${escapeHtml(prep.id)}">View team data</button><button class="secondary" data-prep-share="${escapeHtml(prep.id)}">Build QR packet</button><button class="catalog-delete" data-prep-delete="${escapeHtml(prep.id)}">Delete</button></div></article>`).join('')}</div>` : '<section class="empty compact-empty"><span>VS</span><h2>No saved match preps</h2><p>Save a scheduled or manual matchup, or scan a Match Prep QR packet on the Scan tab.</p></section>'}
  </section>`;
  view.innerHTML = `
    <section class="pagehead matchprep-head"><p class="eyebrow">MATCH READOUT</p><h1>Prepare the next match</h1><p>Compare projected alliance output using this event's scouting averages.</p></section>
    <nav class="picklist-subtabs matchprep-subtabs" aria-label="Match preparation views">
      <button data-prep-view="schedule" class="${prepView==='schedule'?'active':''}">Scheduled match</button>
      <button data-prep-view="manual" class="${prepView==='manual'?'active':''}">Manual matchup</button>
      <button data-prep-view="catalog" class="${prepView==='catalog'?'active':''}">Saved preps <span>${catalog.length}</span></button>
    </nav>
    ${prepView === 'catalog' ? catalogMarkup : prepView === 'manual' ? `<section class="manual-matchup">
      <div class="manual-alliance our-alliance"><p class="eyebrow">YOUR ALLIANCE</p>${manualInputs('ours', manual.ours)}</div>
      <div class="manual-alliance opponent-alliance"><p class="eyebrow">OPPONENT ALLIANCE</p>${manualInputs('opponents', manual.opponents)}</div>
    </section>
    <section class="match-readout manual-readout">
      <div class="win-readout ${manualChance>=65?'favored':manualChance<=35?'underdog':'even'}"><p class="eyebrow">MANUAL PROJECTION</p><strong>${manualChance}%</strong><h2>${manualOutcome}</h2><p>Projected ${manualOurScore.toFixed(1)}–${manualOpponentScore.toFixed(1)} for your alliance.</p></div>
      <div class="alliance-projection our-projection"><div><p class="eyebrow">YOUR ALLIANCE</p><strong>${manualOurScore.toFixed(1)}</strong></div>${manual.ours.map(team => team ? teamCard(team, true) : '<article><span>Team not set</span><strong>0.0</strong><small>projected points</small></article>').join('')}</div>
      <div class="alliance-projection opponent-projection"><div><p class="eyebrow">OPPONENTS</p><strong>${manualOpponentScore.toFixed(1)}</strong></div>${manual.opponents.map(team => team ? teamCard(team, false) : '<article><span>Team not set</span><strong>0.0</strong><small>projected points</small></article>').join('')}</div>
      <p class="projection-note">Enter all six teams above. Projections update from the selected event's scouting records.</p>
    </section>${shareControls(manualSnapshot)}` : `
    <section class="matchprep-controls">
      <label>Selected team<select id="matchprepTeam">${teams.map(team => `<option value="${escapeHtml(team)}" ${team===selectedTeam?'selected':''}>Team ${escapeHtml(team)}</option>`).join('')}</select></label>
      <label>Next match<select id="matchprepMatch">${teamMatches.map(item => `<option value="${escapeHtml(item.key)}" ${item.key===selectedKey?'selected':''}>Qualification ${item.number}${item.redScore < 0 && item.blueScore < 0 ? ' • upcoming' : ' • played'}</option>`).join('')}</select></label>
    </section>
    ${match ? `<section class="match-readout">
      <div class="win-readout ${winChance>=65?'favored':winChance<=35?'underdog':'even'}"><p class="eyebrow">QUALIFICATION ${match.number}</p><strong>${winChance}%</strong><h2>${outcome}</h2><p>Projected ${ourScore.toFixed(1)}–${opponentScore.toFixed(1)} for Team ${escapeHtml(selectedTeam)}'s alliance.</p></div>
      ${statboticsPrediction ? `<div class="statbotics-prediction"><div><p class="eyebrow">STATBOTICS PREDICTION</p><h3>${selectedRed ? Math.round(statboticsPrediction.redWin*100) : Math.round((1-statboticsPrediction.redWin)*100)}% win chance</h3></div><strong>${selectedRed ? statboticsPrediction.redScore.toFixed(1) : statboticsPrediction.blueScore.toFixed(1)}–${selectedRed ? statboticsPrediction.blueScore.toFixed(1) : statboticsPrediction.redScore.toFixed(1)}</strong><small>Statbotics projected score</small></div>` : ''}
      <div class="alliance-projection red-projection"><div><p class="eyebrow">RED ALLIANCE</p><strong>${redProjected.toFixed(1)}</strong></div>${match.red.map(team => teamCard(team, team===selectedTeam)).join('')}</div>
      <div class="alliance-projection blue-projection"><div><p class="eyebrow">BLUE ALLIANCE</p><strong>${blueProjected.toFixed(1)}</strong></div>${match.blue.map(team => teamCard(team, team===selectedTeam)).join('')}</div>
      <p class="projection-note">Projection uses average points from locally available scouting records. Teams without records are shown as 0.0 and reduce confidence.</p>
    </section>${shareControls(scheduleSnapshot)}` : `<section class="empty matchprep-empty"><span>VS</span><h2>No upcoming schedule found</h2><p>Sync the event in Settings with The Blue Alliance to load qualification alliances.</p><button class="primary" data-go="settings">Open settings</button></section>`}`}
    <section id="matchPrepQrPanel" class="matchprep-qr-panel" hidden></section>`;
  document.querySelectorAll('[data-prep-view]').forEach(button => button.onclick = () => {
    localStorage.setItem('tiger-matchprep-view', button.dataset.prepView);
    renderMatchPrep();
  });
  document.querySelectorAll('[data-manual-side]').forEach(input => input.onchange = () => {
    manual[input.dataset.manualSide][Number(input.dataset.manualIndex)] = input.value.trim();
    localStorage.setItem('tiger-matchprep-manual', JSON.stringify(manual));
    renderMatchPrep();
  });
  document.querySelector('#matchprepTeam')?.addEventListener('change', event => {
    localStorage.setItem('tiger-matchprep-team', event.target.value);
    localStorage.removeItem('tiger-matchprep-match');
    renderMatchPrep();
  });
  document.querySelector('#matchprepMatch')?.addEventListener('change', event => {
    localStorage.setItem('tiger-matchprep-match', event.target.value);
    renderMatchPrep();
  });
  document.querySelector('#saveMatchPrep')?.addEventListener('click', () => {
    const snapshot = prepView === 'manual' ? manualSnapshot : scheduleSnapshot;
    if (!snapshot || ![...snapshot.ours, ...snapshot.opponents].every(Boolean)) return toast('Enter all six teams first.', true);
    const saved = saveMatchPrepSnapshot(snapshot);
    showMatchPrepQr(saved);
    toast('Match prep saved to the catalog.');
  });
  document.querySelectorAll('[data-prep-share]').forEach(button => button.onclick = () => {
    const prep = catalog.find(item => item.id === button.dataset.prepShare);
    if (prep) showMatchPrepQr(prep);
  });
  document.querySelectorAll('[data-prep-load]').forEach(button => button.onclick = () => {
    const prep = catalog.find(item => item.id === button.dataset.prepLoad);
    if (!prep) return;
    localStorage.setItem('tiger-matchprep-manual', JSON.stringify({ ours: prep.ours, opponents: prep.opponents }));
    localStorage.setItem('tiger-matchprep-view', 'manual');
    renderMatchPrep();
  });
  document.querySelectorAll('[data-prep-data]').forEach(button => button.onclick = () => {
    const prep = catalog.find(item => item.id === button.dataset.prepData);
    if (!prep) return;
    if (prep.event && prep.event !== 'All saved events') localStorage.setItem('tiger-selected-event', prep.event);
    go('data');
  });
  document.querySelectorAll('[data-prep-delete]').forEach(button => button.onclick = () => {
    const remaining = catalog.filter(item => item.id !== button.dataset.prepDelete);
    localStorage.setItem('tiger-matchprep-catalog', JSON.stringify(remaining));
    toast('Saved match prep deleted.');
    renderMatchPrep();
  });
}

async function renderNotes() {
  let savedEvents = [];
  try { savedEvents = JSON.parse(localStorage.getItem('tiger-saved-events') || '[]'); } catch {}
  savedEvents = [...new Set([...savedEvents, ...(await records()).map(record => record.event || 'Unspecified event')])].sort();
  const selectedEvent = localStorage.getItem('tiger-selected-event') || savedEvents[0] || 'all';
  let notes = {};
  try { notes = JSON.parse(localStorage.getItem('tiger-event-notes') || '{}'); } catch {}
  const eventNotes = notes[selectedEvent] || {};
  view.innerHTML = `
    <section class="pagehead notes-head"><p class="eyebrow">STRATEGY NOTEBOOK</p><h1>Event notes</h1><p>Keep alliance strategy, team observations, and reminders beside the current dataset.</p></section>
    <section class="notes-card">
      <label>Notes event<select id="notesEvent">
        <option value="all" ${selectedEvent==='all'?'selected':''}>General / all events</option>
        ${savedEvents.map(event => `<option value="${escapeHtml(event)}" ${selectedEvent===event?'selected':''}>${escapeHtml(event)}</option>`).join('')}
      </select></label>
      <div class="notes-grid">
        <label>Alliance strategy<textarea data-note-field="strategy" rows="8" placeholder="Roles, priorities, match plans…">${escapeHtml(eventNotes.strategy || '')}</textarea></label>
        <label>Teams to watch<textarea data-note-field="teams" rows="8" placeholder="Standout teams, concerns, follow-ups…">${escapeHtml(eventNotes.teams || '')}</textarea></label>
        <label class="notes-wide">General notes<textarea data-note-field="general" rows="10" placeholder="Anything the scouting team needs to remember…">${escapeHtml(eventNotes.general || '')}</textarea></label>
      </div>
      <div id="notesStatus" class="sync-status">Notes save automatically on this device.</div>
    </section>`;
  document.querySelector('#notesEvent').onchange = event => {
    localStorage.setItem('tiger-selected-event', event.target.value);
    renderNotes();
  };
  document.querySelectorAll('[data-note-field]').forEach(field => field.oninput = () => {
    let updated = {};
    try { updated = JSON.parse(localStorage.getItem('tiger-event-notes') || '{}'); } catch {}
    updated[selectedEvent] = {
      ...(updated[selectedEvent] || {}),
      [field.dataset.noteField]: field.value,
      updatedAt: Date.now()
    };
    localStorage.setItem('tiger-event-notes', JSON.stringify(updated));
    document.querySelector('#notesStatus').textContent = 'Saved just now on this device.';
  });
}

function renderSettings() {
  const settings = tbaSettings();
  const lastSync = localStorage.getItem('tiger-tba-last-sync');
  const sqlLastSync = localStorage.getItem('tiger-sql-last-sync');
  const commandAccess = appMode() === 'command';
  view.innerHTML = `
    <section class="pagehead"><p class="eyebrow">DEVICE SETTINGS</p><h1>Connections & assets</h1><p>Tiger Scout stays offline by default. Connect briefly to enrich records, then take the downloaded data back offline.</p></section>
    <section class="settings-grid">
      <article class="settings-card cri-settings">
        <div class="connection-title"><span class="connection-logo cri">CRI</span><div><h2>CRI 2026 event setup</h2><p>${CRI_EVENT.fullName}</p></div></div>
        <p class="settings-copy"><b>${CRI_EVENT.tournamentDate}</b><br>${CRI_EVENT.location}<br>${CRI_EVENT.teams.length} registered robots, including 9072 and 9072B.</p>
        <button id="prepareCriSettings" class="primary">Prepare this device for CRI</button>
        <div class="sync-status ${localStorage.getItem('tiger-selected-event') === CRI_EVENT.name ? 'success' : ''}">${localStorage.getItem('tiger-selected-event') === CRI_EVENT.name ? 'CRI is the current scouting event. TBA event key is ready.' : 'Select CRI and preload its official event connection.'}</div>
      </article>
      <article class="settings-card cloud-settings">
        <div class="connection-title"><span class="connection-logo cloud">SQL</span><div><h2>Cloud database</h2><p>Optional D1 backup and multi-device synchronization</p></div></div>
        <label>Team sync token<input id="sqlSyncToken" type="password" value="${escapeHtml(localStorage.getItem('tiger-sql-token') || '')}" autocomplete="off" placeholder="Shared team token" ${commandAccess?'':'disabled'}></label>
        <p class="privacy-note">${commandAccess ? 'Command mode has exclusive permission to push and pull shared database records.' : 'Database synchronization is locked. Switch this device to Command mode to manage shared records.'}</p>
        <div class="settings-actions"><button id="saveSqlSync" class="secondary" ${commandAccess?'':'disabled'}>Save token</button><button id="runSqlSync" class="primary" ${commandAccess?'':'disabled'}>Sync database</button></div>
        <div id="sqlSyncStatus" class="sync-status">${commandAccess ? (sqlLastSync ? `Last database sync: ${escapeHtml(sqlLastSync)}` : 'Cloud sync is ready for Command mode') : 'Command mode required for database sync'}</div>
      </article>
      <article class="settings-card mode-settings">
        <div class="connection-title"><span class="connection-logo mode">MODE</span><div><h2>Device mode</h2><p>Choose whether this device scouts or focuses on the shared dataset</p></div></div>
        <label>App mode<select id="appMode">
          <option value="scouting" ${appMode()==='scouting'?'selected':''}>Full scouting mode</option>
          <option value="database" ${appMode()==='database'?'selected':''}>Database viewer mode</option>
          <option value="notes" ${appMode()==='notes'?'selected':''}>Scouter mode</option>
          <option value="matchprep" ${appMode()==='matchprep'?'selected':''}>Match Prep mode</option>
          <option value="command" ${appMode()==='command'?'selected':''}>Command mode</option>
        </select></label>
        <p class="privacy-note">Database viewer focuses on local analysis. Scouter mode focuses on entering match records. Match Prep adds projections and saved handoffs. Command mode reveals the active analysis tools and exclusively controls database sync.</p>
        <button id="saveAppMode" class="primary">Save device mode</button>
      </article>
      <article class="settings-card appearance-settings">
        <div class="connection-title"><span class="connection-logo theme">Aa</span><div><h2>Appearance</h2><p>Choose the display theme for this device</p></div></div>
        <label>Color theme<select id="colorTheme">
          <option value="dark" ${colorTheme()==='dark'?'selected':''}>Dark mode</option>
          <option value="light" ${colorTheme()==='light'?'selected':''}>Light mode</option>
        </select></label>
        <p class="privacy-note">The theme changes immediately and is saved only on this device.</p>
      </article>
      <article class="settings-card">
        <div class="connection-title"><span class="connection-logo">TBA</span><div><h2>The Blue Alliance</h2><p>Official event results and TOWER climb verification</p></div></div>
        <label>TBA API key<input id="tbaKey" type="password" value="${escapeHtml(settings.apiKey)}" autocomplete="off" placeholder="Optional for CRI"></label>
        <div class="grid">
          <label>Event key<input id="tbaEvent" value="${escapeHtml(settings.eventKey)}" placeholder="e.g. 2026mdpas"></label>
          <label>Season<input id="tbaYear" type="number" min="2026" max="2099" value="${escapeHtml(settings.year)}"></label>
        </div>
        <p class="privacy-note">CRI schedule sync is preconfigured and keeps the team API key off this device. A browser key is only needed for other events, season stats, or logo downloads.</p>
        <div class="settings-actions"><button id="saveTba" class="secondary">Save settings</button><button id="syncTba" class="primary">Sync event results</button></div>
        <div id="syncStatus" class="sync-status">${lastSync ? `Last successful sync: ${escapeHtml(lastSync)}` : 'Not synced yet'}</div>
        <div class="settings-divider"></div>
        <p class="settings-copy"><b>Team 9072 season record</b><br>Separate pull covering every official 2026 match available from TBA.</p>
        <button id="syncTbaSeason" class="secondary">Pull 9072 season win rate</button>
        <div id="tbaSeasonStatus" class="sync-status">${tbaSeasonStatusText()}</div>
      </article>
      <article class="settings-card statbotics-settings" hidden aria-hidden="true">
        <div class="connection-title"><span class="connection-logo statbotics">SB</span><div><h2>Statbotics</h2><p>Optional EPA and EPA ranking for Team 9072</p></div></div>
        ${(() => { const availability = statboticsAvailability(); return `<div id="statboticsIndicator" class="availability-badge ${availability.state}"><i></i>${availability.label}</div>`; })()}
        <label class="check"><input id="statboticsEnabled" type="checkbox" ${localStorage.getItem('tiger-statbotics-enabled')==='yes'?'checked':''}><span>Use Statbotics when available</span></label>
        <p class="privacy-note">Requests time out after eight seconds. If Statbotics is down, Tiger Scout ignores its data and continues normally.</p>
        <button id="syncStatbotics" class="secondary">Check Statbotics now</button>
        <div id="statboticsStatus" class="sync-status">${statboticsStatusText()}</div>
        <div class="settings-divider"></div>
        <button id="syncAllStatbotics" class="secondary">Pull EPA for dataset teams</button>
        <div id="statboticsTeamsStatus" class="sync-status">${Object.keys(statboticsTeamMap()).length ? `${Object.keys(statboticsTeamMap()).length} team EPA records cached.` : 'No dataset team EPA records cached yet.'}</div>
      </article>
      <article class="settings-card">
        <div class="connection-title"><span class="connection-logo tiger">9072</span><div><h2>Team logos</h2><p>Download team avatars for the current dataset</p></div></div>
        <p class="settings-copy">Logos are requested through The Blue Alliance and saved on this device so team numbers stay recognizable without internet.</p>
        <button id="downloadLogos" class="demo-button">Download dataset team logos</button>
        <div id="logoStatus" class="sync-status">Uses the API settings on this page</div>
      </article>
      <article class="settings-card admin-settings">
        <div class="connection-title"><span class="connection-logo lock">ED</span><div><h2>Data editor access</h2><p>Password-protected record management</p></div></div>
        ${adminSettingsMarkup()}
      </article>
    </section>`;

  const save = () => {
    localStorage.setItem('tiger-tba-key', document.querySelector('#tbaKey').value.trim());
    localStorage.setItem('tiger-tba-event', document.querySelector('#tbaEvent').value.trim().toLowerCase());
    localStorage.setItem('tiger-tba-year', document.querySelector('#tbaYear').value.trim());
  };
  document.querySelector('#prepareCriSettings').onclick = async () => {
    prepareCriDevice();
    await go('home');
  };
  document.querySelector('#saveTba').onclick = () => { save(); toast('TBA settings saved on this device.'); };
  document.querySelector('#syncTba').onclick = async () => { save(); await syncTbaEvent(); };
  document.querySelector('#syncTbaSeason').onclick = async () => { save(); await syncTbaSeasonRecord(); };
  document.querySelector('#downloadLogos').onclick = async () => { save(); await downloadTeamLogos(); };
  document.querySelector('#statboticsEnabled').onchange = event => {
    localStorage.setItem('tiger-statbotics-enabled', event.target.checked ? 'yes' : 'no');
    if (!event.target.checked) localStorage.removeItem('tiger-statbotics-9072');
    updateStatboticsIndicator();
    document.querySelector('#statboticsStatus').textContent = event.target.checked ? 'Enabled; checking availability…' : 'Statbotics is disabled.';
    if (event.target.checked) syncStatbotics();
  };
  document.querySelector('#syncStatbotics').onclick = syncStatbotics;
  document.querySelector('#syncAllStatbotics').onclick = syncAllStatboticsTeams;
  document.querySelector('#saveSqlSync').onclick = () => {
    localStorage.setItem('tiger-sql-token', document.querySelector('#sqlSyncToken').value.trim());
    toast('Database sync token saved on this device.');
  };
  document.querySelector('#runSqlSync').onclick = async () => {
    localStorage.setItem('tiger-sql-token', document.querySelector('#sqlSyncToken').value.trim());
    await syncSqlDatabase();
  };
  document.querySelector('#saveAppMode').onclick = async () => {
    localStorage.setItem('tiger-app-mode', document.querySelector('#appMode').value);
    applyAppMode();
    toast(appMode() === 'database' ? 'Database viewer mode enabled.' : appMode() === 'notes' ? 'Scouter mode enabled.' : appMode() === 'matchprep' ? 'Match Prep mode enabled.' : appMode() === 'command' ? 'Command mode enabled.' : 'Full scouting mode enabled.');
    await go(appMode() === 'database' ? 'data' : 'home');
  };
  document.querySelector('#colorTheme').onchange = event => {
    localStorage.setItem('tiger-color-theme', event.target.value);
    applyColorTheme();
    toast(`${event.target.value === 'light' ? 'Light' : 'Dark'} mode enabled.`);
  };
  bindAdminSettings();
}

async function syncSqlDatabase() {
  const status = document.querySelector('#sqlSyncStatus') || { textContent:'', className:'' };
  if (appMode() !== 'command') {
    status.textContent = 'Database sync is restricted to Command mode.';
    status.className = 'sync-status error';
    return;
  }
  const token = localStorage.getItem('tiger-sql-token') || '';
  if (!token) {
    status.textContent = 'Enter the shared team sync token first.';
    status.className = 'sync-status error';
    return;
  }
  if (!navigator.onLine) {
    status.textContent = 'This device is offline. Local data is safe; sync when a connection is available.';
    status.className = 'sync-status error';
    return;
  }
  status.textContent = 'Uploading local records...';
  status.className = 'sync-status working';
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  try {
    const localRecords = await records();
    for (let index = 0; index < localRecords.length; index += 500) {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers,
        body: JSON.stringify({ records: localRecords.slice(index, index + 500) })
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'The sync token was rejected.' : 'Upload failed.');
    }
    status.textContent = 'Downloading missing records...';
    const selectedEvent = localStorage.getItem('tiger-selected-event') || 'all';
    const since = Number(localStorage.getItem('tiger-sql-cursor') || 0);
    const response = await fetch(`/api/records?event=${encodeURIComponent(selectedEvent)}&since=${since}`, { headers });
    if (!response.ok) throw new Error(response.status === 401 ? 'The sync token was rejected.' : 'Download failed.');
    const result = await response.json();
    const db = await dbPromise;
    let added = 0;
    for (const record of result.records || []) {
      if (!record?.id || await db.get('records', record.id)) continue;
      await db.put('records', record);
      added++;
    }
    localStorage.setItem('tiger-sql-cursor', String(result.serverTime || Date.now()));
    const completed = new Date().toLocaleString();
    localStorage.setItem('tiger-sql-last-sync', completed);
    status.textContent = `Sync complete. Uploaded ${localRecords.length}; downloaded ${added} new records.`;
    status.className = 'sync-status success';
    toast('Cloud database sync complete.');
  } catch (error) {
    status.textContent = error.message || 'Database sync failed. Local records were not changed.';
    status.className = 'sync-status error';
  }
}

function bindAdminSettings() {
  const status = document.querySelector('#adminStatus');
  const setButton = document.querySelector('#setAdminPassword');
  if (setButton) setButton.onclick = async () => {
    const password = document.querySelector('#newAdminPassword').value;
    const confirmation = document.querySelector('#confirmAdminPassword').value;
    if (password.length < 4) {
      status.textContent = 'Password must contain at least 4 characters.';
      status.className = 'sync-status error';
      return;
    }
    if (password !== confirmation) {
      status.textContent = 'The passwords do not match.';
      status.className = 'sync-status error';
      return;
    }
    const salt = makeId();
    localStorage.setItem('tiger-admin-salt', salt);
    localStorage.setItem('tiger-admin-hash', await hashPassword(password, salt));
    sessionStorage.setItem('tiger-admin-unlocked', 'yes');
    updateAdminNav();
    toast('Editor password created.');
    renderSettings();
  };

  const unlockButton = document.querySelector('#unlockAdmin');
  if (unlockButton) unlockButton.onclick = async () => {
    if (adminUnlocked()) return go('editor');
    const password = document.querySelector('#adminPassword').value;
    const salt = localStorage.getItem('tiger-admin-salt') || '';
    const valid = await hashPassword(password, salt) === localStorage.getItem('tiger-admin-hash');
    if (!valid) {
      status.textContent = 'Incorrect password.';
      status.className = 'sync-status error';
      return;
    }
    sessionStorage.setItem('tiger-admin-unlocked', 'yes');
    updateAdminNav();
    toast('Data editor unlocked.');
    go('editor');
  };
  const lockButton = document.querySelector('#lockAdmin');
  if (lockButton) lockButton.onclick = () => {
    sessionStorage.removeItem('tiger-admin-unlocked');
    updateAdminNav();
    toast('Data editor locked.');
    renderSettings();
  };
  const changeButton = document.querySelector('#changeAdminPassword');
  if (changeButton) changeButton.onclick = async () => {
    const current = document.querySelector('#currentAdminPassword').value;
    const replacement = document.querySelector('#replacementAdminPassword').value;
    const salt = localStorage.getItem('tiger-admin-salt') || '';
    if (await hashPassword(current, salt) !== localStorage.getItem('tiger-admin-hash')) {
      status.textContent = 'Current password is incorrect.';
      status.className = 'sync-status error';
      return;
    }
    if (replacement.length < 4) {
      status.textContent = 'New password must contain at least 4 characters.';
      status.className = 'sync-status error';
      return;
    }
    const newSalt = makeId();
    localStorage.setItem('tiger-admin-salt', newSalt);
    localStorage.setItem('tiger-admin-hash', await hashPassword(replacement, newSalt));
    status.textContent = 'Password changed successfully.';
    status.className = 'sync-status success';
  };
}

function tbaHeaders(key) {
  return { 'X-TBA-Auth-Key': key, 'Accept': 'application/json' };
}

function officialRobotValue(breakdown, robotNumber, phase) {
  if (!breakdown) return null;
  const number = String(robotNumber);
  const keys = Object.keys(breakdown);
  const exact = keys.find(key => {
    const lower = key.toLowerCase();
    return lower.includes(`robot${number}`) && lower.includes('tower') && lower.includes(phase);
  }) || keys.find(key => {
    const lower = key.toLowerCase();
    return lower.includes(`robot${number}`) && lower.includes(phase);
  });
  return exact ? breakdown[exact] : null;
}

async function syncTbaEvent() {
  const settings = tbaSettings();
  const status = document.querySelector('#syncStatus');
  const builtInCri = settings.eventKey === CRI_EVENT.tbaKey;
  if (!settings.eventKey || (!settings.apiKey && !builtInCri)) {
    status.textContent = 'Enter an event key and API key. CRI can sync without a browser API key.';
    status.className = 'sync-status error';
    return;
  }
  status.textContent = 'Downloading official match results...';
  status.className = 'sync-status working';
  try {
    const response = await fetch(builtInCri && !settings.apiKey
      ? '/api/tba/cri/matches'
      : `https://www.thebluealliance.com/api/v3/event/${encodeURIComponent(settings.eventKey)}/matches`,
    builtInCri && !settings.apiKey ? {} : { headers: tbaHeaders(settings.apiKey) });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.error || (response.status === 401 || response.status === 403 ? 'API key was rejected.' : `TBA returned ${response.status}.`));
    }
    const matches = await response.json();
    localStorage.setItem('tiger-tba-schedule', JSON.stringify(matches.filter(match => match.comp_level === 'qm').map(match => ({
      key: match.key,
      number: match.match_number,
      time: match.predicted_time || match.time || 0,
      red: (match.alliances?.red?.team_keys || []).map(team => team.replace('frc','')),
      blue: (match.alliances?.blue?.team_keys || []).map(team => team.replace('frc','')),
      redScore: match.alliances?.red?.score ?? -1,
      blueScore: match.alliances?.blue?.score ?? -1
    }))));
    const allRecords = await records();
    const selectedEvent = localStorage.getItem('tiger-selected-event') || 'all';
    const all = selectedEvent === 'all' ? allRecords : allRecords.filter(r => (r.event || 'Unspecified event') === selectedEvent);
    const db = await dbPromise;
    let enriched = 0;
    for (const match of matches.filter(m => m.comp_level === 'qm' && m.score_breakdown)) {
      for (const color of ['red','blue']) {
        const alliance = match.alliances?.[color];
        const breakdown = match.score_breakdown?.[color];
        if (!alliance || !breakdown) continue;
        for (let index = 0; index < alliance.team_keys.length; index++) {
          const team = alliance.team_keys[index].replace('frc','');
          const matching = all.filter(r => String(r.team) === team && Number(r.match) === Number(match.match_number));
          for (const record of matching) {
            record.tbaMatchKey = match.key;
            record.tbaAllianceScore = alliance.score;
            record.tbaAutoTower = officialRobotValue(breakdown, index + 1, 'auto');
            record.tbaEndgameTower = officialRobotValue(breakdown, index + 1, 'end');
            record.tbaSyncedAt = Date.now();
            await db.put('records', record);
            enriched++;
          }
        }
      }
    }
    const stamp = new Date().toLocaleString();
    localStorage.setItem('tiger-tba-last-sync', stamp);
    status.textContent = `Synced ${matches.length} matches and enriched ${enriched} local records.`;
    status.className = 'sync-status success';
    toast('Official TBA results synced.');
  } catch (error) {
    status.textContent = error.message || 'Could not connect to The Blue Alliance.';
    status.className = 'sync-status error';
  }
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function selectTbaRobotPhoto(media) {
  const supportedTypes = new Set(['imgur', 'cdphotothread', 'instagram-image']);
  return (Array.isArray(media) ? media : [])
    .filter(item => supportedTypes.has(item?.type) && /^https:\/\//i.test(item?.direct_url || ''))
    .sort((a, b) => Number(Boolean(b.preferred)) - Number(Boolean(a.preferred)))[0] || null;
}

async function fetchTbaTeamPhoto(team) {
  const settings = tbaSettings();
  const year = settings.year || String(new Date().getFullYear());
  const hostedResponse = await fetch(`/api/tba/team-photo?team=${encodeURIComponent(team)}&year=${encodeURIComponent(year)}`);
  if (hostedResponse.ok) {
    const blob = await hostedResponse.blob();
    if (!blob.type.startsWith('image/')) throw new Error('The downloaded file was not an image.');
    return { blob, year, sourceUrl: hostedResponse.headers.get('x-tiger-photo-source') || '' };
  }
  const hostedError = await hostedResponse.json().catch(() => null);
  if (!settings.apiKey) throw new Error(hostedError?.error || 'Add a TBA API key in Settings, then try again.');
  const mediaResponse = await fetch(`https://www.thebluealliance.com/api/v3/team/frc${encodeURIComponent(team)}/media/${encodeURIComponent(year)}`, {
    headers: tbaHeaders(settings.apiKey)
  });
  if (!mediaResponse.ok) throw new Error(mediaResponse.status === 401 || mediaResponse.status === 403 ? 'The TBA API key was rejected.' : `The Blue Alliance returned ${mediaResponse.status}.`);
  const photo = selectTbaRobotPhoto(await mediaResponse.json());
  if (!photo) throw new Error(`No robot photo is available for Team ${team} in ${year}.`);
  const imageResponse = await fetch(photo.direct_url, { headers: { 'Accept': 'image/*' } });
  if (!imageResponse.ok) throw new Error('The team photo could not be downloaded.');
  const blob = await imageResponse.blob();
  if (!blob.type.startsWith('image/')) throw new Error('The downloaded file was not an image.');
  return { blob, year, sourceUrl: photo.view_url || photo.direct_url };
}

async function downloadTeamLogos() {
  const settings = tbaSettings();
  const status = document.querySelector('#logoStatus');
  if (!settings.apiKey) {
    status.textContent = 'Enter and save a TBA API key first.';
    status.className = 'sync-status error';
    return;
  }
  const teams = [...new Set((await records()).map(r => String(r.team)))];
  if (!teams.length) {
    status.textContent = 'There are no teams in the dataset yet.';
    return;
  }
  status.textContent = `Downloading logos for ${teams.length} teams...`;
  status.className = 'sync-status working';
  const db = await dbPromise;
  let saved = 0;
  for (let start = 0; start < teams.length; start += 6) {
    const batch = teams.slice(start, start + 6);
    await Promise.all(batch.map(async team => {
      try {
        const response = await fetch(`https://www.thebluealliance.com/api/v3/team/frc${team}/media/${settings.year}`, {
          headers: tbaHeaders(settings.apiKey)
        });
        if (!response.ok) return;
        const media = await response.json();
        const avatar = media.find(item => item.type === 'avatar') || media.find(item => item.preferred && (item.direct_url || item.view_url));
        if (!avatar) return;
        let dataUrl = avatar.details?.base64Image ? `data:image/png;base64,${avatar.details.base64Image}` : null;
        if (!dataUrl) {
          const imageUrl = avatar.direct_url || avatar.view_url;
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) return;
          dataUrl = await blobToDataUrl(await imageResponse.blob());
        }
        await db.put('assets', { id:`team-logo-${team}`, team, year:settings.year, dataUrl, source:'tba', savedAt:Date.now() });
        saved++;
      } catch {}
    }));
    status.textContent = `Downloaded ${saved} logos...`;
  }
  status.textContent = `Saved ${saved} of ${teams.length} available team logos for offline use.`;
  status.className = 'sync-status success';
  toast(`${saved} team logos downloaded.`);
}

async function teamLogoMap() {
  const assets = await (await dbPromise).getAll('assets');
  return Object.fromEntries(assets.filter(a => a.id?.startsWith('team-logo-') && a.team && a.dataUrl).map(a => [String(a.team), a.dataUrl]));
}

function teamIdentity(team, logos) {
  const logo = logos?.[String(team)];
  return `<span class="team-identity">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : '<i aria-hidden="true"></i>'}<b>${escapeHtml(team)}</b></span>`;
}

const picklistDefaults = { fuel: 10, auto: 7, tower: 7, defense: 2, reliability: 8, consistency: 5 };
const picklistLabels = {
  fuel: ['FUEL output', 'Average AUTO + TELEOP FUEL'],
  auto: ['Autonomous', 'Average AUTO FUEL'],
  tower: ['TOWER', 'Average TOWER points'],
  defense: ['Defense', 'Average scout defense rating'],
  reliability: ['Reliability', 'Percent of matches completed'],
  consistency: ['Consistency', 'Rewards predictable performance']
};

function readPicklistSettings() {
  try { return {...picklistDefaults, ...JSON.parse(localStorage.getItem('tiger-picklist-weights') || '{}')}; }
  catch { return {...picklistDefaults}; }
}

async function renderPicklist() {
  const allRecords = await records();
  const selectedEvent = localStorage.getItem('tiger-selected-event') || 'all';
  const all = selectedEvent === 'all' ? allRecords : allRecords.filter(r => (r.event || 'Unspecified event') === selectedEvent);
  const logos = await teamLogoMap();
  const weights = readPicklistSettings();
  let excluded = [];
  try { excluded = JSON.parse(localStorage.getItem('tiger-picklist-excluded') || '[]'); } catch {}

  if (!all.length) {
    view.innerHTML = `
      <section class="pagehead"><p class="eyebrow">ALLIANCE SELECTION</p><h1>Build your picklist</h1><p>Your rankings will connect directly to the scouting dataset.</p></section>
      <section class="empty"><span>★</span><h2>Scouting data needed</h2><p>Collect records or load the simulated REBUILT event to configure a picklist.</p><button id="picklistDemo" class="demo-button">Load 360 test records</button></section>`;
    document.querySelector('#picklistDemo').onclick = async () => { await generateDemoData(); await go('picklist'); };
    return;
  }

  const grouped = {};
  all.forEach(r => (grouped[r.team] ||= []).push(r));
  const teams = Object.entries(grouped).map(([team, rs]) => {
    const fuels = rs.map(r => Number(r.autoFuel || 0) + Number(r.teleFuel || 0));
    const avgFuel = fuels.reduce((a,b)=>a+b,0) / rs.length;
    const variance = fuels.reduce((sum,x)=>sum+(x-avgFuel)**2,0) / rs.length;
    return {
      team,
      matches: rs.length,
      fuel: avgFuel,
      auto: rs.reduce((s,r)=>s+Number(r.autoFuel || 0),0) / rs.length,
      tower: rs.reduce((s,r)=>s+({None:0,'Level 1':10,'Level 2':20,'Level 3':30}[r.teleTower] || 0),0) / rs.length,
      defense: rs.reduce((s,r)=>s+Number(r.defense || 0),0) / rs.length,
      reliability: rs.filter(r=>!r.broke).length / rs.length * 100,
      consistency: Math.max(0, 100 - Math.sqrt(variance) * 2),
      rs
    };
  });
  const ranges = {};
  Object.keys(picklistDefaults).forEach(key => {
    const values = teams.map(t => t[key]);
    ranges[key] = { min: Math.min(...values), max: Math.max(...values) };
  });
  const totalWeight = Object.values(weights).reduce((a,b)=>a+Number(b),0) || 1;
  teams.forEach(team => {
    team.pickScore = Object.keys(picklistDefaults).reduce((sum,key) => {
      const range = ranges[key];
      const normalized = range.max === range.min ? 1 : (team[key] - range.min) / (range.max - range.min);
      return sum + normalized * Number(weights[key]);
    }, 0) / totalWeight * 100;
  });
  teams.sort((a,b) => {
    const aExcluded = excluded.includes(a.team);
    const bExcluded = excluded.includes(b.team);
    return aExcluded - bExcluded || b.pickScore - a.pickScore;
  });

  const metricsView = `
    <section class="picklist-layout">
      <aside class="weight-card">
        <div><p class="eyebrow">YOUR STRATEGY</p><h2>Metric weights</h2></div>
        <div class="preset-row"><button data-preset="balanced">Balanced</button><button data-preset="offense">Offense</button><button data-preset="defense">Defense</button></div>
        ${Object.entries(picklistLabels).map(([key,[label,description]]) => `
          <label class="weight-control">
            <span><b>${label}</b><output>${weights[key]}</output></span>
            <small>${description}</small>
            <input type="range" min="0" max="10" step="1" value="${weights[key]}" data-weight="${key}">
          </label>`).join('')}
        <p class="weight-note">Set a metric to 0 to remove it from the ranking formula. Settings stay on this device.</p>
      </aside>
      <section class="table-card picklist-table">
        <div class="table-title"><div><p class="eyebrow">LIVE RANKING</p><h2>Draft board</h2></div><small>${excluded.length} excluded</small></div>
        <div class="table-scroll"><table><thead><tr><th>Pick</th><th>Team</th><th>Fit</th><th>FUEL</th><th>AUTO</th><th>TOWER</th><th>Reliable</th><th></th></tr></thead>
        <tbody>${teams.map((x,i) => {
          const isExcluded = excluded.includes(x.team);
          return `<tr class="${isExcluded?'excluded-row':''}">
            <td><b>${isExcluded?'—':i + 1 - teams.slice(0,i).filter(t=>excluded.includes(t.team)).length}</b></td>
            <td><button class="team-link" data-pick-team="${escapeHtml(x.team)}">${teamIdentity(x.team, logos)}</button></td>
            <td><span class="fit-score">${x.pickScore.toFixed(0)}</span></td>
            <td>${x.fuel.toFixed(1)}</td><td>${x.auto.toFixed(1)}</td><td>${x.tower.toFixed(1)}</td><td>${Math.round(x.reliability)}%</td>
            <td><button class="exclude-button ${isExcluded?'restore':''}" data-exclude="${escapeHtml(x.team)}">${isExcluded?'Restore':'Exclude'}</button></td>
          </tr>`;
        }).join('')}</tbody></table></div>
      </section>
    </section>`;

  const storageSuffix = selectedEvent === 'all' ? 'all' : selectedEvent;
  let manualOrder = [];
  let roundPicks = {};
  let allianceTeams = [];
  try { manualOrder = JSON.parse(localStorage.getItem(`tiger-manual-order-${storageSuffix}`) || '[]'); } catch {}
  try { roundPicks = JSON.parse(localStorage.getItem(`tiger-round-picks-${storageSuffix}`) || '{}'); } catch {}
  try { allianceTeams = JSON.parse(localStorage.getItem(`tiger-alliance-${storageSuffix}`) || '[]'); } catch {}
  const teamIds = teams.map(team => team.team);
  manualOrder = [...manualOrder.filter(team => teamIds.includes(team)), ...teamIds.filter(team => !manualOrder.includes(team))];
  allianceTeams = allianceTeams.filter(team => teamIds.includes(team)).slice(0, 3);
  const orderedTeams = manualOrder.map(team => teams.find(item => item.team === team)).filter(Boolean);
  const roundOrder = { first: 1, second: 2, third: 3, backup: 4, avoid: 5, unassigned: 6 };
  const roundTeams = [...teams].sort((a, b) =>
    (roundOrder[roundPicks[a.team] || 'unassigned'] - roundOrder[roundPicks[b.team] || 'unassigned']) ||
    b.pickScore - a.pickScore
  );
  const allianceData = allianceTeams.map(team => teams.find(item => item.team === team)).filter(Boolean);
  const allianceAverage = key => allianceData.length ? allianceData.reduce((sum, team) => sum + team[key], 0) / allianceData.length : 0;
  const strengths = [];
  const weaknesses = [];
  if (allianceData.length) {
    if (allianceAverage('fuel') >= teams.reduce((s,t)=>s+t.fuel,0)/teams.length) strengths.push('Strong FUEL output');
    else weaknesses.push('Below-average FUEL output');
    if (allianceAverage('auto') >= teams.reduce((s,t)=>s+t.auto,0)/teams.length) strengths.push('Strong autonomous scoring');
    else weaknesses.push('Autonomous scoring needs support');
    if (allianceAverage('tower') >= teams.reduce((s,t)=>s+t.tower,0)/teams.length) strengths.push('Reliable TOWER potential');
    else weaknesses.push('Limited TOWER scoring');
    if (allianceAverage('reliability') >= 90) strengths.push('High reliability');
    else weaknesses.push('Breakdown risk');
    if (allianceAverage('defense') >= 3) strengths.push('Capable defense');
    else weaknesses.push('Limited defensive pressure');
  }

  const manualView = `
    <section class="table-card pick-subview">
      <div class="table-title"><div><p class="eyebrow">YOUR ORDER</p><h2>Manual board</h2></div><small>Drag teams into your preferred order</small></div>
      <div class="manual-list">${orderedTeams.map((team, index) => `
        <article data-manual-team="${escapeHtml(team.team)}" draggable="true">
          <span class="drag-handle" aria-label="Drag team ${escapeHtml(team.team)}" title="Drag to reorder">⠿</span>
          <b class="manual-rank">${index + 1}</b>
          <button class="team-link" data-pick-team="${escapeHtml(team.team)}">${teamIdentity(team.team, logos)}</button>
          <span class="fit-score">${team.pickScore.toFixed(0)}</span>
          <div><button data-move="${escapeHtml(team.team)}" data-direction="-1" ${index === 0 ? 'disabled' : ''}>↑</button><button data-move="${escapeHtml(team.team)}" data-direction="1" ${index === orderedTeams.length - 1 ? 'disabled' : ''}>↓</button></div>
        </article>`).join('')}</div>
    </section>`;

  const roundView = `
    <section class="table-card pick-subview">
      <div class="table-title"><div><p class="eyebrow">DRAFT PLAN</p><h2>Round picks</h2></div><small>Grouped by when you would select them</small></div>
      <div class="round-list">${roundTeams.map(team => `
        <article>
          <button class="team-link" data-pick-team="${escapeHtml(team.team)}">${teamIdentity(team.team, logos)}</button>
          <span class="fit-score">${team.pickScore.toFixed(0)}</span>
          <select data-round-team="${escapeHtml(team.team)}" aria-label="Pick round for team ${escapeHtml(team.team)}">
            ${[['unassigned','Unassigned'],['first','1st round'],['second','2nd round'],['third','3rd round'],['backup','Backup'],['avoid','Do not pick']].map(([value,label])=>`<option value="${value}" ${(roundPicks[team.team] || 'unassigned')===value?'selected':''}>${label}</option>`).join('')}
          </select>
        </article>`).join('')}</div>
    </section>`;

  const allianceView = `
    <section class="alliance-builder">
      <section class="table-card">
        <div class="table-title"><div><p class="eyebrow">SELECTED ALLIANCE</p><h2>${allianceData.length} of 3 teams</h2></div></div>
        <div class="alliance-slots">${[0,1,2].map(index => {
          const team = allianceData[index];
          return team ? `<article>${teamIdentity(team.team, logos)}<button data-alliance-remove="${escapeHtml(team.team)}">Remove</button></article>` : `<article class="empty-slot">Choose team ${index + 1}</article>`;
        }).join('')}</div>
        <div class="alliance-pool">${teams.filter(team => !allianceTeams.includes(team.team)).map(team => `<button data-alliance-add="${escapeHtml(team.team)}" ${allianceTeams.length >= 3 ? 'disabled' : ''}>${teamIdentity(team.team, logos)}<span>${team.pickScore.toFixed(0)}</span></button>`).join('')}</div>
      </section>
      <section class="alliance-report">
        <article class="strength-card"><p class="eyebrow">STRENGTHS</p>${strengths.length ? `<ul>${strengths.map(item=>`<li>${item}</li>`).join('')}</ul>` : '<p>Select teams to analyze the alliance.</p>'}</article>
        <article class="weakness-card"><p class="eyebrow">WEAKNESSES</p>${weaknesses.length ? `<ul>${weaknesses.map(item=>`<li>${item}</li>`).join('')}</ul>` : '<p>Select teams to reveal potential gaps.</p>'}</article>
      </section>
    </section>`;

  const pickView = localStorage.getItem('tiger-picklist-view') || 'manual';
  const views = { manual: manualView, rounds: roundView, alliance: allianceView, metrics: metricsView };
  view.innerHTML = `
    <section class="pagehead picklist-head"><p class="eyebrow">ALLIANCE SELECTION${selectedEvent==='all'?'':` • ${escapeHtml(selectedEvent)}`}</p><h1>Configurable picklist</h1><p>Build a manual board, plan each round, inspect your alliance, or tune the metric ranking.</p></section>
    <nav class="picklist-subtabs" aria-label="Picklist views">
      <button data-pick-view="manual" class="${pickView==='manual'?'active':''}">Manual board</button>
      <button data-pick-view="rounds" class="${pickView==='rounds'?'active':''}">Round picks</button>
      <button data-pick-view="alliance" class="${pickView==='alliance'?'active':''}">Alliance</button>
      <button data-pick-view="metrics" class="${pickView==='metrics'?'active':''}">Metrics</button>
    </nav>
    ${views[pickView] || manualView}`;

  document.querySelectorAll('[data-pick-view]').forEach(button => button.onclick = () => {
    localStorage.setItem('tiger-picklist-view', button.dataset.pickView);
    renderPicklist();
  });
  document.querySelectorAll('[data-move]').forEach(button => button.onclick = () => {
    const index = manualOrder.indexOf(button.dataset.move);
    const next = index + Number(button.dataset.direction);
    if (index < 0 || next < 0 || next >= manualOrder.length) return;
    [manualOrder[index], manualOrder[next]] = [manualOrder[next], manualOrder[index]];
    localStorage.setItem(`tiger-manual-order-${storageSuffix}`, JSON.stringify(manualOrder));
    renderPicklist();
  });
  const saveManualOrder = () => {
    manualOrder = [...document.querySelectorAll('[data-manual-team]')].map(item => item.dataset.manualTeam);
    localStorage.setItem(`tiger-manual-order-${storageSuffix}`, JSON.stringify(manualOrder));
    document.querySelectorAll('[data-manual-team]').forEach((item, index) => {
      item.querySelector('.manual-rank').textContent = index + 1;
    });
  };
  const manualList = document.querySelector('.manual-list');
  if (manualList) {
    let draggedItem = null;
    let pointerItem = null;
    manualList.querySelectorAll('[data-manual-team]').forEach(item => {
      item.addEventListener('dragstart', event => {
        draggedItem = item;
        item.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.dataset.manualTeam);
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        saveManualOrder();
      });
      item.addEventListener('dragover', event => {
        event.preventDefault();
        if (!draggedItem || draggedItem === item) return;
        const box = item.getBoundingClientRect();
        manualList.insertBefore(draggedItem, event.clientY < box.top + box.height / 2 ? item : item.nextSibling);
      });
      const handle = item.querySelector('.drag-handle');
      handle.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse') return;
        pointerItem = item;
        item.classList.add('dragging');
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      handle.addEventListener('pointermove', event => {
        if (!pointerItem) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-manual-team]');
        if (!target || target === pointerItem || target.parentElement !== manualList) return;
        const box = target.getBoundingClientRect();
        manualList.insertBefore(pointerItem, event.clientY < box.top + box.height / 2 ? target : target.nextSibling);
      });
      const finishPointerDrag = () => {
        if (!pointerItem) return;
        pointerItem.classList.remove('dragging');
        pointerItem = null;
        saveManualOrder();
      };
      handle.addEventListener('pointerup', finishPointerDrag);
      handle.addEventListener('pointercancel', finishPointerDrag);
    });
  }
  document.querySelectorAll('[data-round-team]').forEach(select => select.onchange = () => {
    roundPicks[select.dataset.roundTeam] = select.value;
    localStorage.setItem(`tiger-round-picks-${storageSuffix}`, JSON.stringify(roundPicks));
    renderPicklist();
  });
  document.querySelectorAll('[data-alliance-add]').forEach(button => button.onclick = () => {
    if (allianceTeams.length >= 3) return;
    allianceTeams.push(button.dataset.allianceAdd);
    localStorage.setItem(`tiger-alliance-${storageSuffix}`, JSON.stringify(allianceTeams));
    renderPicklist();
  });
  document.querySelectorAll('[data-alliance-remove]').forEach(button => button.onclick = () => {
    allianceTeams = allianceTeams.filter(team => team !== button.dataset.allianceRemove);
    localStorage.setItem(`tiger-alliance-${storageSuffix}`, JSON.stringify(allianceTeams));
    renderPicklist();
  });

  document.querySelectorAll('[data-weight]').forEach(input => input.oninput = () => {
    weights[input.dataset.weight] = Number(input.value);
    localStorage.setItem('tiger-picklist-weights', JSON.stringify(weights));
    renderPicklist();
  });
  document.querySelectorAll('[data-preset]').forEach(button => button.onclick = () => {
    const presets = {
      balanced: picklistDefaults,
      offense: {fuel:10,auto:9,tower:5,defense:0,reliability:7,consistency:4},
      defense: {fuel:3,auto:2,tower:5,defense:10,reliability:9,consistency:7}
    };
    localStorage.setItem('tiger-picklist-weights', JSON.stringify(presets[button.dataset.preset]));
    renderPicklist();
  });
  document.querySelectorAll('[data-exclude]').forEach(button => button.onclick = () => {
    const team = button.dataset.exclude;
    excluded = excluded.includes(team) ? excluded.filter(x=>x!==team) : [...excluded, team];
    localStorage.setItem('tiger-picklist-excluded', JSON.stringify(excluded));
    renderPicklist();
  });
  document.querySelectorAll('[data-pick-team]').forEach(button => button.onclick = () => showTeam(button.dataset.pickTeam, grouped[button.dataset.pickTeam]));
}

async function renderEditor() {
  if (!adminUnlocked()) return go('settings');
  const all = await records();
  const events = [...new Set(all.map(r => r.event || 'Unspecified event'))].sort();
  if (editorEvent !== 'all' && !events.includes(editorEvent)) editorEvent = 'all';
  const query = editorSearch.trim().toLowerCase();
  const filtered = all
    .filter(r => editorEvent === 'all' || (r.event || 'Unspecified event') === editorEvent)
    .filter(r => !query || [r.team,r.match,r.event,r.scout,r.notes].some(value => String(value || '').toLowerCase().includes(query)))
    .sort((a,b) => String(a.event).localeCompare(String(b.event)) || Number(a.match)-Number(b.match) || Number(a.team)-Number(b.team));

  view.innerHTML = `
    <section class="pagehead editor-head">
      <div><p class="eyebrow">PASSWORD-PROTECTED</p><h1>Data editor</h1><p>Edit the underlying scouting records. Changes immediately affect charts, rankings, and picklists.</p></div>
      <button id="lockEditor" class="secondary">Lock editor</button>
    </section>
    <section class="editor-toolbar">
      <label>Event<select id="editorEvent"><option value="all">All saved events</option>${events.map(event=>`<option value="${escapeHtml(event)}" ${editorEvent===event?'selected':''}>${escapeHtml(event)}</option>`).join('')}</select></label>
      <label>Search records<input id="editorSearch" value="${escapeHtml(editorSearch)}" placeholder="Team, match, scout, or notes"></label>
      <span><b>${filtered.length}</b> of ${all.length} records</span>
    </section>
    <section class="editor-table-card">
      <div class="table-scroll"><table class="editor-table">
        <thead><tr><th>Event</th><th>Match</th><th>Team</th><th>Scout</th><th>AUTO FUEL</th><th>TELEOP FUEL</th><th>AUTO TOWER</th><th>ENDGAME</th><th>Defense rating</th><th>Played defense</th><th>Fouls</th><th>Disabled</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>${filtered.map(record => `
          <tr data-editor-id="${escapeHtml(record.id)}">
            <td><input data-field="event" value="${escapeHtml(record.event)}"></td>
            <td><input data-field="match" type="number" min="1" value="${escapeHtml(record.match)}"></td>
            <td><input data-field="team" inputmode="numeric" value="${escapeHtml(record.team)}"></td>
            <td><input data-field="scout" value="${escapeHtml(record.scout)}"></td>
            <td>${fuelEditorCell(record, 'auto')}</td>
            <td>${fuelEditorCell(record, 'tele')}</td>
            <td><select data-field="autoTower">${['None','Level 1'].map(value=>`<option ${record.autoTower===value?'selected':''}>${value}</option>`).join('')}</select></td>
            <td><select data-field="teleTower">${['None','Level 1','Level 2','Level 3'].map(value=>`<option ${record.teleTower===value?'selected':''}>${value}</option>`).join('')}</select></td>
            <td><input data-field="defense" type="number" min="0" max="5" value="${Number(record.defense || 0)}"></td>
            <td><select data-field="playedDefense" aria-label="Played defense"><option value="" ${typeof record.playedDefense !== 'boolean'?'selected':''}>Not recorded</option><option value="true" ${record.playedDefense === true?'selected':''}>Yes</option><option value="false" ${record.playedDefense === false?'selected':''}>No</option></select></td>
            <td><input data-field="fouls" type="number" min="0" value="${Number(record.fouls || 0)}"></td>
            <td class="editor-check"><input data-field="broke" type="checkbox" ${record.broke?'checked':''}></td>
            <td><textarea data-field="notes" rows="2">${escapeHtml(record.notes)}</textarea></td>
            <td><div class="row-actions"><button class="save-row" data-save-record="${escapeHtml(record.id)}">Save</button><button class="delete-row" data-delete-record="${escapeHtml(record.id)}">Delete</button></div></td>
          </tr>`).join('')}</tbody>
      </table></div>
      ${filtered.length ? '' : '<div class="editor-empty">No records match this filter.</div>'}
    </section>`;

  document.querySelector('#lockEditor').onclick = () => {
    sessionStorage.removeItem('tiger-admin-unlocked');
    updateAdminNav();
    toast('Data editor locked.');
    go('settings');
  };
  document.querySelector('#editorEvent').onchange = event => {
    editorEvent = event.target.value;
    renderEditor();
  };
  document.querySelector('#editorSearch').onchange = event => {
    editorSearch = event.target.value;
    renderEditor();
  };
  document.querySelector('#editorSearch').onkeydown = event => {
    if (event.key !== 'Enter') return;
    editorSearch = event.target.value;
    renderEditor();
  };
  document.querySelectorAll('[data-save-record]').forEach(button => button.onclick = async () => {
    const db = await dbPromise;
    const record = await db.get('records', button.dataset.saveRecord);
    const row = button.closest('tr');
    if (!record || !row) return;
    for (const input of row.querySelectorAll('input')) {
      if (!input.reportValidity()) return;
    }
    for (const phase of ['auto', 'tele']) {
      const rate = row.querySelector(`[data-field="${phase}FuelRate"]`);
      const seconds = row.querySelector(`[data-field="${phase}FuelSeconds"]`);
      if (rate && Number(rate.value) > 0 && Number(seconds.value) <= 0) {
        toast('Enter seconds spent scoring for each nonzero flow rate.', true);
        seconds.focus();
        return;
      }
    }
    row.querySelectorAll('[data-field]').forEach(input => {
      const field = input.dataset.field;
      if (field === 'playedDefense') {
        if (input.value === '') delete record.playedDefense;
        else record.playedDefense = input.value === 'true';
      }
      else if (input.type === 'checkbox') record[field] = input.checked;
      else if (['autoFuel','teleFuel','autoFuelRate','teleFuelRate','autoFuelSeconds','teleFuelSeconds','defense','fouls'].includes(field)) record[field] = Math.max(0, Number(input.value) || 0);
      else record[field] = input.value.trim();
    });
    for (const phase of ['auto', 'tele']) {
      if (record[`${phase}FuelRate`] == null) continue;
      updateFuelEstimate(record, phase);
      row.querySelector(`[data-field="${phase}Fuel"]`).value = record[`${phase}Fuel`];
    }
    record.editedAt = Date.now();
    await db.put('records', record);
    button.textContent = 'Saved';
    button.classList.add('saved');
    toast(`Team ${record.team}, match ${record.match} updated.`);
    setTimeout(() => { button.textContent = 'Save'; button.classList.remove('saved'); }, 1200);
  });
  document.querySelectorAll('[data-delete-record]').forEach(button => button.onclick = async () => {
    if (!confirm('Permanently delete this scouting record?')) return;
    const db = await dbPromise;
    await db.delete('records', button.dataset.deleteRecord);
    toast('Record deleted.');
    renderEditor();
  });
}

function resizeTeamPhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const source = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(source);
      resolve(canvas.toDataURL('image/jpeg', .82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error('Invalid image'));
    };
    image.src = source;
  });
}

async function showTeam(team, rs) {
  if (chart) chart.destroy();
  const logos = await teamLogoMap();
  const db = await dbPromise;
  const savedPhoto = await db.get('assets', `team-photo-${team}`);
  const teamStatbotics = statboticsTeamMap()[String(team)];
  const sorted = [...rs].sort((a,b)=>Number(a.match)-Number(b.match));
  const totals = sorted.map(r => Number(r.autoFuel || 0) + Number(r.teleFuel || 0));
  const pointTotals = sorted.map(record => score(record));
  const averagePoints = pointTotals.reduce((sum, points) => sum + points, 0) / pointTotals.length;
  const minimumPoints = Math.min(...pointTotals);
  const maximumPoints = Math.max(...pointTotals);
  const sample = Math.min(3, Math.floor(totals.length / 2));
  const earlyAverage = sample ? totals.slice(0, sample).reduce((a,b)=>a+b,0) / sample : totals[0] || 0;
  const recentAverage = sample ? totals.slice(-sample).reduce((a,b)=>a+b,0) / sample : totals[0] || 0;
  const change = recentAverage - earlyAverage;
  const trend = totals.length < 2 ? { label:'More matches needed', className:'flat', symbol:'•' } :
    change > 4 ? { label:`Trending up +${change.toFixed(1)} FUEL`, className:'up', symbol:'↗' } :
    change < -4 ? { label:`Trending down ${change.toFixed(1)} FUEL`, className:'down', symbol:'↘' } :
    { label:'Holding steady', className:'flat', symbol:'→' };
  view.innerHTML = `
    <button class="back" data-go="data">← All teams</button>
    <section class="team-title"><div><p class="eyebrow">TEAM PROFILE</p><h1>${teamIdentity(team, logos)}</h1></div>
      <div class="team-point-range">
        <span><strong>${minimumPoints.toFixed(0)}</strong><small>MIN PTS</small></span>
        <span class="average"><strong>${averagePoints.toFixed(1)}</strong><small>AVG PTS</small></span>
        <span><strong>${maximumPoints.toFixed(0)}</strong><small>MAX PTS</small></span>
        ${teamStatbotics ? `<span><strong>${Number(teamStatbotics.epa).toFixed(1)}</strong><small>EPA</small></span>
        <span><strong>${teamStatbotics.rank ? `#${escapeHtml(teamStatbotics.rank)}` : '—'}</strong><small>EPA RANK</small></span>` : ''}
      </div>
    </section>
    <section class="team-photo-card">
      <div class="team-photo-preview">${savedPhoto?.dataUrl ? `<img src="${escapeHtml(savedPhoto.dataUrl)}" alt="Saved robot photo for Team ${escapeHtml(team)}">` : '<span>No team photo saved</span>'}</div>
      <div><p class="eyebrow">TEAM PHOTO</p><h2>Robot reference</h2><p>Take or choose a picture, or pull the current-season robot photo from The Blue Alliance while online. Once saved, it stays available offline with Team ${escapeHtml(team)}.</p>
        <div class="team-photo-actions">
          <label class="demo-button team-photo-button">Take or choose photo<input id="teamPhotoInput" type="file" accept="image/*" capture="environment"></label>
          <button id="pullTeamPhotoTba" class="secondary team-photo-tba" type="button">Pull from Blue Alliance</button>
          ${savedPhoto?.dataUrl ? '<button id="removeTeamPhoto" class="secondary" type="button">Remove photo</button>' : ''}
        </div>
        <small class="team-photo-source">Internet required for Blue Alliance lookup.${savedPhoto?.source === 'tba-media' ? ` Saved from the ${escapeHtml(savedPhoto.year)} season.` : ''}</small>
      </div>
    </section>
    <section class="chart-card team-trend">
      <div class="trend-heading"><div><p class="eyebrow">PERFORMANCE TREND</p><h2>Total FUEL by match</h2></div><strong class="${trend.className}">${trend.symbol} ${trend.label}</strong></div>
      <div class="chartbox"><canvas id="teamFuelChart" role="img" aria-label="Line chart of Team ${escapeHtml(team)} total FUEL scored in each match"></canvas></div>
      <p class="chart-note">Total FUEL combines autonomous and teleoperated FUEL scored in the active HUB. Flow-rate records estimate FUEL as BSP × seconds scoring.</p>
    </section>
    <section class="match-grid">${sorted.map(r=>`
      <article><div><span>Match ${escapeHtml(r.match)}</span><b>${score(r)} pts</b></div>
      <dl>${fuelMatchReadout(r, 'auto', 'AUTO')}${fuelMatchReadout(r, 'tele', 'TELEOP')}<dt>AUTO TOWER</dt><dd>${r.autoTower || 'None'}</dd><dt>ENDGAME TOWER</dt><dd>${r.teleTower || 'None'}</dd>${r.tbaEndgameTower != null?`<dt>TBA VERIFIED</dt><dd class="verified">✓ ${escapeHtml(r.tbaEndgameTower)}</dd>`:''}<dt>Defense rating</dt><dd>${r.defense}/5</dd><dt>Played defense</dt><dd>${typeof r.playedDefense === 'boolean' ? (r.playedDefense ? 'Yes' : 'No') : 'Not recorded'}</dd><dt>Field access</dt><dd>${[r.trench?'Trench':'',r.bump?'Bump':''].filter(Boolean).join(' + ') || 'Standard'}</dd></dl>
      ${r.broke?'<p class="warning">⚠ Robot disabled</p>':''}${r.notes?`<p class="notes">“${escapeHtml(r.notes)}”</p>`:''}</article>`).join('')}</section>`;
  document.querySelector('#teamPhotoInput').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeTeamPhoto(file);
      await db.put('assets', { id:`team-photo-${team}`, team:String(team), dataUrl, savedAt:Date.now() });
      toast(`Photo saved for Team ${team}.`);
      await showTeam(team, rs);
    } catch {
      toast('That photo could not be saved.', true);
    }
  };
  document.querySelector('#pullTeamPhotoTba').onclick = async event => {
    if (!navigator.onLine) {
      toast('Connect to the internet to pull a Blue Alliance photo.', true);
      return;
    }
    const button = event.currentTarget;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Looking up photo…';
    try {
      const photo = await fetchTbaTeamPhoto(team);
      const dataUrl = await resizeTeamPhoto(photo.blob);
      await db.put('assets', {
        id:`team-photo-${team}`,
        team:String(team),
        dataUrl,
        source:'tba-media',
        sourceUrl:photo.sourceUrl,
        year:photo.year,
        savedAt:Date.now()
      });
      toast(`Blue Alliance photo saved for Team ${team}.`);
      await showTeam(team, rs);
    } catch (error) {
      toast(error.message || 'The Blue Alliance photo could not be saved.', true);
      button.disabled = false;
      button.textContent = originalText;
    }
  };
  document.querySelector('#removeTeamPhoto')?.addEventListener('click', async () => {
    await db.delete('assets', `team-photo-${team}`);
    toast(`Photo removed for Team ${team}.`);
    await showTeam(team, rs);
  });
  chart = new Chart(document.querySelector('#teamFuelChart'), {
    type: 'line',
    data: {
      labels: sorted.map(r => `M${r.match}`),
      datasets: [{
        label: 'Total FUEL',
        data: totals,
        borderColor: '#d9823f',
        backgroundColor: 'rgba(217,130,63,.12)',
        pointBackgroundColor: '#d9a15f',
        pointBorderColor: '#121416',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 3,
        tension: .25,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: context => `${context.parsed.y} FUEL` } }
      },
      scales: {
        x: { title:{display:true,text:'Match',color:'#9da4aa'}, grid:{display:false}, ticks:{color:'#9da4aa'} },
        y: { beginAtZero:true, title:{display:true,text:'Total FUEL',color:'#9da4aa'}, ticks:{color:'#9da4aa',precision:0}, grid:{color:'#353a3f'} }
      }
    }
  });
}

async function generateDemoData() {
  const teams = [9072, 449, 540, 612, 836, 888, 1111, 1389, 1418, 1629, 1719, 1731,
    1885, 1895, 1908, 2068, 2186, 2363, 2377, 2421, 2534, 2890, 2963, 3136,
    3359, 3748, 401, 4099, 422, 4464, 4472, 4505, 5243, 5338, 6882, 8326];
  let seed = 90722026;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const vary = (mean, spread) => Math.max(0, Math.round(mean + (random()+random()+random()-1.5)*spread));
  const db = await dbPromise;
  let count = 0;
  for (let t = 0; t < teams.length; t++) {
    const quality = 0.22 + random() * 0.78;
    const autoMean = 2 + quality * 20;
    const teleMean = 18 + quality * 105;
    const climbSkill = Math.min(.96, .18 + quality * .78);
    for (let m = 1; m <= 10; m++) {
      const disabled = random() < .035;
      const climbed = !disabled && random() < climbSkill;
      const towerRoll = random();
      const teleTower = !climbed ? 'None' : towerRoll < quality*.45 ? 'Level 3' : towerRoll < .78 ? 'Level 2' : 'Level 1';
      await db.put('records', {
        id: `demo-2026-${teams[t]}-${m}`, v: 2, event: 'TigerBots Invitational',
        match: String(m * 4 + (t % 4)), team: String(teams[t]), scout: 'Demo generator',
        alliance: (t + m) % 2 ? 'red' : 'blue',
        autoFuel: disabled ? 0 : vary(autoMean, 12),
        autoTower: !disabled && random() < quality * .16 ? 'Level 1' : 'None',
        teleFuel: disabled ? 0 : vary(teleMean, 45),
        teleTower, groundIntake: random() < .35 + quality * .55,
        trench: random() < .45 + quality * .45, bump: random() < .35 + quality * .5,
        defense: quality < .48 ? Math.round(random()*5) : Math.round(random()*2),
        fouls: random() < .13 ? 1 : 0, broke: disabled,
        notes: disabled ? 'Robot became disabled during the match.' :
          quality > .82 ? 'Fast FUEL cycles, accurate HUB shooting, strong field awareness.' :
          quality < .38 ? 'Developing consistency; best contribution may be defense or support.' :
          'Reliable cycles with steady positioning around active HUB shifts.',
        createdAt: Date.now() - (10-m) * 3600000
      });
      count++;
    }
  }
  toast(`${count} REBUILT records loaded.`);
  await go('data');
}

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type}));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function downloadCsv(all) {
  const keys = [...new Set(all.flatMap(record => Object.keys(record)))];
  const csv = [keys, ...all.map(r=>keys.map(k=>`"${String(r[k]??'').replaceAll('"','""')}"`))].map(x=>x.join(',')).join('\n');
  download('tiger-scouting.csv', csv, 'text/csv');
}
async function importJson(e) {
  try {
    const incoming = JSON.parse(await e.target.files[0].text());
    const db = await dbPromise;
    for (const r of incoming) if (r.id && r.team) await db.put('records', r);
    toast(`${incoming.length} records imported.`);
    go('data');
  } catch { toast('That backup file is not valid.', true); }
}

document.addEventListener('click', e => {
  const button = e.target.closest('[data-go]');
  if (button) go(button.dataset.go);
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
async function initialize() {
  await ensureDefaultAdminPassword();
  if (localStorage.getItem('tiger-cri-preset-version') !== CRI_EVENT.id) prepareCriDevice(false);
  applyColorTheme();
  updateAdminNav();
  applyAppMode();
  await go(appMode() === 'database' ? 'data' : 'home');
  if (appMode() === 'command' && navigator.onLine && localStorage.getItem('tiger-sql-token')) {
    await syncSqlDatabase();
    await go('data');
  }
  if (navigator.onLine && localStorage.getItem('tiger-statbotics-enabled') === 'yes') {
    setTimeout(syncStatbotics, 250);
  }
}
window.addEventListener('online', async () => {
  if (appMode() !== 'command' || !localStorage.getItem('tiger-sql-token')) return;
  await syncSqlDatabase();
  await go('data');
});
initialize();
