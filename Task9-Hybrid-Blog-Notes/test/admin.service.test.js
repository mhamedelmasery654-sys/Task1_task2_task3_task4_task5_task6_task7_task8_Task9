const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const userRepository = require('../src/repositories/user.repository');
const auditRepository = require('../src/repositories/adminAudit.repository');
const adminService = require('../src/services/admin.service');

test('admin password reset saves only a bcrypt hash and returns the generated password once', async () => {
    const originalFindById = userRepository.findById;
    const originalSave = userRepository.save;
    const originalRecord = auditRepository.record;
    const user = { id: 12, password: 'previous-hash', token_version: 0 };
    let savedUser;

    userRepository.findById = async (id) => {
        assert.equal(id, 12);
        return user;
    };
    userRepository.save = async (value) => {
        savedUser = value;
        return value;
    };
    auditRepository.record = async () => {};

    try {
        const temporaryPassword = await adminService.resetUserPassword({ id: 1, username: 'admin' }, 'request-1', 12);

        assert.match(temporaryPassword, /^T8-[A-Za-z0-9_-]{32}$/);
        assert.equal(savedUser, user);
        assert.equal(savedUser.must_change_password, true);
        assert.equal(savedUser.token_version, 1);
        assert.notEqual(savedUser.password, temporaryPassword);
        assert.equal(await bcrypt.compare(temporaryPassword, savedUser.password), true);
        assert.equal(await bcrypt.compare('previous-hash', savedUser.password), false);
    } finally {
        userRepository.findById = originalFindById;
        userRepository.save = originalSave;
        auditRepository.record = originalRecord;
    }
});

test('admin password reset returns null for a missing user without saving', async () => {
    const originalFindById = userRepository.findById;
    const originalSave = userRepository.save;
    const originalRecord = auditRepository.record;
    userRepository.findById = async () => null;
    userRepository.save = async () => {
        assert.fail('A missing user must not be saved');
    };

    try {
        assert.equal(await adminService.resetUserPassword({ id: 1, username: 'admin' }, 'request-1', 999), null);
    } finally {
        userRepository.findById = originalFindById;
        userRepository.save = originalSave;
        auditRepository.record = originalRecord;
    }
});
