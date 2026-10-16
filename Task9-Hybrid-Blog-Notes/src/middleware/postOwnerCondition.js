function postOwnerCondition(user, postId) {
    if (user.role === 'admin') {
        return { id: postId };
    }
    return { id: postId, author: { id: user.id } };
}

module.exports = postOwnerCondition;
