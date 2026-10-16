const Note = require('../models/Note');

function create(data) {
    return new Note(data);
}

function save(note) {
    return note.save();
}

function findById(id) {
    return Note.findById(id).exec();
}

function listByOwner(ownerId, { page = 1, limit = 20 } = {}) {
    return Note.find({ ownerId })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
}

function listFeed({ page = 1, limit = 20 } = {}) {
    return Note.find({ visibility: 'shared' })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function search(search, { ownerId, includePrivate = false, page = 1, limit = 20 } = {}) {
    const term = new RegExp(escapeRegex(String(search).trim()), 'i');
    const visibilityFilter = includePrivate
        ? (ownerId === undefined ? {} : { ownerId })
        : ownerId === undefined
            ? { visibility: 'shared' }
            : { $or: [{ visibility: 'shared' }, { ownerId, visibility: 'private' }] };
    return Note.find({
        $and: [visibilityFilter, { $or: [{ title: term }, { content: term }] }],
    })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
}

async function listAdmin({ search, ownerId, visibility, page = 1, limit = 20 }) {
    const filter = {};
    if (ownerId !== undefined) filter.ownerId = ownerId;
    if (visibility) filter.visibility = visibility;
    if (search) {
        const term = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ title: term }, { content: term }];
    }
    const [notes, total] = await Promise.all([
        Note.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).exec(),
        Note.countDocuments(filter).exec(),
    ]);
    return { notes, total };
}

function remove(note) {
    return note.deleteOne();
}

module.exports = {
    create,
    save,
    findById,
    listByOwner,
    listFeed,
    search,
    listAdmin,
    remove,
};
