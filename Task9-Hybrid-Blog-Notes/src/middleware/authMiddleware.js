const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { createHttpError } = require('./errorHandler');
const userRepository = require('../repositories/user.repository');
require('dotenv').config();

const tokenPayloadSchema = z.object({
    id: z.number().int().positive(),
    username: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['user', 'admin']),
    tokenVersion: z.number().int().nonnegative().optional(),
});

async function authMiddleware(req, res, next) {
    const authorization = req.get('authorization') || '';
    const [scheme, token, extra] = authorization.trim().split(/\s+/);
    if (scheme !== 'Bearer' || !token || extra) {
        return next(createHttpError(401, '****** token is required'));
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

    const user = await userRepository.findAuthUserById(result.data.id);
    if (!user || user.disabled || (result.data.tokenVersion || 0) !== (user.token_version || 0)) {
        return next(createHttpError(401, 'Invalid or expired access token'));
    }
    req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        tokenVersion: user.token_version || 0,
        mustChangePassword: Boolean(user.must_change_password),
    };
    return next();
}

module.exports = authMiddleware;
