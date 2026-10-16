const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const adminRoutes = require('./routes/admin.routes');
const authRoutes = require('./routes/auth.routes');
const healthRoutes = require('./routes/health.routes');
const postRoutes = require('./routes/post.routes');
const notesRoutes = require('./notes/routes/notes.routes');

const app = express();

app.use((req, res, next) => {
    const suppliedRequestId = req.get('x-request-id');
    req.requestId = suppliedRequestId && /^[A-Za-z0-9_-]{1,80}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : `req-${crypto.randomUUID()}`;
    req.errorCode = null;
    res.setHeader('X-Request-Id', req.requestId);
    const startedAt = Date.now();
    const originalJson = res.json.bind(res);

    res.json = (payload) => {
        if (res.statusCode >= 400 && payload && typeof payload === 'object' && !Array.isArray(payload) && payload.error) {
            payload = { ...payload, requestId: req.requestId };
            if (!req.errorCode) {
                req.errorCode = {
                    400: 'VALIDATION_ERROR',
                    401: 'AUTHENTICATION_FAILED',
                    403: 'ACCESS_DENIED',
                    404: 'NOT_FOUND',
                    409: 'DUPLICATE_RECORD',
                }[res.statusCode] || 'REQUEST_REJECTED';
            }
        }
        return originalJson(payload);
    };

    res.on('finish', () => {
        if (process.env.NODE_ENV === 'test') return;
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
            errorCode: req.errorCode || (res.statusCode >= 400 ? 'HTTP_ERROR' : undefined),
        }));
    });
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/notes', notesRoutes);
app.use('/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
