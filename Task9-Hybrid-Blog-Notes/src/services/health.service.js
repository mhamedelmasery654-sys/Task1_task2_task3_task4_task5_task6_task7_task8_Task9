const { AppDataSource } = require('../db');
const { checkNotesDatabase } = require('../notes/db');

async function checkDatabase() {
    await AppDataSource.query('SELECT 1');
}

async function checkMongoDatabase() {
    return checkNotesDatabase();
}

module.exports = { checkDatabase, checkMongoDatabase };
