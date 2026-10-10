require('reflect-metadata');
const { DataSource } = require('typeorm');
const User = require('./entities/user');
const Note = require('./entities/note');
require('dotenv').config();

const connectionOptions = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'notes_app',
};

const AppDataSource = new DataSource({
    ...connectionOptions,
    synchronize: true,
    logging: false,
    entities: [User, Note],
});

async function ensureDatabaseExists() {
    const { Client } = require('pg');
    const databaseName = connectionOptions.database;
    const adminClient = new Client({
        host: connectionOptions.host,
        port: connectionOptions.port,
        user: connectionOptions.username,
        password: connectionOptions.password,
        database: process.env.DB_ADMIN_DATABASE || 'postgres',
    });

    await adminClient.connect();
    try {
        const result = await adminClient.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [databaseName]
        );
        if (result.rowCount === 0) {
            const quotedDatabaseName = `"${databaseName.replace(/"/g, '""')}"`;
            try {
                await adminClient.query(`CREATE DATABASE ${quotedDatabaseName}`);
            } catch (error) {
                if (error.code !== '42P04') {
                    throw error;
                }
            }
        }
    } finally {
        await adminClient.end();
    }
}

module.exports = { AppDataSource, ensureDatabaseExists };
