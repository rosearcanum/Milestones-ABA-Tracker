// ─── Date helpers ────────────────────────────────────────────────────────────

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function daysUntil(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  d.setHours(0, 0, 0, 0);
  return Math.round((d - TODAY) / 86400000);
}

function fmtDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Status computation ───────────────────────────────────────────────────────

const URGENT_DAYS = 30;

function rxSeverity(client) {
  const s = client.rx.status;
  if (s === 'expired') return 'expired';
  if (s === 'missing') return 'missing';
  if (s === 'expiring' || s === 'ok') {
    const days = daysUntil(client.rx.expiration);
    if (days === null) return 'ok';
    if (days < 0) return 'expired';
    if (days <= URGENT_DAYS) return 'expiring';
    return 'ok';
  }
  return 'ok';
}

function authSeverity(client) {
  if (!client.auth_expiration) return 'none';
  const days = daysUntil(client.auth_expiration);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= URGENT_DAYS) return 'expiring';
  return 'ok';
}

function docFields(client) {
  return [
    { key: 'insurance_card', label: 'Insurance Card' },
    { key: 'cde', label: 'CDE' },
    { key: 'intake', label: 'Intake Form' },
    { key: 'basc', label: 'BASC' },
    { key: 'vineland', label: 'Vineland' },
  ];
}

function getMissingDocs(client) {
  return docFields(client)
    .filter(f => client[f.key] === 'missing' || client[f.key] === 'expired')
    .map(f => ({ ...f, status: client[f.key] }));
}

function getClientTasks(client) {
  const tasks = [];
  const rxSev = rxSeverity(client);
  const authSev = authSeverity(client);
  const days_rx = daysUntil(client.rx.expiration);
  const days_auth = daysUntil(client.auth_expiration);

  if (rxSev === 'expired') tasks.push({ priority: 'critical', label: `RX/Referral expired on ${fmtDate(client.rx.expiration)}`, type: 'rx' });
  if (rxSev === 'expiring') tasks.push({ priority: days_rx <= 7 ? 'critical' : 'urgent', label: `RX/Referral expiring in ${days_rx}d (${fmtDate(client.rx.expiration)})`, type: 'rx' });
  if (rxSev === 'missing') tasks.push({ priority: 'critical', label: 'RX/Referral missing', type: 'rx' });

  if (authSev === 'expired') tasks.push({ priority: 'critical', label: `Auth expired on ${fmtDate(client.auth_expiration)}`, type: 'auth' });
  if (authSev === 'expiring') tasks.push({ priority: days_auth <= 7 ? 'critical' : 'urgent', label: `Auth expiring in ${days_auth}d (${fmtDate(client.auth_expiration)})`, type: 'auth' });

  getMissingDocs(client).forEach(d => {
    tasks.push({ priority: 'warning', label: `${d.label}: ${d.status}`, type: 'doc' });
  });

  return tasks;
}

function getOverallSeverity(client) {
  const tasks = getClientTasks(client);
  if (tasks.some(t => t.priority === 'critical')) return 'critical';
  if (tasks.some(t => t.priority === 'urgent')) return 'urgent';
  if (tasks.some(t => t.priority === 'warning')) return 'warning';
  return 'ok';
}

// ─── State ────────────────────────────────────────────────────────────────────

let allClients = [];
let activeTab = 'tasks';
let searchQuery = '';
let filterSeverity = 'all';
let filterDoc = 'all';

// ─── Load data ────────────────────────────────────────────────────────────────

async function loadData() {
  try {
    const res = await fetch('clients.json?v=' + Date.now());
    const data = await res.json();
    allClients = data.clients;
    renderAll();
  } catch (e) {
    document.getElementById('app').innerHTML = `
      <div class="load-error">
        <p>Could not load <code>clients.json</code>.</p>
        <p>Make sure both files are in the same folder and you're running via a local server or GitHub Pages.</p>
        <pre>${e.message}</pre>
      </div>`;
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderAll() {
  renderKPIs();
  renderTabContent();
  renderLastUpdated();
}

function renderLastUpdated() {
  const el = document.getElementById('last-updated');
  if (el) el.textContent = 'Data as of ' + TODAY.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function renderKPIs() {
  const critical = allClients.filter(c => getOverallSeverity(c) === 'critical').length;
  const urgent = allClients.filter(c => getOverallSeverity(c) === 'urgent').length;
  const warning = allClients.filter(c => getOverallSeverity(c) === 'warning').length;
  const ok = allClients.filter(c => getOverallSeverity(c) === 'ok').length;
  const expRx = allClients.filter(c => rxSeverity(c) === 'expiring' || rxSeverity(c) === 'expired').length;
  const expAuth = allClients.filter(c => authSeverity(c) !== 'none' && authSeverity(c) !== 'ok').length;

  document.getElementById('kpi-critical').textContent = critical;
  document.getElementById('kpi-urgent').textContent = urgent;
  document.getElementById('kpi-warning').textContent = warning;
  document.getElementById('kpi-ok').textContent = ok;
  document.getElementById('kpi-rx').textContent = expRx;
  document.getElementById('kpi-auth').textContent = expAuth;
    const counts = { all: allClients.length, critical: 0, urgent: 0, warning: 0, ok: 0 };
  allClients.forEach(c => { counts[getOverallSeverity(c)]++; });

  ['all','critical','urgent','warning','ok'].forEach(k => {
    const el = document.getElementById('count-' + k);
    if (el) el.textContent = counts[k];
  });
}

function renderTabContent() {
  const container = document.getElementById('tab-content');
  if (activeTab === 'tasks') container.innerHTML = renderTasksView();
  else if (activeTab === 'clients') container.innerHTML = renderClientsView();
  else if (activeTab === 'docs') container.innerHTML = renderDocsView();
  else if (activeTab === 'auth') container.innerHTML = renderAuthView();
  attachRowListeners();
}

// ── Tasks view ─────────────────────────────────────────────────────────────

function renderTasksView() {
  const severityOrder = { critical: 0, urgent: 1, warning: 2, ok: 3 };
  const clientsWithTasks = allClients
    .map(c => ({ client: c, tasks: getClientTasks(c), severity: getOverallSeverity(c) }))
    .filter(x => x.tasks.length > 0)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.client.name.localeCompare(b.client.name));

  const q = searchQuery.toLowerCase();
  const filtered = clientsWithTasks.filter(x => {
    if (q && !x.client.name.toLowerCase().includes(q)) return false;
    if (filterSeverity !== 'all' && x.severity !== filterSeverity) return false;
    return true;
  });

  if (filtered.length === 0) return `<div class="empty-state">No tasks match your filters. 🎉</div>`;

  return `
    <div class="task-list">
      ${filtered.map(x => `
        <div class="task-card sev-${x.severity}" data-client="${encodeURIComponent(x.client.name)}">
          <div class="task-card-header">
            <span class="client-name">${x.client.name}</span>
            <span class="sev-badge sev-${x.severity}">${x.severity}</span>
          </div>
          <ul class="task-items">
            ${x.tasks.map(t => `
              <li class="task-item pri-${t.priority}">
                <span class="task-icon">${taskIcon(t.type)}</span>
                ${t.label}
              </li>`).join('')}
          </ul>
          ${x.client.notes ? `<div class="task-note">📋 ${x.client.notes}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

function taskIcon(type) {
  if (type === 'rx') return '📄';
  if (type === 'auth') return '🔐';
  return '📋';
}

// ── Clients view ───────────────────────────────────────────────────────────

function renderClientsView() {
  const q = searchQuery.toLowerCase();
  const filtered = allClients.filter(c => {
    if (q && !c.name.toLowerCase().includes(q)) return false;
    const sev = getOverallSeverity(c);
    if (filterSeverity !== 'all' && sev !== filterSeverity) return false;
    return true;
  }).sort((a, b) => {
    const order = { critical: 0, urgent: 1, warning: 2, ok: 3 };
    return order[getOverallSeverity(a)] - order[getOverallSeverity(b)] || a.name.localeCompare(b.name);
  });

  return `
    <div class="table-wrap">
      <table class="client-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>RX / Referral</th>
            <th>Auth Exp.</th>
            <th>Ins. Card</th>
            <th>CDE</th>
            <th>Intake</th>
            <th>BASC</th>
            <th>Vineland</th>
            <th>BCBA</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(c => {
            const sev = getOverallSeverity(c);
            const rxSev = rxSeverity(c);
            const authSev = authSeverity(c);
            return `<tr class="sev-row-${sev}" data-client="${encodeURIComponent(c.name)}">
              <td class="name-cell">${c.name}</td>
              <td>${rxCell(c, rxSev)}</td>
              <td>${authCell(c, authSev)}</td>
              <td>${docCell(c.insurance_card)}</td>
              <td>${docCell(c.cde)}</td>
              <td>${docCell(c.intake)}</td>
              <td>${docCell(c.basc)}</td>
              <td>${docCell(c.vineland)}</td>
              <td class="muted">${c.bcba || '—'}</td>
              <td><span class="sev-badge sev-${sev}">${sev}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p class="row-count">${filtered.length} of ${allClients.length} clients</p>
    </div>`;
}

function rxCell(client, sev) {
  if (sev === 'expired') return `<span class="pill pill-expired">Expired ${fmtDate(client.rx.expiration)}</span>`;
  if (sev === 'missing') return `<span class="pill pill-missing">Missing</span>`;
  if (sev === 'expiring') {
    const d = daysUntil(client.rx.expiration);
    return `<span class="pill pill-warn">${d}d — ${fmtDate(client.rx.expiration)}</span>`;
  }
  if (client.rx.expiration) return `<span class="pill pill-ok">Valid · ${fmtDate(client.rx.expiration)}</span>`;
  return `<span class="pill pill-ok">Valid</span>`;
}

function authCell(client, sev) {
  if (sev === 'none' || !client.auth_expiration) return `<span class="muted">—</span>`;
  if (sev === 'expired') return `<span class="pill pill-expired">Exp. ${fmtDate(client.auth_expiration)}</span>`;
  const d = daysUntil(client.auth_expiration);
  if (sev === 'expiring') return `<span class="pill pill-warn">${d}d · ${fmtDate(client.auth_expiration)}</span>`;
  return `<span class="pill pill-ok">${fmtDate(client.auth_expiration)}</span>`;
}

function docCell(val) {
  if (val === 'ok') return `<span class="pill pill-ok">✓</span>`;
  if (val === 'missing') return `<span class="pill pill-missing">Missing</span>`;
  if (val === 'expired') return `<span class="pill pill-expired">Expired</span>`;
  return `<span class="muted">—</span>`;
}

// ── Docs view ──────────────────────────────────────────────────────────────

function renderDocsView() {
  const docTypes = [
    { key: 'insurance_card', label: 'Insurance Card' },
    { key: 'cde', label: 'CDE' },
    { key: 'intake', label: 'Intake Form' },
    { key: 'basc', label: 'BASC' },
    { key: 'vineland', label: 'Vineland' },
  ];

  const activeDoc = filterDoc === 'all' ? null : filterDoc;
  const docsToShow = activeDoc ? docTypes.filter(d => d.key === activeDoc) : docTypes;

  return `
    <div class="doc-filter-row">
      <button class="doc-filter-btn ${filterDoc === 'all' ? 'active' : ''}" onclick="setDocFilter('all')">All docs</button>
      ${docTypes.map(d => `<button class="doc-filter-btn ${filterDoc === d.key ? 'active' : ''}" onclick="setDocFilter('${d.key}')">${d.label}</button>`).join('')}
    </div>
    ${docsToShow.map(docType => {
      const problems = allClients.filter(c => c[docType.key] === 'missing' || c[docType.key] === 'expired');
      const q = searchQuery.toLowerCase();
      const filtered = problems.filter(c => !q || c.name.toLowerCase().includes(q));
      return `
        <div class="doc-section">
          <div class="doc-section-header">
            <span class="doc-section-title">${docType.label}</span>
            <span class="doc-section-count">${filtered.length} needing action</span>
          </div>
          ${filtered.length === 0
            ? `<div class="doc-all-clear">All clients have this document ✓</div>`
            : `<div class="doc-chips">${filtered.map(c => {
                const status = c[docType.key];
                return `<span class="doc-chip chip-${status}" data-client="${encodeURIComponent(c.name)}">${c.name} — ${status}</span>`;
              }).join('')}</div>`}
        </div>`;
    }).join('')}`;
}

// ── Auth view ──────────────────────────────────────────────────────────────

function renderAuthView() {
  const withAuth = allClients
    .filter(c => c.auth_expiration)
    .sort((a, b) => {
      const da = daysUntil(a.auth_expiration) ?? 9999;
      const db = daysUntil(b.auth_expiration) ?? 9999;
      return da - db;
    });

  const q = searchQuery.toLowerCase();
  const filtered = withAuth.filter(c => !q || c.name.toLowerCase().includes(q));

  return `
    <div class="table-wrap">
      <table class="client-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Auth Expires</th>
            <th>Days Left</th>
            <th>BCBA</th>
            <th>BCABA</th>
            <th>Insurance</th>
            <th>Notes</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(c => {
            const sev = authSeverity(c);
            const days = daysUntil(c.auth_expiration);
            const daysLabel = days === null ? '—' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`;
            return `<tr class="sev-row-${sev === 'none' ? 'ok' : sev}">
              <td class="name-cell">${c.name}</td>
              <td>${fmtDate(c.auth_expiration)}</td>
              <td><span class="pill pill-${sev === 'expired' ? 'expired' : sev === 'expiring' ? 'warn' : 'ok'}">${daysLabel}</span></td>
              <td>${c.bcba || '—'}</td>
              <td>${c.bcaba || '—'}</td>
              <td>${c.insurance || '—'}</td>
              <td class="muted note-cell">${c.notes || '—'}</td>
              <td><span class="sev-badge sev-${sev === 'none' ? 'ok' : sev}">${sev === 'none' ? 'ok' : sev}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${filtered.length === 0 ? `<div class="empty-state">No auth records found.</div>` : ''}
      <p class="row-count">${filtered.length} clients with tracked authorizations</p>
    </div>`;
}

// ─── Client detail modal ─────────────────────────────────────────────────────

function openClientModal(name) {
  const client = allClients.find(c => c.name === name);
  if (!client) return;
  const tasks = getClientTasks(client);
  const sev = getOverallSeverity(client);

  document.getElementById('modal-title').textContent = client.name;
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-sev sev-${sev}">Overall: <strong>${sev.toUpperCase()}</strong></div>

    <div class="modal-section-title">Tasks</div>
    ${tasks.length === 0
      ? `<div class="modal-all-clear">No open tasks — all good! ✓</div>`
      : `<ul class="modal-tasks">${tasks.map(t => `<li class="modal-task pri-${t.priority}">${taskIcon(t.type)} ${t.label}</li>`).join('')}</ul>`}

    <div class="modal-section-title">Documents</div>
    <div class="modal-doc-grid">
      ${[
        { key: 'rx', label: 'RX / Referral', val: client.rx.status, extra: client.rx.expiration ? ` · exp. ${fmtDate(client.rx.expiration)}` : '' },
        { key: 'insurance_card', label: 'Insurance Card', val: client.insurance_card, extra: '' },
        { key: 'cde', label: 'CDE', val: client.cde, extra: '' },
        { key: 'intake', label: 'Intake Form', val: client.intake, extra: '' },
        { key: 'basc', label: 'BASC', val: client.basc, extra: '' },
        { key: 'vineland', label: 'Vineland', val: client.vineland, extra: '' },
      ].map(d => `
        <div class="modal-doc-row">
          <span class="modal-doc-label">${d.label}</span>
          <span class="pill pill-${d.val === 'ok' ? 'ok' : d.val === 'missing' ? 'missing' : 'expired'}">${d.val}${d.extra}</span>
        </div>`).join('')}
    </div>

    ${client.auth_expiration ? `
      <div class="modal-section-title">Authorization</div>
      <div class="modal-doc-grid">
        <div class="modal-doc-row"><span class="modal-doc-label">Expires</span><span>${fmtDate(client.auth_expiration)}</span></div>
        ${client.bcba ? `<div class="modal-doc-row"><span class="modal-doc-label">BCBA</span><span>${client.bcba}</span></div>` : ''}
        ${client.bcaba ? `<div class="modal-doc-row"><span class="modal-doc-label">BCABA</span><span>${client.bcaba}</span></div>` : ''}
        ${client.insurance ? `<div class="modal-doc-row"><span class="modal-doc-label">Insurance</span><span>${client.insurance}</span></div>` : ''}
      </div>` : ''}

    ${client.notes ? `
      <div class="modal-section-title">Notes</div>
      <div class="modal-notes">${client.notes}</div>` : ''}
  `;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

function attachRowListeners() {
  document.querySelectorAll('[data-client]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => openClientModal(decodeURIComponent(el.dataset.client)));
  });
}

function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderTabContent();
}

function setDocFilter(key) {
  filterDoc = key;
  renderTabContent();
}

function onSearch(val) {
  searchQuery = val;
  renderTabContent();
}

function onSeverityFilter(val) {
  filterSeverity = val;
  renderTabContent();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', loadData);
