/* ============================================================
   AIDEOLOGY STUDIOS — STAFF TRACKER PRO
   app.js
   ============================================================ */

/* ── CONSTANTS & STATE ────────────────────────────────────── */
const MEMBERS = ['PRASHANTH', 'CHANDU', 'IMMI', 'SRIRAJ'];
let currentMember   = null;
let attendance      = 'Present';
let allData         = {};
let editingEntryId  = null;

/* ============================================================
   CONFIGURATION STORAGE
   ============================================================ */
const CONFIG_KEYS = {
  SHEET_URL:    'as_sheet_url',
  DRIVE_FOLDER: 'as_drive_folder',
  CLAUDE_KEY:   'as_claude_key'
};

function getConfig(key) {
  return localStorage.getItem(CONFIG_KEYS[key]) || '';
}
function setConfig(key, value) {
  localStorage.setItem(CONFIG_KEYS[key], value);
}

/* ── SETTINGS PANEL ──────────────────────────────────────── */
function openSettings() {
  document.getElementById('settings-sheet-url').value    = getConfig('SHEET_URL');
  document.getElementById('settings-drive-folder').value = getConfig('DRIVE_FOLDER');
  document.getElementById('settings-claude-key').value   = getConfig('CLAUDE_KEY');
  updateSyncDots();
  document.getElementById('settings-overlay').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
}

function closeSettingsOnBg(e) {
  if (e.target === document.getElementById('settings-overlay')) closeSettings();
}

function saveSettings() {
  setConfig('SHEET_URL',    document.getElementById('settings-sheet-url').value.trim());
  setConfig('DRIVE_FOLDER', document.getElementById('settings-drive-folder').value.trim());
  setConfig('CLAUDE_KEY',   document.getElementById('settings-claude-key').value.trim());
  updateSyncDots();
  closeSettings();
  showToast('✓ SETTINGS SAVED');
}

function updateSyncDots() {
  const dots = {
    'sync-dot-sheet':  getConfig('SHEET_URL'),
    'sync-dot-drive':  getConfig('DRIVE_FOLDER'),
    'sync-dot-claude': getConfig('CLAUDE_KEY')
  };
  Object.entries(dots).forEach(([id, val]) => {
    const dot = document.getElementById(id);
    if (dot) dot.classList.toggle('active', !!val);
  });
}

/* ============================================================
   STORAGE  (Local + Persistent window.storage fallback)
   ============================================================ */
function getStorageKey(name) { return 'as_member_' + name; }

async function readStoredValue(key) {
  if (window.storage && typeof window.storage.get === 'function') {
    try {
      const r = await window.storage.get(key);
      if (r && typeof r.value === 'string') return r.value;
    } catch(e) {}
  }
  return localStorage.getItem(key);
}

async function writeStoredValue(key, value) {
  if (window.storage && typeof window.storage.set === 'function') {
    try { await window.storage.set(key, value); } catch(e) {}
  }
  try { localStorage.setItem(key, value); } catch(e) {}
}

async function loadAll() {
  for (const m of MEMBERS) {
    try {
      const raw = await readStoredValue(getStorageKey(m));
      allData[m] = raw ? JSON.parse(raw) : [];
    } catch(e) { allData[m] = []; }
  }
}

async function saveMember(name) {
  try {
    await writeStoredValue(getStorageKey(name), JSON.stringify(allData[name] || []));
  } catch(e) { console.error('Save error:', e); }
}

/* ============================================================
   GOOGLE SHEETS INTEGRATION
   ============================================================ */
async function loadFromSheet(memberName) {
  const url = getConfig('SHEET_URL');
  if (!url) return false;
  try {
    showToast('↻ LOADING FROM SHEET...');
    const res  = await fetch(url + '?member=' + encodeURIComponent(memberName));
    const json = await res.json();
    if (Array.isArray(json)) {
      allData[memberName] = json.map((r, i) => ({
        id:         r.id         || (Date.now() + i),
        date:       r.date       || '',
        attendance: r.attendance || 'Present',
        project:    r.project    || '—',
        type:       r.type       || 'Ad Video',
        duration:   r.duration   || '',
        status:     r.status     || 'Completed',
        remarks:    r.remarks    || '—',
        link:       r.link       || '',
        link2:      r.link2      || '',
      }));
      await saveMember(memberName);
      renderAll();
      showToast('✓ DATA LOADED FROM SHEET');
      return true;
    }
  } catch(e) {
    console.warn('Sheet load failed:', e);
    showToast('⚠ USING LOCAL DATA');
  }
  return false;
}

async function syncEntryToSheet(memberName, entry) {
  const url = getConfig('SHEET_URL');
  if (!url) return false;
  try {
    await fetch(url, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ member: memberName, ...entry })
    });
    return true;
  } catch(e) {
    console.warn('Sheet sync failed:', e);
    return false;
  }
}

/* ============================================================
   GOOGLE DRIVE SYNC — ONE FILE WITH 4 SHEETS
   Sends all 4 members' data ascending, blank empty fields.
   ============================================================ */
async function syncWithDrive() {
  const folderId = getConfig('DRIVE_FOLDER');
  const sheetUrl = getConfig('SHEET_URL');

  if (!folderId || !sheetUrl) {
    showToast('⚠ CONFIGURE DRIVE FOLDER IN SETTINGS');
    return;
  }
  try {
    showToast('☁ SYNCING ALL TO DRIVE...');

    const payload = {};
    MEMBERS.forEach(m => {
      const entries = [...(allData[m] || [])].sort((a, b) => a.id - b.id);
      payload[m] = entries.map((e, i) => ({
        'No':         i + 1,
        'Date':       fmtDate(e.date),
        'Attendance': e.attendance  || '',
        'Project':    cleanVal(e.project),
        'Type':       e.type        || '',
        'Duration':   e.duration    ? e.duration + ' hrs' : '',
        'Status':     e.status      || '',
        'Remarks':    cleanVal(e.remarks),
        'Link 1':     e.link        || '',
        'Link 2':     e.link2       || ''
      }));
    });

    await fetch(sheetUrl, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action:   'syncAllToDrive',
        folderId: folderId,
        members:  payload
      })
    });

    showToast('✓ ALL MEMBERS SYNCED TO DRIVE');
  } catch(e) {
    console.error('Drive sync error:', e);
    showToast('⚠ DRIVE SYNC FAILED');
  }
}

/* ============================================================
   EXCEL EXPORT — ONE .xlsx WITH 4 SHEETS  (SheetJS / XLSX)
   Sheet1=PRASHANTH  Sheet2=CHANDU  Sheet3=IMMI  Sheet4=SRIRAJ
   Ascending order: row 1 = first entry, row 2 = second...
   Empty fields are BLANK — no "—" dashes in Excel.
   ============================================================ */
function exportAllToExcel() {
  const hasData = MEMBERS.some(m => (allData[m] || []).length > 0);
  if (!hasData) { showToast('⚠ NO DATA TO EXPORT'); return; }

  const wb = XLSX.utils.book_new();

  MEMBERS.forEach((m, idx) => {
    const entries = [...(allData[m] || [])].sort((a, b) => a.id - b.id);
    const headers = ['No','Date','Attendance','Project','Type','Duration','Status','Remarks','Link 1','Link 2'];

    const rows = entries.map((e, i) => [
      i + 1,
      fmtDate(e.date),
      e.attendance   || '',
      cleanVal(e.project),
      e.type         || '',
      e.duration     ? e.duration + ' hrs' : '',
      e.status       || '',
      cleanVal(e.remarks),
      e.link         || '',
      e.link2        || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths
    ws['!cols'] = [
      {wch:5},{wch:14},{wch:12},{wch:26},{wch:14},
      {wch:12},{wch:14},{wch:32},{wch:34},{wch:34}
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Sheet' + (idx + 1) + ' - ' + m);
  });

  XLSX.writeFile(wb, 'AIDEOLOGY_STAFF_DATA_' + todayStr() + '.xlsx');
  showToast('✓ EXCEL DOWNLOADED — 4 SHEETS');
}

/* ============================================================
   CLAUDE AI INSIGHTS
   ============================================================ */
async function getAIInsights() {
  const apiKey = getConfig('CLAUDE_KEY');
  if (!apiKey) { showToast('⚠ CONFIGURE CLAUDE API KEY IN SETTINGS'); return; }

  const entries = allData[currentMember] || [];
  if (entries.length === 0) { showToast('⚠ NO DATA FOR AI ANALYSIS'); return; }

  try {
    showToast('✨ ANALYZING WITH AI...');
    const dataSummary = entries.slice(0, 50).map(e => ({
      date: e.date, attendance: e.attendance,
      project: e.project, type: e.type,
      duration: e.duration, status: e.status
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages:   [{
          role:    'user',
          content: `Analyze this staff member's work data and provide brief insights (3-4 bullet points):\n\nStaff: ${currentMember}\nTotal Entries: ${entries.length}\nRecent Data: ${JSON.stringify(dataSummary, null, 2)}\n\nFocus on: productivity patterns, project diversity, attendance consistency, and any recommendations.`
        }]
      })
    });

    const data     = await response.json();
    const insights = data.content[0].text;
    alert(`AI INSIGHTS FOR ${currentMember}\n\n${insights}`);
    showToast('✓ AI ANALYSIS COMPLETE');
  } catch(e) {
    console.error('AI error:', e);
    showToast('⚠ AI ANALYSIS FAILED');
  }
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function getMemberUrl(name) {
  const url = new URL(window.location.href);
  url.searchParams.set('member', name.toLowerCase());
  url.hash = '';
  return url.toString();
}

function goToMemberPage(name) {
  window.location.href = getMemberUrl(name);
}

async function openMember(name, pushHistory = false) {
  currentMember = name;
  await loadAll();

  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'auto' });

  document.getElementById('home').classList.remove('active');
  document.getElementById('member-page').classList.add('active');

  const display = name.charAt(0) + name.slice(1).toLowerCase();
  document.getElementById('mp-name').innerHTML =
    display.slice(0, -3) + '<span>' + display.slice(-3) + '</span>';
  document.getElementById('form-deco').textContent = name.charAt(0);
  document.getElementById('sheet-title').textContent = display + ' Work Sheet';

  if (pushHistory) {
    history.pushState({ member: name }, '', getMemberUrl(name));
  }

  // Reset form
  document.getElementById('f-date').value     = todayStr();
  document.getElementById('f-project').value  = '';
  document.getElementById('f-type').value     = 'Ad Video';
  document.getElementById('f-duration').value = '';
  document.getElementById('f-status').value   = 'Completed';
  document.getElementById('f-remarks').value  = '';
  document.getElementById('f-link').value     = '';
  document.getElementById('f-link2').value    = '';
  setAtt('Present');
  setEditMode(null);
  renderAll();

  // Load from Google Sheet if configured
  loadFromSheet(name);
}

function goHome() {
  const url = new URL(window.location.href);
  url.searchParams.delete('member');
  url.hash = '';
  window.location.href = url.toString();
}

/* ── ATTENDANCE TOGGLE ───────────────────────────────────── */
function setAtt(val) {
  attendance = val;
  document.getElementById('att-present').classList.toggle('active', val === 'Present');
  document.getElementById('att-absent').classList.toggle('active',  val === 'Absent');
}

/* ============================================================
   SUBMIT ENTRY
   Uses push() → ascending order: entry 1 = row 1, entry 2 = row 2...
   ============================================================ */
async function submitEntry() {
  const date = document.getElementById('f-date').value;
  if (!date) { showToast('⚠ SELECT A DATE'); return; }

  const entry = {
    id:         editingEntryId || Date.now(),
    date,
    attendance,
    project:  document.getElementById('f-project').value.trim()  || '—',
    type:     document.getElementById('f-type').value,
    duration: document.getElementById('f-duration').value        || '',
    status:   document.getElementById('f-status').value,
    remarks:  document.getElementById('f-remarks').value.trim()  || '—',
    link:     document.getElementById('f-link').value.trim(),
    link2:    document.getElementById('f-link2').value.trim(),
  };

  if (!allData[currentMember]) allData[currentMember] = [];

  if (editingEntryId) {
    const index = allData[currentMember].findIndex(item => item.id === editingEntryId);
    if (index !== -1) {
      allData[currentMember][index] = entry;
      await saveMember(currentMember);
      setEditMode(null);
      renderAll();
      showToast('✓ ENTRY UPDATED');
      return;
    }
  }

  // APPEND at end — ascending order (1, 2, 3...)
  allData[currentMember].push(entry);
  await saveMember(currentMember);

  // Sync to Google Sheets
  await syncEntryToSheet(currentMember, entry);

  // Auto-sync all to Drive if configured
  const driveFolder = getConfig('DRIVE_FOLDER');
  if (driveFolder) syncWithDrive();

  // Clear input fields (keep date & attendance)
  document.getElementById('f-project').value  = '';
  document.getElementById('f-duration').value = '';
  document.getElementById('f-remarks').value  = '';
  document.getElementById('f-link').value     = '';
  document.getElementById('f-link2').value    = '';

  renderAll();
  showToast('✓ ENTRY SAVED & SYNCED');
}

/* ── EDIT MODE ───────────────────────────────────────────── */
function setEditMode(entry) {
  editingEntryId = entry ? entry.id : null;
  const submitBtn = document.getElementById('submit-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');

  if (entry) {
    document.getElementById('f-date').value     = entry.date     || todayStr();
    document.getElementById('f-project').value  = entry.project  === '—' ? '' : entry.project;
    document.getElementById('f-type').value     = entry.type     || 'Ad Video';
    document.getElementById('f-duration').value = entry.duration || '';
    document.getElementById('f-status').value   = entry.status   || 'Completed';
    document.getElementById('f-remarks').value  = entry.remarks  === '—' ? '' : entry.remarks;
    document.getElementById('f-link').value     = entry.link     || '';
    document.getElementById('f-link2').value    = entry.link2    || '';
    setAtt(entry.attendance || 'Present');
    submitBtn.textContent   = '✓ UPDATE ENTRY';
    cancelBtn.style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  document.getElementById('f-date').value     = todayStr();
  document.getElementById('f-project').value  = '';
  document.getElementById('f-type').value     = 'Ad Video';
  document.getElementById('f-duration').value = '';
  document.getElementById('f-status').value   = 'Completed';
  document.getElementById('f-remarks').value  = '';
  document.getElementById('f-link').value     = '';
  document.getElementById('f-link2').value    = '';
  setAtt('Present');
  submitBtn.textContent   = '+ ADD ENTRY';
  cancelBtn.style.display = 'none';
}

function editEntry(entryId) {
  const entry = (allData[currentMember] || []).find(item => item.id === entryId);
  if (!entry) return;
  setEditMode(entry);
  showToast('EDIT MODE ON');
}

async function deleteEntry(entryId) {
  if (!confirm('Remove this entry?')) return;
  allData[currentMember] = (allData[currentMember] || []).filter(item => item.id !== entryId);
  await saveMember(currentMember);
  if (editingEntryId === entryId) setEditMode(null);
  renderAll();
  showToast('ENTRY REMOVED');
}

async function clearAllEntries() {
  const entries = allData[currentMember] || [];
  if (!entries.length) { showToast('NO ENTRIES TO REMOVE'); return; }
  if (!confirm('Remove all entries for ' + currentMember + '?')) return;
  allData[currentMember] = [];
  await saveMember(currentMember);
  setEditMode(null);
  renderAll();
  showToast('ALL ENTRIES REMOVED');
}

function cancelEdit() {
  setEditMode(null);
  showToast('EDIT CANCELLED');
}

/* ============================================================
   RENDER
   ============================================================ */
function renderAll() {
  renderStats();
  renderTable();
}

function renderStats() {
  const entries  = allData[currentMember] || [];
  const present  = entries.filter(e => e.attendance === 'Present').length;
  const absent   = entries.filter(e => e.attendance === 'Absent').length;
  const totalHrs = entries.reduce((s, e) => s + (parseFloat(e.duration) || 0), 0);
  const completed = entries.filter(e => e.status === 'Completed').length;
  const adVid    = entries.filter(e => e.type === 'Ad Video').length;
  const brandVid = entries.filter(e => e.type === 'Brand Video').length;

  document.getElementById('stats-row').innerHTML = [
    { n: entries.length,          l: 'Total Entries' },
    { n: present,                 l: 'Days Present'  },
    { n: absent,                  l: 'Days Absent'   },
    { n: totalHrs.toFixed(1),     l: 'Hours Logged'  },
    { n: completed,               l: 'Completed'     },
    { n: adVid,                   l: 'Ad Videos'     },
    { n: brandVid,                l: 'Brand Videos'  },
  ].map(s => `
    <div class="stat-box">
      <div class="stat-num">${s.n}</div>
      <div class="stat-label">${s.l}</div>
    </div>
  `).join('');
}

function renderTable() {
  const entries = allData[currentMember] || [];
  const tbody   = document.getElementById('table-body');
  const empty   = document.getElementById('empty-state');
  const count   = document.getElementById('entry-count');

  const n = entries.length;
  count.textContent = n + (n === 1 ? ' ENTRY' : ' ENTRIES');

  if (n === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = entries.map((e, i) => {
    const attClass = e.attendance === 'Present' ? 'badge-present' : 'badge-absent';
    const dur = e.duration
      ? e.duration + ' hr' + (parseFloat(e.duration) !== 1 ? 's' : '')
      : '—';
    return `
      <tr>
        <td style="color:var(--mid-gray);font-family:var(--font-sub);letter-spacing:1px">${i + 1}</td>
        <td style="font-family:var(--font-sub);letter-spacing:1px">${fmtDate(e.date)}</td>
        <td><span class="badge ${attClass}">${e.attendance}</span></td>
        <td title="${escapeHtml(e.project)}">${escapeHtml(e.project)}</td>
        <td style="color:var(--magenta);font-family:var(--font-sub);letter-spacing:1px">${escapeHtml(e.type)}</td>
        <td>${dur}</td>
        <td><span class="badge badge-completed">${escapeHtml(e.status)}</span></td>
        <td title="${escapeHtml(e.remarks)}" style="color:var(--mid-gray)">${escapeHtml(e.remarks)}</td>
        <td class="link-cell">${e.link  ? `<a href="${escapeAttr(e.link)}"  target="_blank" rel="noopener">VIEW ↗</a>` : '—'}</td>
        <td class="link-cell">${e.link2 ? `<a href="${escapeAttr(e.link2)}" target="_blank" rel="noopener">VIEW ↗</a>` : '—'}</td>
        <td>
          <button onclick="editEntry(${e.id})"   style="background:none;border:1px solid var(--border);color:var(--mid-gray);padding:4px 8px;cursor:pointer;font-size:10px;margin-right:4px;">EDIT</button>
          <button onclick="deleteEntry(${e.id})" style="background:none;border:1px solid var(--border);color:var(--mid-gray);padding:4px 8px;cursor:pointer;font-size:10px;">DEL</button>
        </td>
      </tr>
    `;
  }).join('');
}

/* ============================================================
   UTILITIES
   ============================================================ */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const mons = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${day} ${mons[parseInt(m) - 1]} ${y}`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) { return escapeHtml(value); }

// Returns '' if value is '—' or falsy, otherwise the raw string.
// Used to keep Excel cells blank instead of showing "—".
function cleanVal(val) {
  if (!val || val === '—') return '';
  return String(val);
}

/* ============================================================
   ROUTING
   ============================================================ */
async function handleInitialRoute() {
  await loadAll();

  const url            = new URL(window.location.href);
  const memberFromQuery = (url.searchParams.get('member') || '').trim().toUpperCase();
  const memberFromHash  = window.location.hash.replace('#', '').trim().toUpperCase();
  const selected        = MEMBERS.includes(memberFromQuery) ? memberFromQuery : memberFromHash;

  if (MEMBERS.includes(selected)) {
    await openMember(selected);
    return;
  }

  document.getElementById('member-page').classList.remove('active');
  document.getElementById('home').classList.add('active');
}

window.addEventListener('popstate', () => handleInitialRoute());

/* ── INIT ─────────────────────────────────────────────────── */
updateSyncDots();
handleInitialRoute();
