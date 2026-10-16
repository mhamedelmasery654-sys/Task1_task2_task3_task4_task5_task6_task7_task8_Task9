const healthService = require('../services/health.service');

async function check(req, res) {
    await healthService.checkDatabase();
    const mongo = await healthService.checkMongoDatabase();
    return res.json({ status: 'ok', database: 'connected', mongo });
}

module.exports = { check };
