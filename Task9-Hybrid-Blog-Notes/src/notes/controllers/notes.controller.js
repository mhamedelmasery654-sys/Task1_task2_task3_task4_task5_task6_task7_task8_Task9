const notesService = require('../services/notes.service');
const auditRepository = require('../../repositories/adminAudit.repository');

async function record(req, action, targetId = null) {
    await auditRepository.record({
        actor_id: req.user.id,
        actor_username: req.user.username,
        action,
        target_type: 'note',
        target_id: null,
        target_ref: targetId ? String(targetId) : null,
        request_id: req.requestId || null,
    });
}

async function create(req, res) {
    const note = await notesService.create(req.user, req.body);
    return res.status(201).json({ note });
}

async function listMine(req, res) {
    return res.json(await notesService.listMine(req.user, req.validatedQuery || {}));
}

async function feed(req, res) {
    return res.json(await notesService.getFeed(req.user, req.validatedQuery || {}));
}

async function search(req, res) {
    return res.json(await notesService.search(req.user || null, req.validatedQuery.q, req.validatedQuery || {}));
}

async function getById(req, res) {
    const note = await notesService.getById(req.user, req.params.id);
    if (!note) return res.status(404).json({ error: 'note not found' });
    return res.json({ note });
}

async function update(req, res) {
    const note = await notesService.update(req.user, req.params.id, req.body);
    if (!note) return res.status(404).json({ error: 'note not found' });
    return res.json({ note });
}

async function remove(req, res) {
    const removed = await notesService.remove(req.user, req.params.id);
    if (!removed) return res.status(404).json({ error: 'note not found' });
    return res.json({ message: 'note deleted' });
}

async function adminList(req, res) {
    return res.json(await notesService.listAdmin(req.validatedQuery));
}

async function adminGet(req, res) {
    const note = await notesService.getAdmin(req.params.id);
    if (!note) return res.status(404).json({ error: 'note not found' });
    return res.json({ note });
}

async function adminUpdate(req, res) {
    const note = await notesService.updateAdmin(req.params.id, req.body);
    if (!note) return res.status(404).json({ error: 'note not found' });
    await record(req, 'note.updated', req.params.id);
    return res.json({ note });
}

async function adminRemove(req, res) {
    const note = await notesService.removeAdmin(req.params.id);
    if (!note) return res.status(404).json({ error: 'note not found' });
    await record(req, 'note.deleted', req.params.id);
    return res.json({ message: 'note deleted', note });
}

async function adminChangeVisibility(req, res) {
    const note = await notesService.updateAdmin(req.params.id, { visibility: req.body.visibility });
    if (!note) return res.status(404).json({ error: 'note not found' });
    await record(req, 'note.visibility.updated', req.params.id);
    return res.json({ note });
}

async function getNotesMode(req, res) {
    return res.json({ notesMode: await notesService.getNotesMode() });
}

async function updateNotesMode(req, res) {
    const previous = await notesService.getNotesMode();
    const notesMode = await notesService.setNotesMode(req.body.notesMode);
    await record(req, 'settings.notes-mode.updated', null);
    return res.json({ notesMode, previousNotesMode: previous });
}

module.exports = {
    create,
    listMine,
    feed,
    search,
    getById,
    update,
    remove,
    adminList,
    adminGet,
    adminUpdate,
    adminRemove,
    adminChangeVisibility,
    getNotesMode,
    updateNotesMode,
};
