const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const authMiddleware = require('../middleware/auth');
const { errorHandler, createHttpError, notFoundHandler } = require('../middleware/errorHandler');
const requireRole = require('../middleware/requireRole');
const postOwnerCondition = require('../middleware/postOwnerCondition');
const validate = require('../middleware/validate');

function responseRecorder() {
    return {
        statusCode: 200,
        body: undefined,
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

test('validation rejects invalid request bodies through the error pipeline', () => {
    const req = { body: { title: '' } };
    let forwardedError;
    validate(z.object({ title: z.string().min(1) }))(req, {}, (error) => {
        forwardedError = error;
    });
    assert.equal(forwardedError.statusCode, 400);
    assert.equal(forwardedError.message, 'Validation failed');
    assert.equal(forwardedError.details[0].field, 'title');
});

test('validation replaces valid body input with parsed data', () => {
    const req = { body: { value: '  post  ', ignored: true } };
    let calledNext = false;
    validate(z.object({ value: z.string().trim() }))(req, {}, () => {
        calledNext = true;
    });
    assert.equal(calledNext, true);
    assert.deepEqual(req.body, { value: 'post' });
});

test('authentication rejects missing token and accepts a valid signed-in user token', () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'middleware-test-secret-that-is-longer-than-32-characters';
    try {
        let forwardedError;
        authMiddleware({ get: () => undefined }, {}, (error) => {
            forwardedError = error;
        });
        assert.equal(forwardedError.statusCode, 401);

        const token = jwt.sign({ id: 7, username: 'ahmed', email: 'ahmed@example.com', role: 'user' }, process.env.JWT_SECRET);
        const req = { get: () => `Bearer ${token}` };
        let calledNext = false;
        authMiddleware(req, {}, (error) => {
            assert.equal(error, undefined);
            calledNext = true;
        });
        assert.equal(calledNext, true);
        assert.equal(req.user.id, 7);
        assert.equal(req.user.role, 'user');
    } finally {
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    }
});

test('authentication rejects invalid role and missing token claims', () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'middleware-test-secret-that-is-longer-than-32-characters';
    try {
        for (const payload of [
            { id: 7, username: 'ahmed', email: 'ahmed@example.com', role: 'superadmin' },
            { id: 7, username: 'ahmed', email: 'ahmed@example.com' },
            { id: -1, username: 'ahmed', email: 'ahmed@example.com', role: 'user' },
        ]) {
            const req = { get: () => `Bearer ${jwt.sign(payload, process.env.JWT_SECRET)}` };
            let forwardedError;
            authMiddleware(req, {}, (error) => {
                forwardedError = error;
            });
            assert.equal(forwardedError.statusCode, 401);
            assert.equal(req.user, undefined);
        }
    } finally {
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    }
});

test('role middleware allows allowed roles and rejects a regular user from an admin route', () => {
    let calledNext = false;
    requireRole('user', 'admin')({ user: { role: 'user' } }, {}, () => {
        calledNext = true;
    });
    assert.equal(calledNext, true);

    let forwardedError;
    requireRole('admin')({ user: { role: 'user' } }, {}, (error) => {
        forwardedError = error;
    });
    assert.equal(forwardedError.statusCode, 403);
});

test('role middleware rejects invalid role configuration', () => {
    assert.throws(() => requireRole('superadmin'), {
        name: 'TypeError',
        message: 'requireRole must be configured with one or more valid roles: user, admin',
    });
    assert.throws(() => requireRole(), TypeError);
});

test('error middleware returns validation detail but hides unexpected internal errors', () => {
    const validationResponse = responseRecorder();
    errorHandler(createHttpError(400, 'Validation failed', [{ field: 'title', message: 'Title is required' }]), {}, validationResponse, () => {});
    assert.equal(validationResponse.statusCode, 400);
    assert.equal(validationResponse.body.details[0].field, 'title');

    const internalResponse = responseRecorder();
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
        errorHandler(new Error('private database details'), {}, internalResponse, () => {});
    } finally {
        console.error = originalConsoleError;
    }
    assert.equal(internalResponse.statusCode, 500);
    assert.deepEqual(internalResponse.body, { error: 'Internal server error' });
});

test('duplicate database records map to conflict and unknown routes map to not found', () => {
    const duplicateResponse = responseRecorder();
    errorHandler({ driverError: { code: '23505' } }, {}, duplicateResponse, () => {});
    assert.equal(duplicateResponse.statusCode, 409);

    let forwardedError;
    notFoundHandler({}, {}, (error) => {
        forwardedError = error;
    });
    assert.equal(forwardedError.statusCode, 404);
});

test('regular users can target only their own post while admins can target any post', () => {
    assert.deepEqual(postOwnerCondition({ id: 12, role: 'user' }, 41), {
        id: 41,
        author: { id: 12 },
    });
    assert.deepEqual(postOwnerCondition({ id: 99, role: 'admin' }, 41), { id: 41 });
});
