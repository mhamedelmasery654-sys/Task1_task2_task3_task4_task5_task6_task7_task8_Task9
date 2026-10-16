const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/user.repository');

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        mustChangePassword: Boolean(user.must_change_password),
    };
}

function createAccessToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            tokenVersion: user.token_version || 0,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
}

async function register({ username, email, password }) {
    const normalizedUsername = String(username).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await userRepository.findByUsernameOrEmail(normalizedUsername, normalizedEmail);
    if (existingUser) {
        return null;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = userRepository.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password: passwordHash,
    });
    const savedUser = await userRepository.save(user);
    return {
        accessToken: createAccessToken(savedUser),
        user: publicUser(savedUser),
    };
}

async function login({ email, password }) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user || user.disabled || !(await bcrypt.compare(password, user.password))) {
        return null;
    }

    return {
        accessToken: createAccessToken(user),
        user: publicUser(user),
    };
}

async function getCurrentUser(id) {
    const user = await userRepository.findById(id);
    return user ? publicUser(user) : null;
}

async function changePassword(id, currentPassword, newPassword) {
    const user = await userRepository.findById(id);
    if (!user || user.disabled || !(await bcrypt.compare(currentPassword, user.password))) {
        return null;
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.must_change_password = false;
    user.token_version += 1;
    const savedUser = await userRepository.save(user);
    return {
        accessToken: createAccessToken(savedUser),
        user: publicUser(savedUser),
    };
}

module.exports = { register, login, getCurrentUser, changePassword, publicUser, createAccessToken };
