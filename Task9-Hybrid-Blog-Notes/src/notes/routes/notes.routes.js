const express = require('express');
const notesController = require('../controllers/notes.controller');
const authMiddleware = require('../../middleware/authMiddleware');
const requirePasswordChange = require('../../middleware/requirePasswordChange');
const requireRole = require('../../middleware/requireRole');
const validate = require('../../middleware/validate');
const {
    noteSchema,
    noteUpdateSchema,
    noteIdSchema,
    noteSearchSchema,
    noteListSchema,
} = require('../validators/notes.validator');

const router = express.Router();

router.use(authMiddleware, requirePasswordChange, requireRole('user', 'admin'));

router.get('/feed', validate(noteListSchema, 'query'), notesController.feed);
router.get('/search', validate(noteSearchSchema, 'query'), notesController.search);
router.get('/mode', notesController.getNotesMode);
router.get('/settings', notesController.getNotesMode);
router.post('/', validate(noteSchema), notesController.create);
router.get('/', validate(noteListSchema, 'query'), notesController.listMine);
router.get('/:id', validate(noteIdSchema, 'params'), notesController.getById);
router.patch('/:id', validate(noteIdSchema, 'params'), validate(noteUpdateSchema), notesController.update);
router.put('/:id', validate(noteIdSchema, 'params'), validate(noteUpdateSchema), notesController.update);
router.delete('/:id', validate(noteIdSchema, 'params'), notesController.remove);

module.exports = router;
