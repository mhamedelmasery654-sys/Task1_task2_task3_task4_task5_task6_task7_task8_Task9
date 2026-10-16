const postRepository = require('../repositories/post.repository');
const userRepository = require('../repositories/user.repository');
const postOwnerCondition = require('../middleware/postOwnerCondition');

function publicPost(post) {
    return {
        id: post.id,
        title: post.title,
        content: post.content,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        author: post.author ? {
            id: post.author.id,
            username: post.author.username,
        } : null,
    };
}

async function create(userId, postData) {
    const user = await userRepository.findById(userId);
    if (!user) {
        return null;
    }
    const post = postRepository.create({ ...postData, author: user });
    const savedPost = await postRepository.save(post);
    savedPost.author = user;
    return publicPost(savedPost);
}

async function getFeed() {
    const posts = await postRepository.findFeed();
    return posts.map(publicPost);
}

async function search(query) {
    const posts = await postRepository.search(String(query).trim());
    return posts.map(publicPost);
}

async function getById(id) {
    const post = await postRepository.findById(id);
    return post ? publicPost(post) : null;
}

async function update(user, id, postData) {
    const post = await postRepository.findByCondition(postOwnerCondition(user, id));
    if (!post) {
        return null;
    }

    post.title = postData.title;
    post.content = postData.content;
    const updatedPost = await postRepository.save(post);
    return publicPost(updatedPost);
}

async function remove(user, id) {
    const post = await postRepository.findByCondition(postOwnerCondition(user, id));
    if (!post) {
        return false;
    }
    await postRepository.remove(post);
    return true;
}

module.exports = { create, getFeed, search, getById, update, remove, publicPost };
