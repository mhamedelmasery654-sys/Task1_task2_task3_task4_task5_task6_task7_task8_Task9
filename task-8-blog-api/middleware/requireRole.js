const { z } = require('zod');
const { createHttpError } = require('./errorHandler');

const roleSchema = z.enum(['user', 'admin']);

function requireRole(...allowedRoles) {
    const result = z.array(roleSchema).min(1).safeParse(allowedRoles);
    if (!result.success) {
        throw new TypeError('requireRole must be configured with one or more valid roles: user, admin');
    }

    return (req, res, next) => {
        const userRole = roleSchema.safeParse(req.user && req.user.role);
        if (!userRole.success || !allowedRoles.includes(userRole.data)) {
            return next(createHttpError(403, 'You do not have permission to access this route'));
        }
        return next();
    };
}

module.exports = requireRole;
