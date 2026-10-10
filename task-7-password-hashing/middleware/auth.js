const jwt = require('jsonwebtoken');
require('dotenv').config();

function authMiddleware(req, res, next) {
    const authorization = req.get('authorization') || '';
    const [scheme, token, extra] = authorization.trim().split(/\s+/);

    if (scheme !== 'Bearer' || !token || extra) {
        return res.status(401).json({ error: 'Bearer token is required' });
    }

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        if (!user || typeof user !== 'object' || !Number.isInteger(user.id)) {
            return res.status(401).json({ error: 'Invalid or expired access token' });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired access token' });
    }
}

module.exports = authMiddleware;
