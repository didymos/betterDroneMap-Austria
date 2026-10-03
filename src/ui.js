const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function setLayerStatus(layerId, state) {
  const el = $(`s-${layerId}`);
  const text = {
    loading: 'lädt …',
    zoom: `ab Zoom ${state.minZoom}`,
    error: `Fehler: ${state.message ?? ''}`,
    unconfigured: 'nicht konfiguriert',
    ok: state.truncated ? `${state.count} (unvollständig, näher zoomen)` : '',
  }[state.status] ?? '';
  el.textContent = text;
  el.className = state.status === 'error' || state.status === 'unconfigured' || state.truncated ? 'err' : '';
}

export function showBanner(html) {
  const b = $('banner');
  b.innerHTML = html;
  b.hidden = !html;
}

export function showResult(res, lngLat) {
  const box = $('result');
  const coord = `${lngLat.lat.toFixed(5)}° N, ${lngLat.lng.toFixed(5)}° E`;
  let html;
  if (res.status === 'restricted') {
    const items = res.hits.map((h) => {
      const vert = h.lower != null || h.upper != null ? ` · ${esc(h.lower ?? '?')} – ${esc(h.upper ?? '?')}` : '';
      return `<li><strong>${esc(h.name)}</strong> (${esc(h.layerLabel)}${h.category ? `, ${esc(h.category)}` : ''}${vert})</li>`;
    });
    html = `<h3>⚠ Restriktion am Punkt</h3><ul>${items.join('')}</ul>`;
  } else if (res.status === 'incomplete') {
    html = '<h3>? Prüfung unvollständig</h3><p>Kein Treffer, aber nicht alle Quellen lieferten Daten. Nicht als „frei“ werten.</p>';
  } else {
    html = '<h3>Kein Treffer in den Quellen</h3><p>Das ist keine Freigabe. Offizielle Quellen (dronespace.at) und lokale Regeln sind maßgeblich.</p>';
  }
  if (res.problems.length) {
    html += `<ul>${res.problems.map((p) => `<li>${esc(p.layer)}: ${esc(p.message)}</li>`).join('')}</ul>`;
  }
  html += `<div class="meta">${coord}</div>`;
  $('result-body').className = res.status;
  $('result-body').innerHTML = html;
  box.hidden = false;
}

export function hideResult() {
  $('result').hidden = true;
}
