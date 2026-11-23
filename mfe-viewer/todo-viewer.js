// MFE Viewer: GET /todos, GET /todos/{id}, GET /todos/{id}/history
// Emite: todo:selected {id}   Escucha: todo:created, todo:updated, todo:deleted
export const version = '1.0.0';

const STYLE = `
  :host { display:block; font-family: system-ui, sans-serif; color: inherit;
          --line: color-mix(in srgb, currentColor 25%, transparent);
          --muted: color-mix(in srgb, currentColor 60%, transparent);
          --brand: #6366f1;
          --sel: color-mix(in srgb, #6366f1 22%, transparent);
          --err: #ef4444;
          --errbg: color-mix(in srgb, #ef4444 14%, transparent); }
  h3 { margin:0 0 .5rem; font-size:1rem; }
  .section { margin-bottom:1.25rem; }
  .muted { color:var(--muted); font-style:italic; }
  .error { color:var(--err); background:var(--errbg); border-radius:8px; padding:.5rem .75rem; }
  ul { list-style:none; margin:0; padding:0; }
  li { margin:0 0 .35rem; }
  button.item { width:100%; text-align:left; background:transparent; color:inherit; border:1px solid var(--line);
                border-radius:8px; padding:.5rem .75rem; cursor:pointer; font:inherit; display:flex; gap:.5rem; }
  button.item:hover { border-color:var(--brand); }
  button.item.selected { background:var(--sel); border-color:var(--brand); }
  .done { text-decoration: line-through; color:var(--muted); }
  .badge { font-size:.75rem; border:1px solid var(--line); border-radius:999px; padding:0 .5rem; }
  dl { margin:0 0 .75rem; display:grid; grid-template-columns:auto 1fr; gap:.25rem .75rem; }
  dt { color:var(--muted); } dd { margin:0; word-break:break-word; }
  .event { display:flex; justify-content:space-between; gap:1rem; border-bottom:1px solid var(--line); padding:.25rem 0; font-size:.9rem; }
`;

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = String(text); // nunca innerHTML
  if (cls) n.className = cls;
  return n;
}

function eventDate(ev) {
  const k = ['timestamp','createdAt','date','occurredAt','eventTime','time','at'].find((x) => ev[x]);
  if (k) return ev[k];
  const g = Object.keys(ev).find((x) => /(time|date|at)$/i.test(x) && ev[x]);
  return g ? ev[g] : null;
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleString('es-CO');
}

class TodoViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.todos = [];
    this.selectedId = null;
    this.listState = 'loading'; // loading | ok | error
    this.listError = '';
    this._onChange = (e) => this.handleChange(e);
  }

  get apiUrl() {
    return (this.getAttribute('api-url') || '').replace(/\/+$/, '');
  }

  connectedCallback() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    this.listBox = el('div');
    this.detailBox = el('div');
    const s1 = el('div', null, 'section');
    s1.append(el('h3', 'Tareas'), this.listBox);
    const s2 = el('div', null, 'section');
    s2.append(el('h3', 'Detalle'), this.detailBox);
    this.shadowRoot.replaceChildren(style, s1, s2);
    this.detailBox.append(el('p', 'Selecciona una tarea para ver su detalle.', 'muted'));

    ['todo:created', 'todo:updated', 'todo:deleted'].forEach((t) =>
      window.addEventListener(t, this._onChange));
    this.loadList();
  }

  disconnectedCallback() {
    ['todo:created', 'todo:updated', 'todo:deleted'].forEach((t) =>
      window.removeEventListener(t, this._onChange));
  }

  async request(path) {
    const res = await fetch(this.apiUrl + path);
    if (!res.ok) {
      let msg = '';
      try { const b = await res.json(); msg = b.message || b.error || ''; } catch (_) {}
      throw new Error(msg || `Error HTTP ${res.status}`);
    }
    return res.json();
  }

  // ---- Lista ----
  async loadList() {
    if (!this.apiUrl) { this.listState = 'error'; this.listError = 'Falta el atributo api-url'; this.renderList(); return; }
    if (this.todos.length === 0) { this.listState = 'loading'; this.renderList(); }
    try {
      const data = await this.request('');
      this.todos = Array.isArray(data) ? data : (data.todos || data.items || data.data || []);
      this.listState = 'ok';
    } catch (err) {
      this.listState = 'error';
      this.listError = err.message || 'No se pudo cargar la lista';
    }
    this.renderList();
  }

  renderList() {
    if (this.listState === 'loading') { this.listBox.replaceChildren(el('p', 'Cargando tareas…', 'muted')); return; }
    if (this.listState === 'error') {
      const box = el('div', null, 'error');
      box.append(el('div', `No se pudieron cargar las tareas: ${this.listError}`));
      const retry = el('button', 'Reintentar');
      retry.addEventListener('click', () => this.loadList());
      box.append(retry);
      this.listBox.replaceChildren(box);
      return;
    }
    if (this.todos.length === 0) { this.listBox.replaceChildren(el('p', 'No hay tareas todavía.', 'muted')); return; }

    const ul = el('ul');
    this.todos.forEach((t) => {
      const li = el('li');
      const b = el('button', null, 'item' + (t.id === this.selectedId ? ' selected' : ''));
      b.append(el('span', t.title, t.completed ? 'done' : ''));
      if (t.completed) b.append(el('span', 'completada', 'badge'));
      b.addEventListener('click', () => this.select(t.id));
      li.append(b);
      ul.append(li);
    });
    this.listBox.replaceChildren(ul);
  }

  // ---- Detalle + historial ----
  select(id) {
    this.selectedId = id;
    this.renderList();
    window.dispatchEvent(new CustomEvent('todo:selected', { detail: { id } }));
    this.loadDetail(id);
  }

  async loadDetail(id) {
    this.detailBox.replaceChildren(el('p', 'Cargando detalle…', 'muted'));
    let todo;
    try {
      todo = await this.request('/' + encodeURIComponent(id));
    } catch (err) {
      if (this.selectedId !== id) return;
      this.detailBox.replaceChildren(el('div', `No se pudo cargar el detalle: ${err.message}`, 'error'));
      return;
    }
    if (this.selectedId !== id) return; // el usuario ya eligió otra

    const dl = el('dl');
    const rows = [
      ['Título', todo.title],
      ['Estado', todo.completed ? 'Completada' : 'Pendiente'],
      ['ID', todo.id],
      ['Creada', fmtDate(todo.createdAt)],
      ['Actualizada', fmtDate(todo.updatedAt)],
    ];
    rows.forEach(([k, v]) => { dl.append(el('dt', k), el('dd', v)); });

    const hist = el('div');
    hist.append(el('h3', 'Historial'), el('p', 'Cargando historial…', 'muted'));
    this.detailBox.replaceChildren(dl, hist);

    try {
      const data = await this.request('/' + encodeURIComponent(id) + '/history');
      if (this.selectedId !== id) return;
      const events = Array.isArray(data) ? data : (data.history || data.events || data.items || []);
      hist.replaceChildren(el('h3', 'Historial'));
      if (events.length === 0) hist.append(el('p', 'Sin eventos todavía.', 'muted'));
      events.forEach((ev) => {
        const row = el('div', null, 'event');
        row.append(
          el('span', ev.eventType || ev.type || ev.event || 'evento'),
          el('span', fmtDate(eventDate(ev)), 'muted'));
        hist.append(row);
      });
    } catch (err) {
      if (this.selectedId !== id) return;
      hist.replaceChildren(el('h3', 'Historial'), el('div', `No se pudo cargar el historial: ${err.message}`, 'error'));
    }
  }

  // ---- Eventos de otros MFE ----
  handleChange(e) {
    const d = e.detail;
    const id = d && typeof d === 'object' ? d.id : d;
    if (e.type === 'todo:deleted' && id !== undefined && id === this.selectedId) {
      this.selectedId = null;
      this.detailBox.replaceChildren(el('p', 'La tarea fue eliminada.', 'muted'));
    }
    this.loadList();
    if (e.type === 'todo:updated' && this.selectedId) this.loadDetail(this.selectedId);
  }
}

if (!customElements.get('todo-viewer')) customElements.define('todo-viewer', TodoViewer);
