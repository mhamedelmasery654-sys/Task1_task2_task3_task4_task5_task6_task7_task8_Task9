const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const postRepository = require('../repositories/post.repository');
const auditRepository = require('../repositories/adminAudit.repository');
const { publicUser } = require('./auth.service');

function adminUser(user) {
    return {
        ...publicUser(user),
        disabled: Boolean(user.disabled),
        mustChangePassword: Boolean(user.must_change_password),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
    };
}

async function record(actor, requestId, action, targetType, targetId) {
    await auditRepository.record({
        actor_id: actor.id,
        actor_username: actor.username,
        action,
        target_type: targetType,
        target_id: targetId,
        request_id: requestId || null,
    });
}

async function getUsers(filters) {
    const result = await userRepository.listAdminUsers(filters);
    return { users: result.users.map(adminUser), total: result.total, page: filters.page, limit: filters.limit };
}

async function getUser(userId) {
    const user = await userRepository.findAdminById(userId);
    return user ? adminUser(user) : null;
}

async function updateUser(actor, requestId, userId, changes) {
    const user = await userRepository.findAdminById(userId);
    if (!user) return { kind: 'not_found' };

    if (changes.username !== undefined) {
        const nextUsername = changes.username.trim();
        const usernameConflict = await userRepository.findByUsername(nextUsername);
        if (usernameConflict && usernameConflict.id !== user.id) {
            return { kind: 'duplicate' };
        }
        user.username = nextUsername;
    }
    if (changes.email !== undefined) {
        const nextEmail = changes.email.trim().toLowerCase();
        const emailConflict = await userRepository.findByEmail(nextEmail);
        if (emailConflict && emailConflict.id !== user.id) {
            return { kind: 'duplicate' };
        }
        user.email = nextEmail;
    }
    user.token_version += 1;
    await userRepository.save(user);
    await record(actor, requestId, 'user.profile.updated', 'user', userId);
    return { kind: 'updated', user: adminUser(user) };
}

async function changeUserRole(actor, requestId, userId, role) {
    const result = await userRepository.updateAdminState(userId, { role });
    if (result.kind !== 'updated') return result;
    await record(actor, requestId, 'user.role.updated', 'user', userId);
    return { kind: 'updated', user: adminUser(result.user) };
}

async function setUserDisabled(actor, requestId, userId, disabled) {
    const result = await userRepository.updateAdminState(userId, { disabled });
    if (result.kind !== 'updated') return result;
    await record(actor, requestId, disabled ? 'user.disabled' : 'user.enabled', 'user', userId);
    return { kind: 'updated', user: adminUser(result.user) };
}

async function deleteUser(actor, requestId, userId) {
    const result = await userRepository.deleteAdminUser(userId, {
        actor_id: actor.id,
        actor_username: actor.username,
        action: 'user.deleted',
        target_type: 'user',
        target_id: userId,
        request_id: requestId || null,
    });
    if (result.kind !== 'deleted') return result;
    return {
        kind: 'deleted',
        user: adminUser(result.user),
    };
}

async function resetUserPassword(actor, requestId, userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
        return null;
    }

    const temporaryPassword = `T8-${crypto.randomBytes(24).toString('base64url')}`;
    user.password = await bcrypt.hash(temporaryPassword, 12);
    user.must_change_password = true;
    user.token_version += 1;
    await userRepository.save(user);
    await record(actor, requestId, 'user.password.reset', 'user', userId);
    return temporaryPassword;
}

async function getOverviewData() {
    const [userCount, activeUserCount, adminCount, postCount, topAuthors, postsByAuthor] = await Promise.all([
        userRepository.countUsers(),
        userRepository.countActiveUsers(),
        userRepository.countAdmins(),
        postRepository.countPosts(),
        userRepository.topAuthors(5),
        postRepository.countPostsByAuthor(),
    ]);
    return {
        userCount,
        activeUserCount,
        disabledUserCount: userCount - activeUserCount,
        adminCount,
        postCount,
        topAuthors: topAuthors.map((author) => ({
            id: Number(author.id),
            username: author.username,
            postCount: Number(author.postCount),
        })),
        postsByAuthor: postsByAuthor.map((author) => ({
            authorId: Number(author.authorId),
            username: author.username,
            postCount: Number(author.postCount),
        })),
    };
}

async function getPosts(filters) {
    const result = await postRepository.listAdminPosts(filters);
    return {
        posts: result.posts,
        total: result.total,
        page: filters.page,
        limit: filters.limit,
    };
}

async function getPost(postId) {
    return postRepository.findById(postId);
}

async function updatePost(actor, requestId, postId, changes) {
    const post = await postRepository.findById(postId);
    if (!post) return null;
    post.title = changes.title;
    post.content = changes.content;
    const savedPost = await postRepository.save(post);
    await record(actor, requestId, 'post.updated', 'post', postId);
    return savedPost;
}

async function deletePost(actor, requestId, postId) {
    const post = await postRepository.findById(postId);
    if (!post) return null;
    await postRepository.remove(post);
    await record(actor, requestId, 'post.deleted', 'post', postId);
    return post;
}

async function getAudit(filters) {
    return auditRepository.list(filters);
}

module.exports = {
    getOverview: getOverviewData,
    getUsers,
    getUser,
    updateUser,
    changeUserRole,
    setUserDisabled,
    deleteUser,
    resetUserPassword,
    getPosts,
    getPost,
    updatePost,
    deletePost,
    getAudit,
};
