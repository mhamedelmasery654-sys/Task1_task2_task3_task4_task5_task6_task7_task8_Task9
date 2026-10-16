(() => {
  const appSection = document.getElementById('appSection');
  const feedPanel = document.getElementById('feedPanel');
  if (!appSection || !feedPanel) return;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const token = () => sessionStorage.getItem('blogApiToken') || '';
  const user = () => { try { return JSON.parse(sessionStorage.getItem('blogApiUser') || 'null'); } catch { return null; } };
  const stamp = (value) => value ? new Date(value).toLocaleString() : '—';
  const bodyText = (value) => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const requestId = () => `wb-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const safe = (value) => {
    if (Array.isArray(value)) return value.map(safe);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !/(password|access.?token|authorization|secret|hash)/i.test(key)).map(([key, child]) => [key, safe(child)]));
  };
  async function request(path, { method = 'GET', body, auth = 'current', headers = {} } = {}) {
    const rid = requestId();
    const requestHeaders = { 'X-Request-Id': rid, ...headers };
    if (auth === 'current' && token()) requestHeaders.Authorization = `Bearer ${token()}`;
    if (auth === 'invalid') requestHeaders.Authorization = 'Bearer invalid-test-token';
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
    const started = performance.now();
    let response;
    try {
      response = await fetch(path, { method, headers: requestHeaders, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    } catch (error) {
      error.requestId = rid;
      throw error;
    }
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { response, data, duration: Math.round(performance.now() - started), requestId: response.headers.get('x-request-id') || data?.requestId || rid };
  }
  function status(el, text, tone = '') { if (el) { el.textContent = text; el.className = `wb-status ${tone}`; } }
  function noteCards(notes) {
    if (!Array.isArray(notes) || !notes.length) return '<p class="wb-empty">No notes found.</p>';
    return notes.map((note) => `<article class="wb-card"><div><strong>${esc(note.title)}</strong><span class="wb-pill">${esc(note.visibility || 'private')}</span></div><p>${esc(note.content ?? note.body)}</p><small>Note #${esc(note._id || note.id)} · Owner #${esc(note.ownerId)} · Updated ${esc(stamp(note.updatedAt))}</small><div class="wb-actions"><button type="button" data-note-edit="${esc(note._id || note.id)}">Edit</button><button type="button" class="wb-danger" data-note-delete="${esc(note._id || note.id)}">Delete</button></div></article>`).join('');
  }

  feedPanel.insertAdjacentHTML('afterend', `
    <section id="notesWorkbench" class="panel wb-panel hidden">
      <div class="wb-heading"><div><p class="eyebrow">MongoDB · Mongoose</p><h2>Notes workspace</h2><p>Private and shared notes are stored in MongoDB. The owner is always taken from your authenticated PostgreSQL account.</p></div><button id="wbNotesRefresh" class="secondary" type="button">Refresh</button></div>
      <div class="wb-grid"><div><form id="wbNoteForm" class="wb-form"><h3 id="wbNoteFormTitle">Create a note</h3><input name="id" type="hidden"><label>Title<input name="title" maxlength="160" required></label><label>Body<textarea name="body" rows="5" maxlength="20000" required></textarea></label><label>Visibility<select name="visibility"><option value="private">Private</option><option value="shared">Shared</option></select></label><div class="wb-actions"><button class="primary" type="submit">Save note</button><button id="wbNoteCancel" class="secondary hidden" type="button">Cancel edit</button></div><p id="wbNoteStatus" class="wb-status" aria-live="polite"></p></form></div><div><div class="wb-heading"><h3>My notes</h3><button id="wbFeedRefresh" class="secondary" type="button">Shared feed</button></div><div id="wbNotesList" class="wb-list"><p class="wb-empty">Sign in and refresh to load notes.</p></div></div></div>
    </section>
    <section id="apiWorkbench" class="panel wb-panel hidden">
      <div class="wb-heading"><div><p class="eyebrow">Live HTTP requests</p><h2>API Test Bench</h2><p>Requests go to this Express server. Credentials and access tokens are removed from displayed responses and are never saved in this page's history.</p></div></div>
      <div class="wb-bench"><div class="wb-form"><label>Endpoint catalog<select id="wbEndpoint"></select></label><label>HTTP method<select id="wbMethod"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></label><label>Path and query<input id="wbPath" value="/health"></label><label>Request headers (JSON)<textarea id="wbHeaders" rows="3">{}</textarea></label><label>Request body (JSON)<textarea id="wbBody" rows="6">{}</textarea></label><label>Authentication<select id="wbAuth"><option value="current">Current session token</option><option value="none">No token</option><option value="invalid">Invalid test token</option></select></label><div class="wb-actions"><button id="wbSend" class="primary" type="button">Send request</button><button id="wbRunSmoke" class="secondary" type="button">Run safe smoke tests</button></div></div><div><p id="wbBenchStatus" class="wb-status" aria-live="polite">Choose an endpoint or enter a path.</p><pre id="wbBenchResponse" class="wb-response">Response will appear here.</pre><div id="wbTestResults" class="wb-list"></div></div></div>
    </section>
    <section id="adminDataWorkbench" class="panel wb-panel hidden">
      <div class="wb-heading"><div><p class="eyebrow">Admin only · Live database records</p><h2>Project data explorer</h2><p>PostgreSQL: users, blog posts, settings and audit. MongoDB: notes. All data is fetched from protected server endpoints.</p></div><button id="wbAdminRefresh" class="secondary" type="button">Refresh health and data</button></div>
      <div id="wbDbHealth" class="wb-health"></div>
      <div class="wb-actions"><label>Dataset<select id="wbDataset"><option value="users">Users · PostgreSQL</option><option value="posts">Posts · PostgreSQL</option><option value="notes">Notes · MongoDB</option><option value="audit">Audit · PostgreSQL</option><option value="settings">Settings · PostgreSQL</option></select></label><label>Search<input id="wbDataSearch" type="search" placeholder="Optional search"></label><button id="wbLoadData" class="primary" type="button">Load live records</button></div>
      <pre id="wbAdminData" class="wb-response">Select a dataset and load records.</pre>
      <div id="wbAdminNoteManagement" class="wb-list"></div>
      <div class="wb-form"><h3>Notes mode</h3><p>Controls creation visibility only; existing private notes are never published automatically.</p><div class="wb-actions"><select id="wbNotesMode"><option value="private_only">private_only</option><option value="shared_only">shared_only</option><option value="both">both</option></select><button id="wbSaveNotesMode" class="secondary" type="button">Save mode</button></div><p id="wbModeStatus" class="wb-status" aria-live="polite"></p></div>
    </section>`);

  document.querySelector('.test-bench-panel')?.insertAdjacentElement('afterend', document.getElementById('apiWorkbench'));

  const endpoints = [
    ['Health', 'GET', '/health'], ['Auth', 'POST', '/auth/register'], ['Auth', 'POST', '/auth/login'], ['Auth', 'GET', '/auth/me'], ['Auth', 'POST', '/auth/change-password'],
    ['Posts', 'GET', '/posts'], ['Posts', 'GET', '/posts/search?q='], ['Posts', 'POST', '/posts'], ['Posts', 'GET', '/posts/:id'], ['Posts', 'PUT', '/posts/:id'], ['Posts', 'DELETE', '/posts/:id'],
    ['Notes', 'GET', '/notes'], ['Notes', 'GET', '/notes/mode'], ['Notes', 'GET', '/notes/feed'], ['Notes', 'GET', '/notes/search?q='], ['Notes', 'POST', '/notes'], ['Notes', 'GET', '/notes/:id'], ['Notes', 'PUT', '/notes/:id'], ['Notes', 'DELETE', '/notes/:id'],
    ['Admin', 'GET', '/admin/overview'], ['Admin', 'GET', '/admin/users'], ['Admin', 'GET', '/admin/users/:id'], ['Admin', 'PATCH', '/admin/users/:id'], ['Admin', 'PATCH', '/admin/users/:id/role'], ['Admin', 'PATCH', '/admin/users/:id/status'], ['Admin', 'POST', '/admin/users/:id/password-reset'], ['Admin', 'DELETE', '/admin/users/:id'], ['Admin', 'GET', '/admin/posts'], ['Admin', 'GET', '/admin/posts/:id'], ['Admin', 'PUT', '/admin/posts/:id'], ['Admin', 'DELETE', '/admin/posts/:id'], ['Admin', 'GET', '/admin/notes'], ['Admin', 'GET', '/admin/notes/search?q='], ['Admin', 'GET', '/admin/notes/:id'], ['Admin', 'PATCH', '/admin/notes/:id/visibility'], ['Admin', 'PUT', '/admin/notes/:id'], ['Admin', 'DELETE', '/admin/notes/:id'], ['Admin', 'GET', '/admin/settings/notes-mode'], ['Admin', 'PATCH', '/admin/settings/notes-mode'], ['Admin', 'GET', '/admin/audit'], ['Data Checks', 'GET', '/health']
  ];
  const endpointSelect = document.getElementById('wbEndpoint');
  endpointSelect.innerHTML = endpoints.map(([group, method, path], i) => `<option value="${i}">${esc(group)} · ${esc(method)} ${esc(path)}</option>`).join('');
  const methodEl = document.getElementById('wbMethod');
  const pathEl = document.getElementById('wbPath');
  const bodyEl = document.getElementById('wbBody');
  endpointSelect.addEventListener('change', () => {
    const [, method, path] = endpoints[Number(endpointSelect.value)];
    methodEl.value = method; pathEl.value = path;
    bodyEl.value = ['POST', 'PUT', 'PATCH'].includes(method) ? JSON.stringify(path.includes('/auth/register') ? { username: 'demo_user', email: 'demo@example.invalid', password: 'StrongPass123' } : path.includes('/notes') ? { title: 'Workbench demo note', content: 'Sample content for API testing.', visibility: 'private' } : path.includes('/posts') ? { title: 'Workbench demo post', content: 'Sample content.' } : {}, null, 2) : '{}';
  });
  document.getElementById('wbSend').addEventListener('click', async () => {
    const output = document.getElementById('wbBenchResponse');
    const statusEl = document.getElementById('wbBenchStatus');
    try {
      if ((methodEl.value === 'DELETE' || /\/visibility(?:\?|$)/.test(pathEl.value)) && !window.confirm(`This sends ${methodEl.value} ${pathEl.value}. It may permanently delete a record or change its visibility. Continue only if this is a disposable test record.`)) return;
      const headers = JSON.parse(document.getElementById('wbHeaders').value || '{}');
      const bodyValue = document.getElementById('wbBody').value.trim();
      const body = ['GET', 'DELETE'].includes(methodEl.value) || !bodyValue ? undefined : JSON.parse(bodyValue);
      const auth = document.getElementById('wbAuth').value;
      const result = await request(pathEl.value, { method: methodEl.value, body, auth, headers });
      const payload = safe(result.data);
      status(statusEl, `${result.response.status} ${result.response.statusText} · ${result.duration} ms · Request ID ${result.requestId} · Expected: HTTP 2xx for a valid request (or 4xx for a deliberate negative test).`, result.response.ok ? 'success' : 'error');
      output.textContent = bodyText(payload);
    } catch (error) {
      status(statusEl, `${error.message} · Request ID ${error.requestId || 'unavailable'}`, 'error');
      output.textContent = 'Request was not completed. Check path, JSON input, authentication, and server availability.';
    }
  });
  document.getElementById('wbRunSmoke').addEventListener('click', async () => {
    const results = document.getElementById('wbTestResults');
    results.innerHTML = '<p class="wb-empty">Running safe, read-only checks…</p>';
    const cases = [
      ['GET /health responds', '/health', 'GET', 'none', (r) => r.response.status === 200],
      ['Missing token is rejected by /notes', '/notes', 'GET', 'none', (r) => r.response.status === 401],
      ['Missing token is rejected by /notes/feed', '/notes/feed', 'GET', 'none', (r) => r.response.status === 401],
      ['Invalid token is rejected by /admin/overview', '/admin/overview', 'GET', 'invalid', (r) => r.response.status === 401],
    ];
    const currentUser = user();
    if (token()) {
      cases.push(['Current token can access own Notes list', '/notes', 'GET', 'current', (r) => r.response.status === 200]);
      cases.push(['Malformed Note ID is rejected', '/notes/not-a-valid-object-id', 'GET', 'current', (r) => r.response.status === 400]);
      cases.push(['Note ownerId cannot be supplied by client', '/notes', 'POST', 'current', (r) => r.response.status === 400, { body: { title: 'Invalid owner test', content: 'Must not be stored.', visibility: 'private', ownerId: 999999 } }]);
      cases.push(['Missing Note fields are rejected', '/notes', 'POST', 'current', (r) => r.response.status === 400, { body: {} }]);
      if (currentUser?.role !== 'admin') cases.push(['Regular user is denied admin API', '/admin/overview', 'GET', 'current', (r) => r.response.status === 403]);
    }
    const report = [];
    for (const [label, path, method, auth, assertion, extra = {}] of cases) {
      try {
        const result = await request(path, { method, auth, body: extra.body });
        const dependencyBlocked = result.response.status === 503 && path.startsWith('/notes');
        report.push({ label, outcome: dependencyBlocked ? 'BLOCKED' : assertion(result) ? 'PASS' : 'FAIL', expected: dependencyBlocked ? 'Notes database available' : 'documented status', actual: result.response.status, requestId: result.requestId });
      } catch (error) { report.push({ label, outcome: 'BLOCKED', expected: 'HTTP response', actual: error.message, requestId: error.requestId || 'unavailable' }); }
    }
    report.push({ label: 'Cross-user ownership mutation test', outcome: 'NOT RUN', expected: 'disposable second account and generated Note', actual: 'not run by read-only smoke suite', requestId: '—' });
    report.push({ label: 'Destructive CRUD cleanup test', outcome: 'NOT RUN', expected: 'disposable test-only fixture and explicit confirmation', actual: 'not run by read-only smoke suite', requestId: '—' });
    results.innerHTML = report.map((item) => `<article class="wb-card"><strong class="${item.outcome === 'PASS' ? 'wb-pass' : 'wb-fail'}">${esc(item.outcome)} · ${esc(item.label)}</strong><small>Expected: ${esc(item.expected)} · Actual: ${esc(item.actual)} · Request ${esc(item.requestId)}</small></article>`).join('');
  });

  const noteList = document.getElementById('wbNotesList');
  const noteForm = document.getElementById('wbNoteForm');
  const noteStatus = document.getElementById('wbNoteStatus');
  let notesMode = 'both';
  let editingVisibility = null;
  function applyNotesMode(mode, currentVisibility = null) {
    notesMode = ['private_only', 'shared_only', 'both'].includes(mode) ? mode : 'both';
    const select = noteForm.elements.visibility;
    const choices = notesMode === 'private_only' ? ['private'] : notesMode === 'shared_only' ? ['shared'] : ['private', 'shared'];
    select.innerHTML = choices.map((value) => `<option value="${value}">${value}</option>`).join('');
    if (currentVisibility && !choices.includes(currentVisibility)) {
      select.insertAdjacentHTML('beforeend', `<option value="${esc(currentVisibility)}" selected>Existing: ${esc(currentVisibility)}</option>`);
      select.disabled = true;
      editingVisibility = currentVisibility;
    } else {
      select.disabled = false;
      editingVisibility = null;
      if (currentVisibility) select.value = currentVisibility;
      else select.value = notesMode === 'shared_only' ? 'shared' : 'private';
    }
    const feedButton = document.getElementById('wbFeedRefresh');
    feedButton.disabled = notesMode === 'private_only' && user()?.role !== 'admin';
    feedButton.title = feedButton.disabled ? 'The shared Notes feed is disabled in private_only mode.' : '';
  }
  async function loadNotesMode() {
    const result = await request('/notes/mode');
    if (result.response.ok) applyNotesMode(result.data?.notesMode || result.data?.mode || result.data?.settings?.notesMode || 'both');
  }
  async function refreshNotes(feed = false) {
    noteList.innerHTML = '<p class="wb-empty">Loading…</p>';
    try {
      await loadNotesMode();
      if (feed && notesMode === 'private_only' && user()?.role !== 'admin') throw new Error('The shared Notes feed is disabled in private_only mode.');
      const path = feed ? '/notes/feed' : '/notes';
      const result = await request(path);
      if (!result.response.ok) throw new Error(result.data?.error || `HTTP ${result.response.status}`);
      const notes = Array.isArray(result.data) ? result.data : result.data?.notes || result.data?.items || [];
      noteList.innerHTML = noteCards(notes);
      status(noteStatus, feed ? 'Shared Notes feed loaded.' : `${notes.length} note(s) loaded from MongoDB.`, 'success');
    } catch (error) { noteList.innerHTML = `<p class="wb-empty">${esc(error.message)}. Verify MongoDB connection in /health.</p>`; status(noteStatus, error.message, 'error'); }
  }
  document.getElementById('wbNotesRefresh').addEventListener('click', () => refreshNotes(false));
  document.getElementById('wbFeedRefresh').addEventListener('click', () => refreshNotes(true));
  noteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(noteForm);
    const id = String(formData.get('id') || '').trim();
    const body = { title: String(formData.get('title') || '').trim(), content: String(formData.get('body') || '').trim() };
    if (!id || !noteForm.elements.visibility.disabled) body.visibility = String(formData.get('visibility') || (notesMode === 'shared_only' ? 'shared' : 'private'));
    try {
      const result = await request(id ? `/notes/${encodeURIComponent(id)}` : '/notes', { method: id ? 'PUT' : 'POST', body });
      if (!result.response.ok) throw new Error(result.data?.error || `HTTP ${result.response.status}`);
      noteForm.reset(); noteForm.elements.id.value = ''; document.getElementById('wbNoteFormTitle').textContent = 'Create a note'; document.getElementById('wbNoteCancel').classList.add('hidden'); applyNotesMode(notesMode);
      status(noteStatus, id ? 'Note updated.' : 'Note created in MongoDB.', 'success'); await refreshNotes(false);
    } catch (error) { status(noteStatus, error.message, 'error'); }
  });
  document.getElementById('wbNoteCancel').addEventListener('click', () => { noteForm.reset(); noteForm.elements.id.value = ''; document.getElementById('wbNoteFormTitle').textContent = 'Create a note'; document.getElementById('wbNoteCancel').classList.add('hidden'); applyNotesMode(notesMode); });
  noteList.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-note-edit]');
    const del = event.target.closest('[data-note-delete]');
    if (edit) {
      try {
        const result = await request(`/notes/${encodeURIComponent(edit.dataset.noteEdit)}`);
        if (!result.response.ok) throw new Error(result.data?.error || `HTTP ${result.response.status}`);
        const note = result.data?.note || result.data;
        noteForm.elements.id.value = note._id || note.id; noteForm.elements.title.value = note.title || ''; noteForm.elements.body.value = note.content ?? note.body ?? ''; applyNotesMode(notesMode, note.visibility || 'private');
        document.getElementById('wbNoteFormTitle').textContent = 'Edit note'; document.getElementById('wbNoteCancel').classList.remove('hidden'); noteForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) { status(noteStatus, error.message, 'error'); }
    }
    if (del && window.confirm(`Delete note ${del.dataset.noteDelete}? This cannot be undone.`)) {
      try { const result = await request(`/notes/${encodeURIComponent(del.dataset.noteDelete)}`, { method: 'DELETE' }); if (!result.response.ok) throw new Error(result.data?.error || `HTTP ${result.response.status}`); status(noteStatus, 'Note deleted.', 'success'); await refreshNotes(false); }
      catch (error) { status(noteStatus, error.message, 'error'); }
    }
  });

  async function refreshAdmin() {
    const healthEl = document.getElementById('wbDbHealth');
    try {
      const result = await request('/health');
      healthEl.textContent = JSON.stringify(safe(result.data), null, 2);
    } catch (error) { healthEl.textContent = `Health check failed: ${error.message}`; }
    try {
      const result = await request('/admin/settings/notes-mode');
      if (result.response.ok) document.getElementById('wbNotesMode').value = result.data?.notesMode || result.data?.mode || 'both';
      else if (result.response.status === 404) status(document.getElementById('wbModeStatus'), 'Settings endpoint is not available yet.', 'error');
    } catch (error) { status(document.getElementById('wbModeStatus'), error.message, 'error'); }
  }
  document.getElementById('wbAdminRefresh').addEventListener('click', refreshAdmin);
  document.getElementById('wbLoadData').addEventListener('click', async () => {
    const dataset = document.getElementById('wbDataset').value;
    const search = document.getElementById('wbDataSearch').value.trim();
    const target = document.getElementById('wbAdminData');
    const paths = { users: '/admin/users?limit=100', posts: '/admin/posts?limit=100', notes: '/admin/notes?limit=100', audit: '/admin/audit?limit=100', settings: '/admin/settings/notes-mode' };
    const url = new URL(paths[dataset], location.origin); if (search && ['users', 'posts', 'notes'].includes(dataset)) url.searchParams.set('search', search);
    target.textContent = 'Loading live records…';
    const adminNoteManagement = document.getElementById('wbAdminNoteManagement');
    try {
      const result = await request(`${url.pathname}${url.search}`);
      if (!result.response.ok) throw new Error(result.data?.error || `HTTP ${result.response.status}`);
      target.textContent = bodyText(safe(result.data));
      adminNoteManagement.innerHTML = dataset === 'notes' ? adminNoteCards(result.data?.notes || result.data?.items || (Array.isArray(result.data) ? result.data : [])) : '';
    } catch (error) { target.textContent = `${error.message} — admin access and database connectivity are required.`; adminNoteManagement.innerHTML = ''; }
  });
  function adminNoteCards(notes) {
    if (!Array.isArray(notes) || !notes.length) return '<p class="wb-empty">No Notes to manage.</p>';
    return notes.map((note) => {
      const id = note._id || note.id;
      return `<article class="wb-card"><div><strong>${esc(note.title)}</strong><span class="wb-pill">${esc(note.visibility || 'private')}</span></div><p>${esc(note.content ?? note.body)}</p><small>MongoDB · Note #${esc(id)} · Owner #${esc(note.ownerId)}</small><div class="wb-actions"><button type="button" data-admin-note-edit="${esc(id)}">Edit</button><button type="button" data-admin-note-visibility="${esc(id)}" data-visibility="${esc(note.visibility || 'private')}">Change visibility</button><button type="button" class="wb-danger" data-admin-note-delete="${esc(id)}">Delete</button></div></article>`;
    }).join('');
  }
  document.getElementById('wbAdminNoteManagement').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-admin-note-edit],[data-admin-note-visibility],[data-admin-note-delete]');
    if (!button) return;
    const id = button.dataset.adminNoteEdit || button.dataset.adminNoteVisibility || button.dataset.adminNoteDelete;
    const reload = () => document.getElementById('wbLoadData').click();
    try {
      if (button.hasAttribute('data-admin-note-edit')) {
        const current = await request(`/admin/notes/${encodeURIComponent(id)}`);
        if (!current.response.ok) throw new Error(current.data?.error || `HTTP ${current.response.status}`);
        const note = current.data?.note || current.data;
        const title = window.prompt('Edit note title:', note.title || ''); if (title === null) return;
        const content = window.prompt('Edit note body:', note.content ?? note.body ?? ''); if (content === null) return;
        const saved = await request(`/admin/notes/${encodeURIComponent(id)}`, { method: 'PUT', body: { title, content, visibility: note.visibility || 'private' } });
        if (!saved.response.ok) throw new Error(saved.data?.error || `HTTP ${saved.response.status}`);
      } else if (button.hasAttribute('data-admin-note-visibility')) {
        const nextVisibility = button.dataset.visibility === 'shared' ? 'private' : 'shared';
        if (!window.confirm(`Change Note ${id} visibility from ${button.dataset.visibility} to ${nextVisibility}? This changes who can read the existing note and will be audited.`)) return;
        const changed = await request(`/admin/notes/${encodeURIComponent(id)}/visibility`, { method: 'PATCH', body: { visibility: nextVisibility } });
        if (!changed.response.ok) throw new Error(changed.data?.error || `HTTP ${changed.response.status}`);
      } else {
        if (!window.confirm(`Permanently delete Note ${id} from MongoDB? This cannot be undone.`)) return;
        const removed = await request(`/admin/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!removed.response.ok) throw new Error(removed.data?.error || `HTTP ${removed.response.status}`);
      }
      await reload();
    } catch (error) { document.getElementById('wbAdminData').textContent = `Admin Notes operation failed: ${error.message}`; }
  });
  document.getElementById('wbSaveNotesMode').addEventListener('click', async () => {
    const mode = document.getElementById('wbNotesMode').value;
    try { const result = await request('/admin/settings/notes-mode', { method: 'PATCH', body: { notesMode: mode } }); if (!result.response.ok) throw new Error(result.data?.error || `HTTP ${result.response.status}`); status(document.getElementById('wbModeStatus'), `Notes mode saved: ${mode}. Existing notes were not changed.`, 'success'); }
    catch (error) { status(document.getElementById('wbModeStatus'), error.message, 'error'); }
  });

  function updateVisibility() {
    const authenticated = Boolean(token() && user());
    const isAdmin = authenticated && user()?.role === 'admin' && !user()?.mustChangePassword;
    document.getElementById('notesWorkbench').classList.toggle('hidden', !authenticated);
    document.getElementById('apiWorkbench').classList.remove('hidden');
    document.getElementById('adminDataWorkbench').classList.toggle('hidden', !isAdmin);
  }
  const observer = new MutationObserver(updateVisibility);
  observer.observe(appSection, { attributes: true, attributeFilter: ['class'] });
  observer.observe(document.getElementById('userBadge') || appSection, { childList: true, characterData: true, subtree: true });
  window.addEventListener('storage', updateVisibility);
  window.addEventListener('focus', updateVisibility);
  updateVisibility();
})();
