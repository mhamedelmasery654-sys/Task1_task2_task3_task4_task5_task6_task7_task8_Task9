const mongoose = require('mongoose');
require('dotenv').config();

let lastError = null;
let connectionStatus = 'disconnected';

function getMongoUri() {
    return process.env.MONGODB_URI
        || process.env.MONGO_URI
        || process.env.MONGO_URL
        || 'mongodb://127.0.0.1:27017/task8_notes';
}

async function connectNotesDatabase() {
    if (mongoose.connection.readyState === 1) {
        connectionStatus = 'connected';
        lastError = null;
        return true;
    }

    connectionStatus = 'connecting';
    try {
        await mongoose.connect(getMongoUri(), {
            serverSelectionTimeoutMS: 3000,
            connectTimeoutMS: 3000,
            maxPoolSize: 10,
        });
        connectionStatus = 'connected';
        lastError = null;
        return true;
    } catch (error) {
        connectionStatus = 'unavailable';
        lastError = 'MongoDB connection failed';
        return false;
    }
}

async function checkNotesDatabase() {
    if (mongoose.connection.readyState !== 1) {
        return {
            status: connectionStatus === 'connecting' ? 'connecting' : 'unavailable',
            error: lastError || 'MongoDB is not connected',
        };
    }

    try {
        await mongoose.connection.db.admin().ping();
        connectionStatus = 'connected';
        lastError = null;
        return { status: 'connected' };
    } catch (error) {
        connectionStatus = 'unavailable';
        lastError = 'MongoDB health check failed';
        return { status: 'unavailable', error: lastError };
    }
}

function isNotesDatabaseAvailable() {
    return mongoose.connection.readyState === 1 && connectionStatus === 'connected';
}

function notesDatabaseError() {
    const error = new Error('Notes database is unavailable');
    error.statusCode = 503;
    error.code = 'NOTES_DATABASE_UNAVAILABLE';
    return error;
}

async function disconnectNotesDatabase() {
    // Never tear down a shared or non-test database accidentally.
    if (process.env.NODE_ENV !== 'test' || process.env.MONGO_TEST !== 'true') return;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    connectionStatus = 'disconnected';
    lastError = null;
}

module.exports = {
    mongoose,
    getMongoUri,
    connectNotesDatabase,
    checkNotesDatabase,
    isNotesDatabaseAvailable,
    notesDatabaseError,
    disconnectNotesDatabase,
};
