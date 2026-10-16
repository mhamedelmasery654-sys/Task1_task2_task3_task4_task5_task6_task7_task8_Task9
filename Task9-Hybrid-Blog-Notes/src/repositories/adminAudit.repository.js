const { AppDataSource } = require('../db');

function getRepository() {
    return AppDataSource.getRepository('AdminAudit');
}

function record(entry) {
    return getRepository().save(getRepository().create(entry));
}

async function list({ page, limit, action, targetType }) {
    const query = getRepository().createQueryBuilder('audit');
    if (action) query.andWhere('audit.action = :action', { action });
    if (targetType) query.andWhere('audit.target_type = :targetType', { targetType });
    query.orderBy('audit.created_at', 'DESC')
        .addOrderBy('audit.id', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);
    const [entries, total] = await query.getManyAndCount();
    return { entries, total };
}

module.exports = { record, list };
