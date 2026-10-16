const notesRepository = require('../repositories/notes.repository');
const userRepository = require('../../repositories/user.repository');
const settingRepository = require('../../repositories/setting.repository');
const { isNotesDatabaseAvailable, notesDatabaseError } = require('../db');

const NOTES_MODES = ['private_only', 'shared_only', 'both'];

function ensureAvailable() {
    if (!isNotesDatabaseAvailable()) throw notesDatabaseError();
}

function serialize(note) {
    if (!note) return null;
    const value = typeof note.toObject === 'function' ? note.toObject() : note;
    return {
        id: String(value._id || value.id),
        title: value.title,
        content: value.content,
        ownerId: Number(value.ownerId),
        visibility: value.visibility,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    };
}

function modeAllows(mode, visibility) {
    return mode === 'both' || mode === 'private_only' && visibility === 'private' || mode === 'shared_only' && visibility === 'shared';
}

async function getNotesMode() {
    return settingRepository.getNotesMode();
}

async function assertModeAllows(visibility) {
    const mode = await getNotesMode();
    if (!modeAllows(mode, visibility)) {
        const error = new Error(`Notes mode ${mode} does not allow ${visibility} notes`);
        error.statusCode = 400;
        throw error;
    }
}

function canView(note, user) {
    return note.visibility === 'shared' || user.role === 'admin' || Number(note.ownerId) === Number(user.id);
}

async function create(user, data) {
    ensureAvailable();
    await userRepository.findAuthUserById(user.id);
    await assertModeAllows(data.visibility);
    const note = notesRepository.create({
        title: data.title,
        content: data.content,
        visibility: data.visibility,
        ownerId: Number(user.id),
    });
    return serialize(await notesRepository.save(note));
}

async function listMine(user, options) {
    ensureAvailable();
    const notes = await notesRepository.listByOwner(Number(user.id), options);
    return notes.map(serialize);
}

async function getFeed(user, options) {
    ensureAvailable();
    if (await getNotesMode() === 'private_only' && user.role !== 'admin') {
        const error = new Error('The shared Notes feed is disabled in private_only mode');
        error.statusCode = 403;
        throw error;
    }
    const notes = await notesRepository.listFeed(options);
    return notes.map(serialize);
}

async function search(user, query, options) {
    ensureAvailable();
    const notes = await notesRepository.search(query, {
        ...options,
        ownerId: user && user.role !== 'admin' ? Number(user.id) : undefined,
        includePrivate: Boolean(user && user.role === 'admin'),
    });
    return notes.map(serialize);
}

async function getById(user, id) {
    ensureAvailable();
    const note = await notesRepository.findById(id);
    if (!note || !canView(note, user)) return null;
    return serialize(note);
}

async function update(user, id, changes) {
    ensureAvailable();
    const note = await notesRepository.findById(id);
    if (!note || Number(note.ownerId) !== Number(user.id)) return null;
    if (changes.visibility !== undefined) await assertModeAllows(changes.visibility);
    if (changes.title !== undefined) note.title = changes.title;
    if (changes.content !== undefined) note.content = changes.content;
    if (changes.visibility !== undefined) note.visibility = changes.visibility;
    return serialize(await notesRepository.save(note));
}

async function remove(user, id) {
    ensureAvailable();
    const note = await notesRepository.findById(id);
    if (!note || Number(note.ownerId) !== Number(user.id)) return null;
    await notesRepository.remove(note);
    return true;
}

async function listAdmin(options) {
    ensureAvailable();
    const result = await notesRepository.listAdmin({
        ...options,
        search: options.q || options.search,
    });
    return {
        notes: result.notes.map(serialize),
        total: result.total,
        page: options.page,
        limit: options.limit,
    };
}

async function getAdmin(id) {
    ensureAvailable();
    return serialize(await notesRepository.findById(id));
}

async function updateAdmin(id, changes) {
    ensureAvailable();
    const note = await notesRepository.findById(id);
    if (!note) return null;
    if (changes.title !== undefined) note.title = changes.title;
    if (changes.content !== undefined) note.content = changes.content;
    if (changes.visibility !== undefined) note.visibility = changes.visibility;
    return serialize(await notesRepository.save(note));
}

async function removeAdmin(id) {
    ensureAvailable();
    const note = await notesRepository.findById(id);
    if (!note) return null;
    await notesRepository.remove(note);
    return serialize(note);
}

async function setNotesMode(mode) {
    if (!NOTES_MODES.includes(mode)) throw new Error('Invalid notes mode');
    return settingRepository.setNotesMode(mode);
}

module.exports = {
    NOTES_MODES,
    serialize,
    modeAllows,
    getNotesMode,
    create,
    listMine,
    getFeed,
    search,
    getById,
    update,
    remove,
    listAdmin,
    getAdmin,
    updateAdmin,
    removeAdmin,
    setNotesMode,
};
