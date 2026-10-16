const { AppDataSource } = require('../db');

function getRepository() {
    return AppDataSource.getRepository('User');
}

function findByUsernameOrEmail(username, email) {
    return getRepository()
        .createQueryBuilder('user')
        .where('LOWER(user.username) = LOWER(:username)', { username })
        .orWhere('LOWER(user.email) = LOWER(:email)', { email })
        .getOne();
}

function findByUsername(username) {
    return getRepository()
        .createQueryBuilder('user')
        .where('LOWER(user.username) = LOWER(:username)', { username })
        .getOne();
}

function findByEmail(email) {
    return getRepository()
        .createQueryBuilder('user')
        .where('LOWER(user.email) = LOWER(:email)', { email })
        .getOne();
}

function findById(id) {
    return getRepository().findOneBy({ id });
}

function findAuthUserById(id) {
    return findById(id);
}

function create(userData) {
    return getRepository().create(userData);
}

function save(user) {
    return getRepository().save(user);
}

function findPublicUsers() {
    return getRepository().find({
        select: { id: true, username: true, email: true, role: true },
        order: { id: 'ASC' },
    });
}

function findAdminById(id) {
    return getRepository().findOneBy({ id });
}

async function listAdminUsers({ search, page, limit, sortBy, sortOrder }) {
    const query = getRepository().createQueryBuilder('user');
    if (search) {
        query.where('(LOWER(user.username) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))', {
            search: `%${search}%`,
        });
    }
    query.orderBy(`user.${sortBy}`, sortOrder)
        .skip((page - 1) * limit)
        .take(limit);
    const [users, total] = await query.getManyAndCount();
    return { users, total };
}

function countUsers() {
    return getRepository().count();
}

function countActiveUsers() {
    return getRepository().countBy({ disabled: false });
}

function countAdmins() {
    return getRepository().countBy({ role: 'admin', disabled: false });
}

function topAuthors(limit = 5) {
    return getRepository()
        .createQueryBuilder('user')
        .leftJoin('user.posts', 'post')
        .select(['user.id AS id', 'user.username AS username'])
        .addSelect('COUNT(post.id)', 'postCount')
        .groupBy('user.id')
        .addGroupBy('user.username')
        .orderBy('"postCount"', 'DESC')
        .addOrderBy('user.id', 'ASC')
        .limit(limit)
        .getRawMany();
}

async function updateAdminState(id, changes) {
    return AppDataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock($1)', [81720461]);
        const repository = manager.getRepository('User');
        const user = await repository.findOne({
            where: { id },
            lock: { mode: 'pessimistic_write' },
        });
        if (!user) {
            return { kind: 'not_found' };
        }

        const nextRole = changes.role === undefined ? user.role : changes.role;
        const nextDisabled = changes.disabled === undefined ? user.disabled : changes.disabled;
        const removesActiveAdmin = user.role === 'admin'
            && !user.disabled
            && (nextRole !== 'admin' || nextDisabled);
        if (removesActiveAdmin) {
            const activeAdminCount = await repository.countBy({ role: 'admin', disabled: false });
            if (activeAdminCount <= 1) {
                return { kind: 'last_admin' };
            }
        }

        if (changes.role !== undefined) user.role = changes.role;
        if (changes.disabled !== undefined) user.disabled = changes.disabled;
        user.token_version += 1;
        return { kind: 'updated', user: await repository.save(user) };
    });
}

async function deleteAdminUser(id, auditEntry) {
    return AppDataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock($1)', [81720461]);
        const repository = manager.getRepository('User');
        const user = await repository.findOne({
            where: { id },
            lock: { mode: 'pessimistic_write' },
        });
        if (!user) {
            return { kind: 'not_found' };
        }

        if (user.role === 'admin' && !user.disabled) {
            const activeAdminCount = await repository.countBy({ role: 'admin', disabled: false });
            if (activeAdminCount <= 1) {
                return { kind: 'last_admin' };
            }
        }

        await manager.getRepository('AdminAudit').save(
            manager.getRepository('AdminAudit').create(auditEntry)
        );
        await repository.remove(user);
        return { kind: 'deleted', user };
    });
}

module.exports = {
    findByUsernameOrEmail,
    findByUsername,
    findByEmail,
    findById,
    findAuthUserById,
    create,
    save,
    findPublicUsers,
    findAdminById,
    listAdminUsers,
    countUsers,
    countActiveUsers,
    countAdmins,
    topAuthors,
    updateAdminState,
    deleteAdminUser,
};
