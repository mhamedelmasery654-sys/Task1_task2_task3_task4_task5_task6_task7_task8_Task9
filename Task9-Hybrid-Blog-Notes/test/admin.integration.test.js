const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');

const databaseName = `blog_admin_test_${crypto.randomBytes(10).toString('hex')}`;
process.env.DB_NAME = databaseName;
process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64url');
process.env.NODE_ENV = 'test';

const { AppDataSource, ensureDatabaseExists } = require('../src/db');
const app = require('../src/app');
const bcrypt = require('bcryptjs');

test('admin API is authenticated, safe, and manages users and posts end to end', { timeout: 120000 }, async (t) => {
  let initialized = false;
  let server;
  let baseUrl;
  let databaseCreated = false;

  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (initialized && AppDataSource.isInitialized) await AppDataSource.destroy();
    if (databaseCreated) {
      if (!/^blog_admin_test_[a-f0-9]{20}$/.test(databaseName)) {
        throw new Error('Refusing PostgreSQL cleanup: database name is not an isolated test database.');
      }
      const adminClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_ADMIN_DATABASE || 'postgres',
      });
      await adminClient.connect();
      try {
        await adminClient.query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [databaseName]
        );
        await adminClient.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      } finally {
        await adminClient.end();
      }
    }
  });

  try {
    await ensureDatabaseExists();
    databaseCreated = true;
    await AppDataSource.initialize();
    initialized = true;
  } catch (error) {
    t.skip(`PostgreSQL test database unavailable (${error.code || 'setup error'}).`);
    return;
  }

  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(path, { method = 'GET', token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const responsePayload = text && response.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(text)
      : text;
    return { status: response.status, body: responsePayload };
  }

  async function register(username, email) {
    const result = await request('/auth/register', {
      method: 'POST',
      body: { username, email, password: 'StrongPass123' },
    });
    assert.equal(result.status, 201);
    return result.body;
  }

  const adminRegistration = await register('admin_test', 'admin_test@example.invalid');
  const regularRegistration = await register('regular_test', 'regular_test@example.invalid');
  const secondRegistration = await register('second_test', 'second_test@example.invalid');
  await AppDataSource.getRepository('User').update({ id: adminRegistration.user.id }, { role: 'admin' });
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin_test@example.invalid', password: 'StrongPass123' },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.accessToken;
  let userToken = regularRegistration.accessToken;
  let secondToken = secondRegistration.accessToken;

  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.ok((await request('/')).status === 200);

  const protectedAdminPaths = [
    ['/admin/overview', 'GET'],
    ['/admin/users', 'GET'],
    [`/admin/users/${regularRegistration.user.id}`, 'GET'],
    [`/admin/users/${regularRegistration.user.id}`, 'PATCH'],
    [`/admin/users/${regularRegistration.user.id}/role`, 'PATCH'],
    [`/admin/users/${regularRegistration.user.id}/status`, 'PATCH'],
    [`/admin/users/${secondRegistration.user.id}`, 'DELETE'],
    [`/admin/users/${regularRegistration.user.id}/password-reset`, 'POST'],
    ['/admin/posts', 'GET'],
    ['/admin/posts/1', 'GET'],
    ['/admin/posts/1', 'PUT'],
    ['/admin/posts/1', 'DELETE'],
    ['/admin/audit', 'GET'],
  ];
  for (const [path, method] of protectedAdminPaths) {
    assert.equal((await request(path, { method })).status, 401, `${method} ${path} requires authentication`);
    assert.equal((await request(path, { method, token: userToken })).status, 403, `${method} ${path} requires admin`);
  }
  assert.equal((await request('/admin/overview', { token: 'invalid-token' })).status, 401);

  const overview = await request('/admin/overview', { token: adminToken });
  assert.equal(overview.status, 200);
  assert.equal(overview.body.userCount, 3);
  assert.equal(overview.body.adminCount, 1);

  const users = await request('/admin/users?page=1&limit=20&search=regular', { token: adminToken });
  assert.equal(users.status, 200);
  assert.equal(users.body.users.length, 1);
  assert.equal(users.body.users[0].email, 'regular_test@example.invalid');
  assert.equal(JSON.stringify(users.body).includes('passwordHash'), false);
  assert.equal(JSON.stringify(users.body).includes('"password"'), false);
  assert.equal((await request('/auth/me', { token: adminToken })).body.user.password, undefined);

  const userId = regularRegistration.user.id;
  assert.equal((await request(`/admin/users/${userId}`, { token: adminToken })).status, 200);
  assert.equal((await request('/admin/users/not-an-id', { token: adminToken })).status, 400);
  assert.equal((await request(`/admin/users/${userId}`, {
    method: 'PATCH', token: adminToken, body: { id: 99, role: 'admin' },
  })).status, 400);
  assert.equal((await request(`/admin/users/${userId}`, {
    method: 'PATCH', token: adminToken, body: { email: 'invalid' },
  })).status, 400);
  assert.equal((await request(`/admin/users/${userId}`, {
    method: 'PATCH', token: adminToken, body: { email: 'second_test@example.invalid' },
  })).status, 409);
  const profileUpdate = await request(`/admin/users/${userId}`, {
    method: 'PATCH', token: adminToken, body: { username: 'regular_renamed', email: 'regular_renamed@example.invalid' },
  });
  assert.equal(profileUpdate.status, 200);
  const updatedUserLogin = await request('/auth/login', {
    method: 'POST', body: { email: 'regular_renamed@example.invalid', password: 'StrongPass123' },
  });
  assert.equal(updatedUserLogin.status, 200);
  assert.equal((await request('/posts', { token: userToken })).status, 401);
  userToken = updatedUserLogin.body.accessToken;

  const registerWithRole = await request('/auth/register', {
    method: 'POST',
    body: { username: 'role_attack', email: 'role_attack@example.invalid', password: 'StrongPass123', role: 'admin' },
  });
  assert.equal(registerWithRole.status, 201);
  assert.equal(registerWithRole.body.user.role, 'user');
  const disposablePost = await request('/posts', {
    method: 'POST',
    token: registerWithRole.body.accessToken,
    body: { title: 'Post removed with user', content: 'This post should be cascade deleted.' },
  });
  assert.equal(disposablePost.status, 201);

  const userPostResponse = await request('/posts', {
    method: 'POST', token: userToken, body: { title: 'Admin managed test post', content: 'Initial content' },
  });
  assert.equal(userPostResponse.status, 201);
  const postId = userPostResponse.body.post.id;
  const secondFeed = await request('/posts', { token: secondToken });
  assert.equal(secondFeed.status, 200);
  assert.ok(secondFeed.body.some((post) => post.id === postId));
  assert.equal((await request(`/posts/${postId}`, {
    method: 'PUT', token: userToken, body: { title: 'Updated by owner: Admin managed test post', content: 'Owner update' },
  })).status, 200);
  assert.equal((await request(`/posts/${postId}`, {
    method: 'PUT', token: secondToken, body: { title: 'Nope', content: 'Nope' },
  })).status, 404);
  assert.equal((await request(`/posts/${postId}`, { method: 'DELETE', token: secondToken })).status, 404);

  const adminPosts = await request('/admin/posts?search=managed&authorId=' + userId, { token: adminToken });
  assert.equal(adminPosts.status, 200);
  assert.equal(adminPosts.body.posts.length, 1);
  assert.equal((await request(`/admin/posts/${postId}`, { token: adminToken })).status, 200);
  assert.equal((await request(`/admin/posts/${postId}`, {
    method: 'PUT', token: adminToken, body: { title: '', content: 'Invalid title' },
  })).status, 400);
  assert.equal((await request('/admin/posts/999999', { token: adminToken })).status, 404);
  assert.equal((await request('/posts/search?q=Updated', { token: userToken })).status, 200);
  assert.equal((await request('/admin/posts?from=not-a-date', { token: adminToken })).status, 400);
  const adminPostUpdate = await request(`/admin/posts/${postId}`, {
    method: 'PUT', token: adminToken, body: { title: 'Updated by admin', content: 'Updated content' },
  });
  assert.equal(adminPostUpdate.status, 200);
  assert.equal(adminPostUpdate.body.post.author.id, userId);
  assert.equal((await request(`/posts/${postId}`, { token: userToken })).body.post.title, 'Updated by admin');

  const roleChange = await request(`/admin/users/${secondRegistration.user.id}/role`, {
    method: 'PATCH', token: adminToken, body: { role: 'admin' },
  });
  assert.equal(roleChange.status, 200);
  assert.equal((await request('/posts', { token: secondToken })).status, 401);
  const secondLogin = await request('/auth/login', {
    method: 'POST', body: { email: 'second_test@example.invalid', password: 'StrongPass123' },
  });
  assert.equal(secondLogin.status, 200);
  secondToken = secondLogin.body.accessToken;
  assert.equal((await request(`/admin/users/${secondRegistration.user.id}/role`, {
    method: 'PATCH', token: adminToken, body: { role: 'user' },
  })).status, 200);

  const disabled = await request(`/admin/users/${secondRegistration.user.id}/status`, {
    method: 'PATCH', token: adminToken, body: { disabled: true },
  });
  assert.equal(disabled.status, 200);
  assert.equal((await request('/posts', { token: secondToken })).status, 401);
  assert.equal((await request('/auth/login', {
    method: 'POST', body: { email: 'second_test@example.invalid', password: 'StrongPass123' },
  })).status, 401);
  assert.equal((await request(`/admin/users/${secondRegistration.user.id}/status`, {
    method: 'PATCH', token: adminToken, body: { disabled: false },
  })).status, 200);

  const reset = await request(`/admin/users/${userId}/password-reset`, { method: 'POST', token: adminToken });
  assert.equal(reset.status, 200);
  assert.match(reset.body.temporaryPassword, /^T8-/);
  assert.equal(reset.body.oldPassword, 'Not recoverable; only a password hash is stored.');
  const storedUser = await AppDataSource.getRepository('User').findOneBy({ id: userId });
  assert.notEqual(storedUser.password, reset.body.temporaryPassword);
  assert.equal(await bcrypt.compare(reset.body.temporaryPassword, storedUser.password), true);
  assert.equal(storedUser.must_change_password, true);
  assert.equal((await request('/posts', { token: userToken })).status, 401);
  const tempLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'regular_renamed@example.invalid', password: reset.body.temporaryPassword },
  });
  assert.equal(tempLogin.status, 200);
  assert.equal(tempLogin.body.user.mustChangePassword, true);
  assert.equal((await request('/posts', { token: tempLogin.body.accessToken })).status, 403);
  const wrongPasswordChange = await request('/auth/change-password', {
    method: 'POST', token: tempLogin.body.accessToken,
    body: { currentPassword: 'WrongPass123', newPassword: 'ChangedPass123' },
  });
  assert.equal(wrongPasswordChange.status, 401);
  const changedPassword = await request('/auth/change-password', {
    method: 'POST', token: tempLogin.body.accessToken,
    body: { currentPassword: reset.body.temporaryPassword, newPassword: 'ChangedPass123' },
  });
  assert.equal(changedPassword.status, 200);
  assert.equal(changedPassword.body.user.mustChangePassword, false);
  assert.equal((await request('/posts', { token: tempLogin.body.accessToken })).status, 401);
  assert.equal((await request('/posts', { token: changedPassword.body.accessToken })).status, 200);
  assert.equal((await request('/auth/login', {
    method: 'POST', body: { email: 'regular_renamed@example.invalid', password: 'ChangedPass123' },
  })).status, 200);

  assert.equal((await request(`/admin/users/${adminRegistration.user.id}/status`, {
    method: 'PATCH', token: adminToken, body: { disabled: true },
  })).status, 409);
  assert.equal((await request(`/admin/users/${adminRegistration.user.id}/role`, {
    method: 'PATCH', token: adminToken, body: { role: 'user' },
  })).status, 409);
  assert.equal((await request(`/admin/users/${adminRegistration.user.id}`, {
    method: 'DELETE', token: adminToken,
  })).status, 409);

  const audit = await request('/admin/audit?page=1&limit=100', { token: adminToken });
  assert.equal(audit.status, 200);
  assert.ok(audit.body.entries.some((entry) => entry.action === 'user.password.reset'));
  assert.equal(JSON.stringify(audit.body).includes(reset.body.temporaryPassword), false);
  assert.equal(JSON.stringify(audit.body).includes(storedUser.password), false);

  const deletedUser = await request(`/admin/users/${registerWithRole.body.user.id}`, {
    method: 'DELETE', token: adminToken,
  });
  assert.equal(deletedUser.status, 200);
  assert.equal((await request(`/admin/users/${registerWithRole.body.user.id}`, { token: adminToken })).status, 404);
  assert.equal((await request(`/admin/posts/${disposablePost.body.post.id}`, { token: adminToken })).status, 404);

  const deleted = await request(`/admin/posts/${postId}`, { method: 'DELETE', token: adminToken });
  assert.equal(deleted.status, 200);
  assert.equal((await request(`/admin/posts/${postId}`, { token: adminToken })).status, 404);
});
