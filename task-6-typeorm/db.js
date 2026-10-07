require('reflect-metadata');
const { DataSource } = require('typeorm');
const User = require('./entities/user');
const Note = require('./entities/note');
require('dotenv').config();

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'notes_app',
    synchronize: true,
    logging: false,
    entities: [User, Note],
});

module.exports = AppDataSource;
