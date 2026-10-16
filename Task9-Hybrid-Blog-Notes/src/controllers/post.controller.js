const postService = require('../services/post.service');

async function create(req, res) {
    const post = await postService.create(req.user.id, req.body);
    if (!post) {
        return res.status(404).json({ error: 'user not found' });
    }
    return res.status(201).json({ post });
}

async function getFeed(req, res) {
    const posts = await postService.getFeed();
    return res.json(posts);
}

async function search(req, res) {
    const posts = await postService.search((req.validatedQuery || req.query).q);
    return res.json(posts);
}

async function getById(req, res) {
    const post = await postService.getById(req.params.id);
    if (!post) {
        return res.status(404).json({ error: 'post not found' });
    }
    return res.json({ post });
}

async function update(req, res) {
    const post = await postService.update(req.user, req.params.id, req.body);
    if (!post) {
        return res.status(404).json({ error: 'post not found' });
    }
    return res.json({ post });
}

async function remove(req, res) {
    const removed = await postService.remove(req.user, req.params.id);
    if (!removed) {
        return res.status(404).json({ error: 'post not found' });
    }
    return res.json({ message: 'post deleted' });
}

module.exports = { create, getFeed, search, getById, update, remove };
