const { AppDataSource } = require('../db');

function getRepository() {
    return AppDataSource.getRepository('Post');
}

function create(postData) {
    return getRepository().create(postData);
}

function save(post) {
    return getRepository().save(post);
}

function findFeed() {
    return getRepository().find({
        relations: { author: true },
        order: { created_at: 'DESC', id: 'DESC' },
    });
}

function search(search) {
    return getRepository()
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.author', 'author')
        .where('(LOWER(post.title) LIKE LOWER(:search) OR LOWER(post.content) LIKE LOWER(:search))', {
            search: `%${search}%`,
        })
        .orderBy('post.created_at', 'DESC')
        .addOrderBy('post.id', 'DESC')
        .getMany();
}

function findById(id) {
    return getRepository().findOne({
        where: { id },
        relations: { author: true },
    });
}

function findByCondition(condition) {
    return getRepository().findOne({
        where: condition,
        relations: { author: true },
    });
}

function remove(post) {
    return getRepository().remove(post);
}

async function listAdminPosts({ search, authorId, from, to, page, limit }) {
    const query = getRepository()
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.author', 'author');
    if (search) {
        query.where('(LOWER(post.title) LIKE LOWER(:search) OR LOWER(post.content) LIKE LOWER(:search))', {
            search: `%${search}%`,
        });
    }
    if (authorId !== undefined) query.andWhere('author.id = :authorId', { authorId });
    if (from) query.andWhere('post.created_at >= :from', { from });
    if (to) query.andWhere('post.created_at <= :to', { to });
    query.orderBy('post.created_at', 'DESC')
        .addOrderBy('post.id', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);
    const [posts, total] = await query.getManyAndCount();
    return { posts, total };
}

function countPosts() {
    return getRepository().count();
}

function countPostsByAuthor() {
    return getRepository()
        .createQueryBuilder('post')
        .leftJoin('post.author', 'author')
        .select('author.id', 'authorId')
        .addSelect('author.username', 'username')
        .addSelect('COUNT(post.id)', 'postCount')
        .groupBy('author.id')
        .addGroupBy('author.username')
        .orderBy('"postCount"', 'DESC')
        .addOrderBy('author.id', 'ASC')
        .getRawMany();
}

module.exports = {
    create,
    save,
    findFeed,
    search,
    findById,
    findByCondition,
    remove,
    listAdminPosts,
    countPosts,
    countPostsByAuthor,
};
