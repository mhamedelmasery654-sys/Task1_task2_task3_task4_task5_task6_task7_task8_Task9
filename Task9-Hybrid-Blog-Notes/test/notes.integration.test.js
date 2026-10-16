const test = require('node:test');
const assert = require('node:assert/strict');
const { noteSchema, noteUpdateSchema, noteSearchSchema } = require('../src/notes/validators/notes.validator');
const notesService = require('../src/notes/services/notes.service');

test('note body never accepts ownerId and defaults visibility to private', () => {
    const result = noteSchema.safeParse({ title: 'A note', content: 'Secret', ownerId: 999 });
    assert.equal(result.success, false);
    const valid = noteSchema.parse({ title: 'A note', content: 'Secret' });
    assert.equal(valid.visibility, 'private');
});

test('notes mode allows only its configured visibility', () => {
    assert.equal(notesService.modeAllows('private_only', 'private'), true);
    assert.equal(notesService.modeAllows('private_only', 'shared'), false);
    assert.equal(notesService.modeAllows('shared_only', 'shared'), true);
    assert.equal(notesService.modeAllows('both', 'private'), true);
});

test('note updates reject ownerId changes', () => {
    assert.equal(noteUpdateSchema.safeParse({ ownerId: 42 }).success, false);
});

test('Note content size and search pagination are validated', () => {
    assert.equal(noteSchema.safeParse({ title: 'A note', content: 'x'.repeat(20001) }).success, false);
    assert.deepEqual(noteSearchSchema.parse({ q: 'term', page: '2', limit: '10' }), { q: 'term', page: 2, limit: 10 });
});
