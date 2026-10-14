const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { createHttpError } = require('./errorHandler');
require('dotenv').config();

const tokenPayloadSchema = z.object({
    id: z.number().int().positive(),
    username: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['user', 'admin']),
});

function authMiddleware(req, res, next) {
    const authorization = req.get('authorization') || '';
    const [scheme, token, extra] = authorization.trim().split(/\s+/);
    if (scheme !== 'Bearer' || !token || extra) {
        return next(createHttpError(401, 'Bearer access token is required'));
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return next(createHttpError(401, 'Invalid or expired access token'));
    }

    const result = tokenPayloadSchema.safeParse(payload);
    if (!result.success) {
        return next(createHttpError(401, 'Invalid or expired access token'));
    }
    req.user = result.data;
    return next();
}

module.exports = authMiddleware;
