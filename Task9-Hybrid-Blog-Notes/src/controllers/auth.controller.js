const authService = require('../services/auth.service');

async function register(req, res) {
    const result = await authService.register(req.body);
    if (!result) {
        return res.status(409).json({ error: 'username or email is already registered' });
    }
    return res.status(201).json(result);
}

async function login(req, res) {
    const result = await authService.login(req.body);
    if (!result) {
        return res.status(401).json({ error: 'invalid email or password' });
    }
    return res.json(result);
}

async function getCurrentUser(req, res) {
    const user = await authService.getCurrentUser(req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'user not found' });
    }
    return res.json({ user });
}

async function changePassword(req, res) {
    const result = await authService.changePassword(
        req.user.id,
        req.body.currentPassword,
        req.body.newPassword
    );
    if (!result) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    return res.json(result);
}

module.exports = { register, login, getCurrentUser, changePassword };
