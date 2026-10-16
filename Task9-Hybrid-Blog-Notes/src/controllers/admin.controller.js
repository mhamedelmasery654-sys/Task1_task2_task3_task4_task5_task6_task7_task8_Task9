const adminService = require('../services/admin.service');
const postService = require('../services/post.service');

async function getOverview(req, res) {
    return res.json(await adminService.getOverview());
}

async function getUsers(req, res) {
    return res.json(await adminService.getUsers(req.validatedQuery));
}

async function getUser(req, res) {
    const user = await adminService.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    return res.json({ user });
}

async function updateUser(req, res) {
    const result = await adminService.updateUser(req.user, req.requestId, req.params.id, req.body);
    if (result.kind === 'not_found') return res.status(404).json({ error: 'user not found' });
    if (result.kind === 'duplicate') return res.status(409).json({ error: 'username or email is already registered' });
    return res.json({ user: result.user });
}

async function changeUserRole(req, res) {
    const result = await adminService.changeUserRole(req.user, req.requestId, req.params.id, req.body.role);
    if (result.kind === 'not_found') return res.status(404).json({ error: 'user not found' });
    if (result.kind === 'last_admin') return res.status(409).json({ error: 'Cannot remove or disable the last active admin' });
    return res.json({ user: result.user });
}

async function setUserDisabled(req, res) {
    const result = await adminService.setUserDisabled(req.user, req.requestId, req.params.id, req.body.disabled);
    if (result.kind === 'not_found') return res.status(404).json({ error: 'user not found' });
    if (result.kind === 'last_admin') return res.status(409).json({ error: 'Cannot remove or disable the last active admin' });
    return res.json({ user: result.user });
}

async function deleteUser(req, res) {
    const result = await adminService.deleteUser(req.user, req.requestId, req.params.id);
    if (result.kind === 'not_found') return res.status(404).json({ error: 'user not found' });
    if (result.kind === 'last_admin') return res.status(409).json({ error: 'Cannot remove or disable the last active admin' });
    return res.json({ message: 'user deleted; associated posts were permanently deleted', userId: req.params.id });
}

async function resetUserPassword(req, res) {
    const temporaryPassword = await adminService.resetUserPassword(req.user, req.requestId, req.params.id);
    if (!temporaryPassword) {
        return res.status(404).json({ error: 'user not found' });
    }
    return res.json({
        message: 'Temporary password reset successfully. Previous sessions were revoked; the account owner must change it after signing in.',
        oldPassword: 'Not recoverable; only a password hash is stored.',
        temporaryPassword,
    });
}

async function getPosts(req, res) {
    const result = await adminService.getPosts(req.validatedQuery);
    return res.json({
        ...result,
        posts: result.posts.map(postService.publicPost),
    });
}

async function getPost(req, res) {
    const post = await adminService.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: 'post not found' });
    return res.json({ post: postService.publicPost(post) });
}

async function updatePost(req, res) {
    const post = await adminService.updatePost(req.user, req.requestId, req.params.id, req.body);
    if (!post) return res.status(404).json({ error: 'post not found' });
    return res.json({ post: postService.publicPost(post) });
}

async function deletePost(req, res) {
    const post = await adminService.deletePost(req.user, req.requestId, req.params.id);
    if (!post) return res.status(404).json({ error: 'post not found' });
    return res.json({ message: 'post deleted', post: postService.publicPost(post) });
}

async function getAudit(req, res) {
    return res.json(await adminService.getAudit(req.validatedQuery));
}

module.exports = {
    getOverview,
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
