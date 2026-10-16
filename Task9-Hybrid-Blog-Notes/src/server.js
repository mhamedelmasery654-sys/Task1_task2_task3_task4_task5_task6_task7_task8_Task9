require('dotenv').config();

const app = require('./app');
const { AppDataSource, ensureDatabaseExists } = require('./db');
const { connectNotesDatabase } = require('./notes/db');
const PORT = Number(process.env.PORT || 3004);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be a valid port number between 1 and 65535.');
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'replace_with_a_random_secret_at_least_32_characters_long') {
    throw new Error('Set JWT_SECRET in .env to a random value with at least 32 characters.');
}

async function startServer() {
    await ensureDatabaseExists();
    await AppDataSource.initialize();
    // MongoDB is optional for Blog startup; Notes endpoints return 503 while unavailable.
    await connectNotesDatabase();
    return app.listen(PORT, () => {
        console.log(`Blog API is running on http://localhost:${PORT}`);
    });
}

if (require.main === module) {
    startServer().catch((error) => {
        console.error('Database initialization failed:', error.message);
        if (error.code === '42501') {
            console.error('Create the configured database manually or use a PostgreSQL account allowed to create databases.');
        }
        process.exit(1);
    });
}

module.exports = { app, startServer };
