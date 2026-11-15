import { fetchIncidents, ack, acks } from './api.js';

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const newBar = document.querySelector('[data-testid="new-bar"]');

const incidentsMap = new Map();
const ackedIds = new Set();
const pendingIncidents = [];
let initialLoaded = false;
let isRefreshing = false;

function formatLocalTime(iso) {
  return new Date(iso).toLocaleString();
}

function renderIncidentRow(inc) {
  const isAcked = ackedIds.has(inc.id) || acks.some((a) => a.id === inc.id);
  const timeFormatted = formatLocalTime(inc.openedAt);

  const actionHtml = isAcked
    ? `<span data-testid="acked" class="acked">Acked</span>`
    : `<button data-testid="ack" class="ack" data-id="${inc.id}">Ack</button>`;

  return `<li data-testid="incident-row" data-id="${inc.id}" class="row ${inc.severity}">
    <span class="id">${inc.id}</span>
    <span class="sev">${inc.severity}</span>
    <span class="what">${inc.service} · ${inc.region} · ${inc.summary}</span>
    <time datetime="${inc.openedAt}">${timeFormatted}</time>
    <div class="ack-action">${actionHtml}</div>
  </li>`;
}

function showEmptyState() {
  list.innerHTML = '';
  let emptyEl = document.querySelector('[data-testid="empty"]');
  if (!emptyEl) {
    emptyEl = document.createElement('div');
    emptyEl.setAttribute('data-testid', 'empty');
    emptyEl.className = 'empty';
    emptyEl.textContent = 'No incidents tonight';
    board.appendChild(emptyEl);
  }
}

function clearEmptyState() {
  const emptyEl = document.querySelector('[data-testid="empty"]');
  if (emptyEl) {
    emptyEl.remove();
  }
}

function updateNewBar() {
  if (!newBar) return;
  if (pendingIncidents.length > 0) {
    newBar.textContent = `${pendingIncidents.length} new`;
    newBar.style.display = 'block';
  } else {
    newBar.style.display = 'none';
  }
}

if (newBar) {
  newBar.addEventListener('click', () => {
    if (pendingIncidents.length === 0) return;

    // Sort pending incidents newest first
    pendingIncidents.sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );

    // Prepend each pending incident into DOM and incidentsMap
    const htmlToPrepend = pendingIncidents
      .map((inc) => {
        incidentsMap.set(inc.id, inc);
        return renderIncidentRow(inc);
      })
      .join('');

    list.insertAdjacentHTML('afterbegin', htmlToPrepend);

    // Clear pending queue and hide new-bar
    pendingIncidents.length = 0;
    updateNewBar();
  });
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;

  btn.disabled = true;
  btn.textContent = 'Acking…';

  try {
    await ack(id);
    ackedIds.add(id);

    const actionContainer = btn.parentElement;
    if (actionContainer) {
      actionContainer.innerHTML = `<span data-testid="acked" class="acked">Acked</span>`;
    }
  } catch (err) {
    console.error(`Failed to ack ${id}:`, err);
    btn.disabled = false;
    btn.textContent = 'Ack';
  }
});

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    const page = await fetchIncidents();
    const incoming = page.incidents || [];

    const loader = document.querySelector('[data-testid="loader"]');
    if (loader) {
      loader.remove();
    }

    if (!initialLoaded) {
      initialLoaded = true;
      if (incoming.length === 0) {
        showEmptyState();
        return;
      }
      clearEmptyState();
      for (const inc of incoming) {
        incidentsMap.set(inc.id, inc);
      }
      const sorted = Array.from(incidentsMap.values()).sort(
        (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
      );
      list.innerHTML = sorted.map(renderIncidentRow).join('');
      return;
    }

    // After initial load: the list holds still!
    // Check for any newly arrived incidents
    for (const inc of incoming) {
      if (!incidentsMap.has(inc.id) && !pendingIncidents.some((p) => p.id === inc.id)) {
        pendingIncidents.push(inc);
      }
    }
    updateNewBar();
  } catch (err) {
    console.error('Refresh error:', err);
  } finally {
    isRefreshing = false;
  }
}

// Initial fetch
await refresh();

// Continuous refresh every 2s
setInterval(refresh, 2000);
