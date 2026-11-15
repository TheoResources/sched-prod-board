import { fetchIncidents, ack, acks } from './api.js';

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');

const incidentsMap = new Map();
const ackedIds = new Set();
let isRefreshing = false;
let lastRenderSignature = '';

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

function updateBoard(incoming = []) {
  const loader = document.querySelector('[data-testid="loader"]');
  if (loader) {
    loader.remove();
  }

  for (const inc of incoming) {
    incidentsMap.set(inc.id, inc);
  }

  const all = Array.from(incidentsMap.values()).sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  );

  let emptyEl = document.querySelector('[data-testid="empty"]');
  if (all.length === 0) {
    if (lastRenderSignature !== 'empty') {
      list.innerHTML = '';
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.setAttribute('data-testid', 'empty');
        emptyEl.className = 'empty';
        emptyEl.textContent = 'No incidents tonight';
        board.appendChild(emptyEl);
      }
      lastRenderSignature = 'empty';
    }
    return;
  }

  if (emptyEl) {
    emptyEl.remove();
  }

  const signature = all
    .map((i) => `${i.id}:${ackedIds.has(i.id) || acks.some((a) => a.id === i.id)}`)
    .join('|');

  if (signature !== lastRenderSignature) {
    list.innerHTML = all.map(renderIncidentRow).join('');
    lastRenderSignature = signature;
  }
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

    // Refresh signature to reflect acked state
    const all = Array.from(incidentsMap.values()).sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
    lastRenderSignature = all
      .map((i) => `${i.id}:${ackedIds.has(i.id) || acks.some((a) => a.id === i.id)}`)
      .join('|');
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
    updateBoard(page.incidents);
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
