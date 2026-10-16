const state = {
  token: sessionStorage.getItem('blogApiToken') || '',
  user: (() => {
    try {
      return JSON.parse(sessionStorage.getItem('blogApiUser') || 'null');
    } catch {
      return null;
    }
  })(),
  posts: [],
  activePostId: null,
  requestLog: [],
  adminPanelOpen: false,
  adminTab: 'overview',
  resetRequiresLogin: false,
  userPage: 1,
  userTotal: 0,
  selectedAdminUser: null,
  postPage: 1,
  postTotal: 0,
  auditPage: 1,
  auditTotal: 0,
};

const elements = {
  authSection: document.getElementById('authSection'),
  appSection: document.getElementById('appSection'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  userBadge: document.getElementById('userBadge'),
  adminPanelToggle: document.getElementById('adminPanelToggle'),
  closeAdminPanel: document.getElementById('closeAdminPanel'),
  adminPanel: document.getElementById('adminPanel'),
  feedPanel: document.getElementById('feedPanel'),
  passwordChangeSection: document.getElementById('passwordChangeSection'),
  passwordChangeForm: document.getElementById('passwordChangeForm'),
  postForm: document.getElementById('postForm'),
  feedList: document.getElementById('feedList'),
  feedStatus: document.getElementById('feedStatus'),
  healthCheckBtn: document.getElementById('healthCheckBtn'),
  meCheckBtn: document.getElementById('meCheckBtn'),
  adminAccessTestBtn: document.getElementById('adminAccessTestBtn'),
  benchOutput: document.getElementById('benchOutput'),
  requestLog: document.getElementById('requestLog'),
  clearRequestLogBtn: document.getElementById('clearRequestLogBtn'),
  searchForm: document.getElementById('searchForm'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  adminUsersTable: document.getElementById('adminUsersTable'),
  adminUserSearch: document.getElementById('adminUserSearch'),
  adminUserSort: document.getElementById('adminUserSort'),
  adminUsersStatus: document.getElementById('adminUsersStatus'),
  adminUserEditor: document.getElementById('adminUserEditor'),
  adminUserEditorStatus: document.getElementById('adminUserEditorStatus'),
  adminPostsTable: document.getElementById('adminPostsTable'),
  adminAuditList: document.getElementById('adminAuditList'),
  postModal: document.getElementById('postModal'),
  temporaryPasswordModal: document.getElementById('temporaryPasswordModal'),
  temporaryPasswordInput: document.getElementById('temporaryPasswordInput'),
  copyTemporaryPasswordBtn: document.getElementById('copyTemporaryPasswordBtn'),
  copyPasswordStatus: document.getElementById('copyPasswordStatus'),
  modalTitle: document.getElementById('modalTitle'),
  modalMeta: document.getElementById('modalMeta'),
  modalForm: document.getElementById('modalForm'),
  modalTitleInput: document.getElementById('modalTitleInput'),
  modalContentInput: document.getElementById('modalContentInput'),
  deletePostBtn: document.getElementById('deletePostBtn'),
  savePostBtn: document.getElementById('savePostBtn'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  toast: document.getElementById('toast'),
};

const authTabs = document.querySelectorAll('[data-auth-tab]');

function showToast(message, tone = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${tone}`;
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3200);
}

function showRequestError(error, fallbackMessage = 'Request failed.') {
  const detail = error && error.requestId ? ` (Request ID: ${error.requestId})` : '';
  showToast(`${error?.message || fallbackMessage}${detail}`, 'error');
}

function setStatus(message, tone = 'info') {
  elements.feedStatus.textContent = message;
  elements.feedStatus.className = `status-message ${tone}`;
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  sessionStorage.setItem('blogApiToken', token);
  sessionStorage.setItem('blogApiUser', JSON.stringify(user));
}

function clearSession() {
  state.token = '';
  state.user = null;
  state.posts = [];
  state.activePostId = null;
  state.adminPanelOpen = false;
  state.selectedAdminUser = null;
  sessionStorage.removeItem('blogApiToken');
  sessionStorage.removeItem('blogApiUser');
  closeTemporaryPasswordModal();
}

function formatBenchMessage(title, payload) {
  const requestId = payload && payload.requestId ? `Request ID: ${payload.requestId}` : 'Request ID: unavailable';
  const summary = payload && payload.error ? `Error: ${payload.error}` : JSON.stringify(payload, null, 2);
  return `<strong>${escapeHtml(title)}</strong><br><span>${escapeHtml(requestId)}</span><pre>${escapeHtml(summary)}</pre>`;
}

function sanitizeResponse(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeResponse);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(password|access.?token|authorization|secret|hash)/i.test(key))
    .map(([key, child]) => [key, sanitizeResponse(child)]));
}

function renderRequestLog() {
  if (!state.requestLog.length) {
    elements.requestLog.innerHTML = '<li class="empty-state">API requests will appear here. Sensitive credentials and tokens are never shown.</li>';
    return;
  }

  elements.requestLog.innerHTML = state.requestLog.map((entry) => `
    <li class="request-log-entry ${entry.ok === false ? 'failed' : entry.ok === true ? 'passed' : 'pending'}">
      <div class="request-log-title">
        <strong>${escapeHtml(entry.method)} ${escapeHtml(entry.path)}</strong>
        <span class="request-status">${escapeHtml(entry.status)}</span>
      </div>
      <div class="request-log-meta">${escapeHtml(entry.duration)} ms · ${escapeHtml(entry.requestId)} · ${escapeHtml(entry.outcome)}</div>
      <pre>${escapeHtml(JSON.stringify(entry.response, null, 2))}</pre>
    </li>
  `).join('');
}

function newRequestId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `ui-${window.crypto.randomUUID()}`;
  }
  return `ui-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function apiRequest(path, options = {}) {
  const method = options.method || 'GET';
  const startedAt = performance.now();
  const requestId = newRequestId();
  const logEntry = {
    method,
    path,
    status: 'Pending',
    duration: '—',
    requestId,
    outcome: 'Request in progress',
    response: {},
    ok: null,
  };
  state.requestLog.unshift(logEntry);
  state.requestLog = state.requestLog.slice(0, 30);
  renderRequestLog();

  const headers = { ...(options.headers || {}) };
  headers['X-Request-Id'] = requestId;
  if (options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
  }
  if (state.token && !options.skipAuth) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const authenticatedRequest = Boolean(state.token && !options.skipAuth);
  try {
    const response = await fetch(path, {
      method,
      headers,
      body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
    });

    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: 'The server returned an invalid response.' };
      }
    }

    const actualRequestId = response.headers.get('x-request-id') || payload.requestId || requestId;
    logEntry.status = String(response.status);
    logEntry.duration = Math.round(performance.now() - startedAt);
    logEntry.requestId = actualRequestId;
    logEntry.ok = response.ok;
    logEntry.outcome = response.ok ? 'PASS' : payload.error || response.statusText || 'Request failed';
    logEntry.response = sanitizeResponse(payload);
    renderRequestLog();

    if (!response.ok) {
      const detailText = Array.isArray(payload.details)
        ? payload.details.map((detail) => `${detail.field || 'input'}: ${detail.message}`).join('; ')
        : '';
      const message = [payload.error || payload.message || 'Request failed.', detailText].filter(Boolean).join(' — ');
      const error = new Error(message);
      error.requestId = actualRequestId;
      error.status = response.status;
      error.payload = sanitizeResponse(payload);
      if (response.status === 401 && authenticatedRequest) {
        clearSession();
        renderLayout();
        setStatus('Your session is no longer valid. Please sign in again.', 'error');
      }
      throw error;
    }

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      payload.requestId = actualRequestId;
    }
    return payload;
  } catch (error) {
    if (logEntry.status === 'Pending') {
      logEntry.status = 'Network error';
      logEntry.duration = Math.round(performance.now() - startedAt);
      logEntry.ok = false;
      logEntry.outcome = error.message || 'Network request failed';
      logEntry.response = { error: logEntry.outcome };
      renderRequestLog();
    }
    if (!error.requestId) {
      error.requestId = logEntry.requestId;
    }
    throw error;
  }
}

function renderAuthTabs(activeTab) {
  authTabs.forEach((button) => {
    const isActive = button.dataset.authTab === activeTab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  const isRegister = activeTab === 'register';
  elements.loginForm.classList.toggle('hidden', isRegister);
  elements.registerForm.classList.toggle('hidden', !isRegister);
}

function renderLayout() {
  const isAuthenticated = Boolean(state.token && state.user);
  const mustChangePassword = isAuthenticated && state.user.mustChangePassword;
  const isAdmin = isAuthenticated && state.user.role === 'admin' && !mustChangePassword;
  elements.authSection.classList.toggle('hidden', isAuthenticated);
  elements.appSection.classList.toggle('hidden', !isAuthenticated);
  elements.logoutBtn.classList.toggle('hidden', !isAuthenticated);
  elements.meCheckBtn.classList.toggle('hidden', !isAuthenticated);
  elements.adminAccessTestBtn.classList.toggle('hidden', !isAuthenticated);
  elements.passwordChangeSection.classList.toggle('hidden', !mustChangePassword);
  elements.feedPanel.classList.toggle('hidden', mustChangePassword || (isAdmin && state.adminPanelOpen));
  elements.adminPanel.classList.toggle('hidden', !isAdmin || !state.adminPanelOpen);
  elements.adminPanelToggle.classList.toggle('hidden', !isAdmin);

  if (isAuthenticated) {
    elements.userBadge.textContent = `${state.user.username} (${state.user.role})`;
    elements.userBadge.classList.remove('hidden');
  } else {
    elements.userBadge.textContent = '';
    elements.userBadge.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
    elements.adminPanelToggle.classList.add('hidden');
    state.adminPanelOpen = false;
  }
}

function renderPosts() {
  if (!state.posts.length) {
    elements.feedList.innerHTML = '<div class="empty-state">No posts match this feed yet.</div>';
    return;
  }

  const canManage = (post) => {
    if (!state.user) return false;
    return state.user.role === 'admin' || Number(post.author?.id) === Number(state.user.id);
  };

  elements.feedList.innerHTML = state.posts.map((post) => {
    const isOwner = canManage(post);
    return `
      <article class="post-card" data-post-id="${post.id}">
        <div class="post-header">
          <div>
            <h3>${escapeHtml(post.title)}</h3>
            <div class="post-meta">${escapeHtml(post.author?.username || 'Unknown author')} • ${formatDate(post.createdAt)}</div>
          </div>
          <div class="post-actions">
            <button class="small secondary" data-action="view" data-id="${post.id}" type="button">View</button>
            ${isOwner ? `<button class="small secondary" data-action="edit" data-id="${post.id}" type="button">Edit</button>` : ''}
            ${isOwner ? `<button class="small danger" data-action="delete" data-id="${post.id}" type="button">Delete</button>` : ''}
          </div>
        </div>
        <p class="post-content">${escapeHtml(post.content)}</p>
      </article>
    `;
  }).join('');
}

async function loadCurrentUser() {
  const data = await apiRequest('/auth/me');
  state.user = data.user;
  saveSession(state.token, state.user);
  renderLayout();
}

async function runHealthCheck() {
  try {
    const data = await apiRequest('/health');
    elements.benchOutput.innerHTML = formatBenchMessage('GET /health', data);
    showToast('Health check succeeded.', 'success');
  } catch (error) {
    elements.benchOutput.innerHTML = formatBenchMessage('GET /health', { error: error.message, requestId: error.requestId });
    showRequestError(error, 'Health check failed.');
  }
}

async function runMeCheck() {
  if (!state.token) {
    elements.benchOutput.innerHTML = formatBenchMessage('GET /auth/me', { error: 'No active session token available.' });
    showToast('No active session token available.', 'error');
    return;
  }

  try {
    const data = await apiRequest('/auth/me');
    elements.benchOutput.innerHTML = formatBenchMessage('GET /auth/me', data);
    showToast('Current user loaded successfully.', 'success');
  } catch (error) {
    elements.benchOutput.innerHTML = formatBenchMessage('GET /auth/me', { error: error.message, requestId: error.requestId });
    showRequestError(error, 'Unable to read /auth/me.');
  }
}

async function loadFeed() {
  const rawInput = elements.searchInput.value.trim();
  let result;

  if (rawInput) {
    result = await apiRequest(`/posts/search?q=${encodeURIComponent(rawInput)}`);
  } else {
    result = await apiRequest('/posts');
  }

  state.posts = Array.isArray(result) ? result : result.posts || [];
  renderPosts();

  if (!state.posts.length) {
    setStatus(rawInput ? `No posts matched “${rawInput}”.` : 'There are no posts in the feed yet.', 'info');
  } else {
    setStatus(rawInput ? `Showing ${state.posts.length} result(s) for “${rawInput}”.` : 'Feed refreshed successfully.', 'success');
  }
}

function setPanelStatus(element, message, tone = 'info') {
  element.textContent = message;
  element.className = `status-message ${tone}`;
}

function adminIsActive() {
  return Boolean(state.token && state.user?.role === 'admin' && !state.user.mustChangePassword);
}

function setAdminTab(tab) {
  state.adminTab = tab;
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.adminTab === tab);
  });
  document.querySelectorAll('.admin-tab-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `admin${tab[0].toUpperCase()}${tab.slice(1)}Section`);
  });
  const loaders = {
    overview: loadAdminOverview,
    users: loadAdminUsers,
    posts: loadAdminPosts,
    audit: loadAdminAudit,
  };
  loaders[tab]().catch((error) => showRequestError(error, `Unable to load admin ${tab}.`));
}

function openAdminPanel() {
  if (!adminIsActive()) return;
  state.adminPanelOpen = true;
  renderLayout();
  setAdminTab(state.adminTab);
}

async function loadAdminOverview() {
  if (!adminIsActive()) return;
  const status = document.getElementById('adminOverviewStatus');
  setPanelStatus(status, 'Loading overview…');
  try {
    const data = await apiRequest('/admin/overview');
    const cards = [
      ['Users', data.userCount],
      ['Active users', data.activeUserCount],
      ['Disabled users', data.disabledUserCount],
      ['Active admins', data.adminCount],
      ['Posts', data.postCount],
    ];
    document.getElementById('adminOverviewCards').innerHTML = cards.map(([label, value]) => `
      <article class="admin-stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>
    `).join('');
    const authors = data.topAuthors || [];
    document.getElementById('adminTopAuthors').innerHTML = authors.length
      ? `<ol>${authors.map((author) => `<li>${escapeHtml(author.username)} — ${escapeHtml(author.postCount)} posts</li>`).join('')}</ol>`
      : '<p class="empty-state">No authors or posts yet.</p>';
    const byAuthor = data.postsByAuthor || [];
    document.getElementById('adminPostsByAuthor').innerHTML = byAuthor.length
      ? `<ul>${byAuthor.map((author) => `<li>${escapeHtml(author.username)} — ${escapeHtml(author.postCount)} posts</li>`).join('')}</ul>`
      : '<p class="empty-state">No posts to summarize.</p>';
    setPanelStatus(status, 'Overview updated.', 'success');
  } catch (error) {
    setPanelStatus(status, error.message || 'Unable to load overview.', 'error');
    throw error;
  }
}

async function loadAdminUsers() {
  if (!adminIsActive()) return;
  setPanelStatus(elements.adminUsersStatus, 'Loading users…');
  const params = new URLSearchParams({
    page: String(state.userPage),
    limit: '20',
    sortBy: elements.adminUserSort.value || 'id',
    sortOrder: 'ASC',
  });
  if (elements.adminUserSearch.value.trim()) params.set('search', elements.adminUserSearch.value.trim());
  try {
    const data = await apiRequest(`/admin/users?${params}`);
    state.userTotal = data.total;
    elements.adminUsersTable.innerHTML = data.users.length ? data.users.map((user) => `
      <tr>
        <td>${escapeHtml(user.id)}</td><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td><td>${user.disabled ? 'Disabled' : 'Active'}${user.mustChangePassword ? ' · Password change required' : ''}</td>
        <td>${escapeHtml(formatDate(user.createdAt))}</td>
        <td><button class="small secondary" data-admin-user-action="edit" data-user-id="${escapeHtml(user.id)}" type="button">Manage</button></td>
      </tr>
    `).join('') : '<tr><td colspan="7">No users found.</td></tr>';
    renderPagination('adminUsers', state.userPage, state.userTotal, 20);
    setPanelStatus(elements.adminUsersStatus, `${state.userTotal} user(s) found.`, 'success');
  } catch (error) {
    setPanelStatus(elements.adminUsersStatus, error.message || 'Unable to load users.', 'error');
    throw error;
  }
}

function renderPagination(prefix, page, total, limit) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const label = document.getElementById(`${prefix}Page`);
  const previous = document.getElementById(`${prefix}Previous`);
  const next = document.getElementById(`${prefix}Next`);
  label.textContent = `Page ${page} of ${pageCount} (${total} total)`;
  previous.disabled = page <= 1;
  next.disabled = page >= pageCount;
}

async function openAdminUserEditor(id) {
  const result = await apiRequest(`/admin/users/${encodeURIComponent(id)}`);
  const user = result.user;
  state.selectedAdminUser = user;
  const form = elements.adminUserEditor;
  form.elements.id.value = user.id;
  form.elements.username.value = user.username;
  form.elements.email.value = user.email;
  form.elements.role.value = user.role;
  document.getElementById('adminUserEditorTitle').textContent = `Manage ${user.username} (ID ${user.id})`;
  const statusButton = document.getElementById('toggleUserStatus');
  statusButton.textContent = user.disabled ? 'Re-enable account' : 'Disable account';
  statusButton.dataset.disabled = String(user.disabled);
  elements.adminUserEditor.classList.remove('hidden');
  setPanelStatus(elements.adminUserEditorStatus, `Created ${formatDate(user.createdAt)} · Updated ${formatDate(user.updatedAt)}`);
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function handleAdminUserAction(event) {
  const button = event.target.closest('[data-admin-user-action="edit"]');
  if (!button) return;
  try {
    await openAdminUserEditor(button.dataset.userId);
  } catch (error) {
    showRequestError(error, 'Unable to load user details.');
  }
}

async function resetSelectedUserPassword() {
  const user = state.selectedAdminUser;
  if (!user) return;
  if (!window.confirm(`Reset ${user.username}'s password? Their current sessions will be revoked and they must change the temporary password at next sign-in.`)) return;
  try {
    const result = await apiRequest(`/admin/users/${encodeURIComponent(user.id)}/password-reset`, { method: 'POST' });
    openTemporaryPasswordModal(result.temporaryPassword);
    setPanelStatus(elements.adminUserEditorStatus, 'Password reset. The previous password cannot be recovered; only a hash is stored.', 'success');
    if (Number(user.id) === Number(state.user.id)) {
      state.resetRequiresLogin = true;
      state.token = '';
      state.user = null;
      state.adminPanelOpen = false;
      sessionStorage.removeItem('blogApiToken');
      sessionStorage.removeItem('blogApiUser');
      renderLayout();
    } else {
      await loadAdminUsers();
    }
  } catch (error) {
    showRequestError(error, 'Unable to reset the password.');
  }
}

function openTemporaryPasswordModal(temporaryPassword) {
  elements.temporaryPasswordInput.value = temporaryPassword;
  elements.copyPasswordStatus.textContent = '';
  document.getElementById('temporaryPasswordOldStatus').textContent = 'Previous password: not recoverable; only a hash is stored.';
  elements.temporaryPasswordModal.classList.remove('hidden');
  elements.temporaryPasswordModal.setAttribute('aria-hidden', 'false');
  elements.temporaryPasswordInput.focus();
  elements.temporaryPasswordInput.select();
}

function closeTemporaryPasswordModal() {
  elements.temporaryPasswordModal.classList.add('hidden');
  elements.temporaryPasswordModal.setAttribute('aria-hidden', 'true');
  elements.temporaryPasswordInput.value = '';
  elements.copyPasswordStatus.textContent = '';
  if (state.resetRequiresLogin) {
    state.resetRequiresLogin = false;
    clearSession();
    renderLayout();
    setStatus('Password reset complete. Please sign in again with the temporary password.', 'info');
  }
}

async function loadAdminPosts() {
  if (!adminIsActive()) return;
  const status = document.getElementById('adminPostsStatus');
  setPanelStatus(status, 'Loading posts…');
  const params = new URLSearchParams({ page: String(state.postPage), limit: '20' });
  const search = document.getElementById('adminPostSearch').value.trim();
  const authorId = document.getElementById('adminPostAuthor').value.trim();
  const from = document.getElementById('adminPostFrom').value;
  const to = document.getElementById('adminPostTo').value;
  if (search) params.set('search', search);
  if (authorId) params.set('authorId', authorId);
  if (from) params.set('from', `${from}T00:00:00.000Z`);
  if (to) params.set('to', `${to}T23:59:59.999Z`);
  try {
    const data = await apiRequest(`/admin/posts?${params}`);
    state.postTotal = data.total;
    elements.adminPostsTable.innerHTML = data.posts.length ? data.posts.map((post) => `
      <tr>
        <td>${escapeHtml(post.id)}</td><td>${escapeHtml(post.title)}</td>
        <td>${escapeHtml(post.content.length > 120 ? `${post.content.slice(0, 120)}…` : post.content)}</td>
        <td>${escapeHtml(post.author?.username || 'Unknown')} (#${escapeHtml(post.author?.id || '')})</td>
        <td>${escapeHtml(formatDate(post.createdAt))}</td><td>${escapeHtml(formatDate(post.updatedAt))}</td>
        <td><button class="small secondary" data-admin-post-action="edit" data-post-id="${escapeHtml(post.id)}" type="button">Edit</button>
        <button class="small danger" data-admin-post-action="delete" data-post-id="${escapeHtml(post.id)}" data-title="${escapeHtml(post.title)}" type="button">Delete</button></td>
      </tr>
    `).join('') : '<tr><td colspan="7">No posts found.</td></tr>';
    renderPagination('adminPosts', state.postPage, state.postTotal, 20);
    setPanelStatus(status, `${state.postTotal} post(s) found.`, 'success');
  } catch (error) {
    setPanelStatus(status, error.message || 'Unable to load posts.', 'error');
    throw error;
  }
}

async function handleAdminPostAction(event) {
  const button = event.target.closest('[data-admin-post-action]');
  if (!button) return;
  const id = button.dataset.postId;
  if (button.dataset.adminPostAction === 'edit') {
    await openPostDetail(id);
    return;
  }
  if (!window.confirm(`Delete post "${button.dataset.title}" (ID ${id})? This cannot be undone.`)) return;
  try {
    await apiRequest(`/admin/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await Promise.all([loadAdminPosts(), loadFeed()]);
    showToast('Post deleted successfully.', 'success');
  } catch (error) {
    showRequestError(error, 'Unable to delete post.');
  }
}

async function loadAdminAudit() {
  if (!adminIsActive()) return;
  const status = document.getElementById('adminAuditStatus');
  setPanelStatus(status, 'Loading audit log…');
  try {
    const data = await apiRequest(`/admin/audit?page=${state.auditPage}&limit=20`);
    state.auditTotal = data.total;
    elements.adminAuditList.innerHTML = data.entries.length ? data.entries.map((entry) => `
      <article class="admin-audit-entry">
        <strong>${escapeHtml(entry.action)}</strong>
        <span>${escapeHtml(entry.actor_username)} → ${escapeHtml(entry.target_type)} #${escapeHtml(entry.target_id)}</span>
        <small>${escapeHtml(formatDate(entry.created_at))} · Request ${escapeHtml(entry.request_id || 'unavailable')}</small>
      </article>
    `).join('') : '<div class="empty-state">No administrative actions recorded.</div>';
    renderPagination('adminAudit', state.auditPage, state.auditTotal, 20);
    setPanelStatus(status, `${state.auditTotal} audit event(s).`, 'success');
  } catch (error) {
    setPanelStatus(status, error.message || 'Unable to load audit log.', 'error');
    throw error;
  }
}

async function copyTemporaryPassword() {
  const temporaryPassword = elements.temporaryPasswordInput.value;
  if (!temporaryPassword) {
    elements.copyPasswordStatus.textContent = 'There is no temporary password to copy.';
    return;
  }

  try {
    await navigator.clipboard.writeText(temporaryPassword);
    elements.copyPasswordStatus.textContent = 'Password copied to clipboard.';
  } catch {
    elements.temporaryPasswordInput.focus();
    elements.temporaryPasswordInput.select();
    elements.copyPasswordStatus.textContent = 'Copy was blocked. Select the password and copy it manually.';
  }
}

async function testAdminAccess() {
  try {
    const data = await apiRequest('/admin/users');
    elements.benchOutput.innerHTML = formatBenchMessage('GET /admin/users', data);
    showToast('Admin endpoint request succeeded.', 'success');
  } catch (error) {
    elements.benchOutput.innerHTML = formatBenchMessage('GET /admin/users', {
      error: error.message,
      requestId: error.requestId,
    });
    showRequestError(error, 'Admin endpoint request failed.');
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const isRegister = form.id === 'registerForm';
  const payload = {
    username: form.elements.username?.value?.trim(),
    email: form.elements.email?.value?.trim(),
    password: form.elements.password?.value,
  };

  try {
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    const data = await apiRequest(endpoint, { method: 'POST', body: payload });
    saveSession(data.accessToken, data.user);
    renderLayout();
    await loadCurrentUser();
    if (!state.user.mustChangePassword) await loadFeed();
    form.reset();
    showToast(state.user.mustChangePassword ? 'Change your temporary password to continue.' : isRegister ? 'Registration successful.' : 'Login successful.', state.user.mustChangePassword ? 'info' : 'success');
  } catch (error) {
    showRequestError(error, 'Authentication failed.');
  }
}

async function handlePasswordChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const currentPassword = form.elements.currentPassword.value;
  const newPassword = form.elements.newPassword.value;
  if (newPassword !== form.elements.confirmPassword.value) {
    showToast('The new passwords do not match.', 'error');
    return;
  }
  try {
    const result = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    form.reset();
    saveSession(result.accessToken, result.user);
    renderLayout();
    await loadFeed();
    showToast('Password changed. Your new session is active.', 'success');
  } catch (error) {
    showRequestError(error, 'Unable to change password.');
  }
}

async function handleCreatePost(event) {
  event.preventDefault();
  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();

  try {
    await apiRequest('/posts', {
      method: 'POST',
      body: { title, content },
    });
    elements.postForm.reset();
    await loadFeed();
    showToast('Post published successfully.', 'success');
  } catch (error) {
    showRequestError(error, 'Unable to create the post.');
  }
}

async function openPostDetail(id) {
  try {
    const data = await apiRequest(`/posts/${id}`);
    const post = data.post;
    state.activePostId = Number(post.id);
    elements.modalTitle.textContent = `${post.author?.username || 'Author'}'s post`;
    elements.modalMeta.textContent = `Posted ${formatDate(post.createdAt)} • Updated ${formatDate(post.updatedAt)}`;
    elements.modalTitleInput.value = post.title;
    elements.modalContentInput.value = post.content;

    const canManage = state.user && (state.user.role === 'admin' || Number(post.author?.id) === Number(state.user.id));
    elements.deletePostBtn.classList.toggle('hidden', !canManage);
    elements.savePostBtn.classList.toggle('hidden', !canManage);
    elements.modalTitleInput.readOnly = !canManage;
    elements.modalContentInput.readOnly = !canManage;
    elements.modalForm.dataset.postId = String(post.id);
    elements.postModal.classList.remove('hidden');
    elements.postModal.setAttribute('aria-hidden', 'false');
  } catch (error) {
    showRequestError(error, 'Unable to load the post.');
  }
}

async function handleModalSubmit(event) {
  event.preventDefault();
  const id = elements.modalForm.dataset.postId;
  if (!id) return;

  try {
    const adminEditing = adminIsActive() && state.adminPanelOpen;
    await apiRequest(`${adminEditing ? '/admin/posts' : '/posts'}/${id}`, {
      method: 'PUT',
      body: {
        title: elements.modalTitleInput.value.trim(),
        content: elements.modalContentInput.value.trim(),
      },
    });
    closeModal();
    await loadFeed();
    if (adminEditing) await loadAdminPosts();
    showToast('Post updated successfully.', 'success');
  } catch (error) {
    showRequestError(error, 'Unable to update the post.');
  }
}

async function handleDeletePost(id) {
  const confirmed = window.confirm('Are you sure you want to delete this post?');
  if (!confirmed) return;

  try {
    await apiRequest(`/posts/${id}`, { method: 'DELETE' });
    closeModal();
    await loadFeed();
    showToast('Post deleted successfully.', 'success');
  } catch (error) {
    showRequestError(error, 'Unable to delete the post.');
  }
}

function closeModal() {
  elements.postModal.classList.add('hidden');
  elements.postModal.setAttribute('aria-hidden', 'true');
  elements.modalForm.dataset.postId = '';
  elements.modalTitleInput.value = '';
  elements.modalContentInput.value = '';
  elements.modalTitleInput.readOnly = false;
  elements.modalContentInput.readOnly = false;
}

async function handleFeedClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === 'view') {
    await openPostDetail(id);
    return;
  }

  if (action === 'edit') {
    await openPostDetail(id);
    return;
  }

  if (action === 'delete') {
    await handleDeletePost(id);
  }
}

function handleLogout() {
  clearSession();
  renderLayout();
  elements.loginForm.reset();
  elements.registerForm.reset();
  elements.postForm.reset();
  elements.searchInput.value = '';
  elements.feedList.innerHTML = '';
  setStatus('Signed out. Please log in to continue.', 'info');
  renderAuthTabs('login');
  showToast('You have been logged out.', 'info');
}

async function bootstrap() {
  renderLayout();
  renderAuthTabs('login');

  if (state.token && state.user) {
    try {
      await loadCurrentUser();
      if (!state.user.mustChangePassword) await loadFeed();
    } catch {
      clearSession();
      renderLayout();
      setStatus('Your session expired. Please sign in again.', 'error');
    }
  } else {
    setStatus('Please log in or register to access the blog feed.', 'info');
  }
}

authTabs.forEach((button) => {
  button.addEventListener('click', () => renderAuthTabs(button.dataset.authTab));
});

elements.loginForm.addEventListener('submit', handleAuthSubmit);
elements.registerForm.addEventListener('submit', handleAuthSubmit);
elements.passwordChangeForm.addEventListener('submit', handlePasswordChange);
elements.logoutBtn.addEventListener('click', handleLogout);
elements.healthCheckBtn.addEventListener('click', runHealthCheck);
elements.meCheckBtn.addEventListener('click', runMeCheck);
elements.adminAccessTestBtn.addEventListener('click', testAdminAccess);
elements.adminPanelToggle.addEventListener('click', openAdminPanel);
elements.closeAdminPanel.addEventListener('click', () => {
  state.adminPanelOpen = false;
  renderLayout();
});
document.querySelectorAll('[data-admin-tab]').forEach((button) => {
  button.addEventListener('click', () => setAdminTab(button.dataset.adminTab));
});
elements.adminUsersTable.addEventListener('click', handleAdminUserAction);
elements.adminPostsTable.addEventListener('click', (event) => {
  handleAdminPostAction(event).catch((error) => showRequestError(error, 'Unable to manage post.'));
});
document.getElementById('adminUserSearchButton').addEventListener('click', () => {
  state.userPage = 1;
  loadAdminUsers().catch((error) => showRequestError(error, 'Unable to load users.'));
});
elements.adminUserSearch.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    document.getElementById('adminUserSearchButton').click();
  }
});
elements.adminUserSort.addEventListener('change', () => {
  state.userPage = 1;
  loadAdminUsers().catch((error) => showRequestError(error, 'Unable to load users.'));
});
document.getElementById('adminUsersPrevious').addEventListener('click', () => {
  state.userPage -= 1;
  loadAdminUsers().catch((error) => showRequestError(error, 'Unable to load users.'));
});
document.getElementById('adminUsersNext').addEventListener('click', () => {
  state.userPage += 1;
  loadAdminUsers().catch((error) => showRequestError(error, 'Unable to load users.'));
});
elements.adminUserEditor.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.elements.id.value;
  try {
    const result = await apiRequest(`/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { username: form.elements.username.value.trim(), email: form.elements.email.value.trim() },
    });
    state.selectedAdminUser = result.user;
    if (Number(id) === Number(state.user.id)) {
      handleLogout();
      showToast('Your profile was updated. Please sign in again.', 'info');
      return;
    }
    await Promise.all([loadAdminUsers(), openAdminUserEditor(id)]);
    setPanelStatus(elements.adminUserEditorStatus, 'Profile updated.', 'success');
  } catch (error) {
    setPanelStatus(elements.adminUserEditorStatus, error.message || 'Unable to update user.', 'error');
  }
});
document.getElementById('cancelUserEdit').addEventListener('click', () => {
  state.selectedAdminUser = null;
  elements.adminUserEditor.classList.add('hidden');
});
document.getElementById('saveUserRole').addEventListener('click', async () => {
  const user = state.selectedAdminUser;
  if (!user) return;
  const role = elements.adminUserEditor.elements.role.value;
  if (role === user.role) return;
  if (!window.confirm(`${role === 'admin' ? 'Grant admin access to' : 'Remove admin access from'} ${user.username}? Their existing sessions will be revoked.`)) return;
  try {
    const result = await apiRequest(`/admin/users/${encodeURIComponent(user.id)}/role`, { method: 'PATCH', body: { role } });
    state.selectedAdminUser = result.user;
    if (Number(user.id) === Number(state.user.id)) {
      handleLogout();
      return;
    }
    await Promise.all([loadAdminUsers(), openAdminUserEditor(user.id), loadAdminOverview()]);
    setPanelStatus(elements.adminUserEditorStatus, 'Role updated and existing sessions revoked.', 'success');
  } catch (error) {
    setPanelStatus(elements.adminUserEditorStatus, error.message || 'Unable to change role.', 'error');
  }
});
document.getElementById('toggleUserStatus').addEventListener('click', async (event) => {
  const user = state.selectedAdminUser;
  if (!user) return;
  const disabled = event.currentTarget.dataset.disabled !== 'true';
  const action = disabled ? 'disable' : 're-enable';
  if (!window.confirm(`${action} ${user.username}? ${disabled ? 'Their active sessions will be revoked and they will not be able to sign in.' : 'They will be able to sign in again.'}`)) return;
  try {
    const result = await apiRequest(`/admin/users/${encodeURIComponent(user.id)}/status`, { method: 'PATCH', body: { disabled } });
    state.selectedAdminUser = result.user;
    if (Number(user.id) === Number(state.user.id)) {
      handleLogout();
      return;
    }
    await Promise.all([loadAdminUsers(), openAdminUserEditor(user.id), loadAdminOverview()]);
    setPanelStatus(elements.adminUserEditorStatus, `Account ${disabled ? 'disabled' : 'enabled'} and existing sessions revoked.`, 'success');
  } catch (error) {
    setPanelStatus(elements.adminUserEditorStatus, error.message || 'Unable to change account status.', 'error');
  }
});
document.getElementById('resetUserPassword').addEventListener('click', resetSelectedUserPassword);
document.getElementById('deleteUser').addEventListener('click', async () => {
  const user = state.selectedAdminUser;
  if (!user) return;
  const confirmed = window.confirm(
    `Permanently delete ${user.username} (${user.email}, ID ${user.id})? All posts authored by this account will also be permanently deleted. This cannot be undone.`
  );
  if (!confirmed) return;
  try {
    await apiRequest(`/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    const deletingSelf = Number(user.id) === Number(state.user.id);
    state.selectedAdminUser = null;
    elements.adminUserEditor.classList.add('hidden');
    if (deletingSelf) {
      handleLogout();
      return;
    }
    await Promise.all([loadAdminUsers(), loadAdminOverview(), loadAdminAudit()]);
    showToast('User and their posts were permanently deleted.', 'success');
  } catch (error) {
    setPanelStatus(elements.adminUserEditorStatus, error.message || 'Unable to delete user.', 'error');
  }
});
document.getElementById('adminPostSearchButton').addEventListener('click', () => {
  state.postPage = 1;
  loadAdminPosts().catch((error) => showRequestError(error, 'Unable to load posts.'));
});
document.getElementById('adminPostsPrevious').addEventListener('click', () => {
  state.postPage -= 1;
  loadAdminPosts().catch((error) => showRequestError(error, 'Unable to load posts.'));
});
document.getElementById('adminPostsNext').addEventListener('click', () => {
  state.postPage += 1;
  loadAdminPosts().catch((error) => showRequestError(error, 'Unable to load posts.'));
});
document.getElementById('adminAuditPrevious').addEventListener('click', () => {
  state.auditPage -= 1;
  loadAdminAudit().catch((error) => showRequestError(error, 'Unable to load audit log.'));
});
document.getElementById('adminAuditNext').addEventListener('click', () => {
  state.auditPage += 1;
  loadAdminAudit().catch((error) => showRequestError(error, 'Unable to load audit log.'));
});
elements.copyTemporaryPasswordBtn.addEventListener('click', copyTemporaryPassword);
document.getElementById('closeTemporaryPasswordBtn').addEventListener('click', closeTemporaryPasswordModal);
document.getElementById('closeTemporaryPasswordAction').addEventListener('click', closeTemporaryPasswordModal);
elements.temporaryPasswordModal.addEventListener('click', (event) => {
  if (event.target.dataset.closePasswordModal === 'true') {
    closeTemporaryPasswordModal();
  }
});
elements.clearRequestLogBtn.addEventListener('click', () => {
  state.requestLog = [];
  renderRequestLog();
});
elements.postForm.addEventListener('submit', handleCreatePost);
elements.searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await loadFeed();
  } catch (error) {
    showRequestError(error, 'Unable to load search results.');
  }
});
elements.clearSearchBtn.addEventListener('click', () => {
  elements.searchInput.value = '';
  loadFeed().catch((error) => showRequestError(error, 'Unable to load the feed.'));
});
elements.feedList.addEventListener('click', handleFeedClick);
elements.modalForm.addEventListener('submit', handleModalSubmit);
elements.deletePostBtn.addEventListener('click', () => {
  const id = elements.modalForm.dataset.postId;
  if (id) {
    handleDeletePost(id);
  }
});
elements.closeModalBtn.addEventListener('click', closeModal);
elements.postModal.addEventListener('click', (event) => {
  if (event.target.dataset.closeModal === 'true') {
    closeModal();
  }
});
window.addEventListener('pagehide', () => {
  elements.temporaryPasswordInput.value = '';
});

bootstrap();
