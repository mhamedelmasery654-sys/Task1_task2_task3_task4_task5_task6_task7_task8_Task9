const express = require('express');
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { userIdSchema } = require('../validators/admin.validator');
const requirePasswordChange = require('../middleware/requirePasswordChange');
const { userListSchema, userUpdateSchema, roleSchema, statusSchema, postListSchema, postSchema, auditListSchema } = require('../validators/admin.validator');
const notesController = require('../notes/controllers/notes.controller');
const { adminNoteListSchema, adminNoteSearchSchema, noteIdSchema, noteUpdateSchema, visibilitySchema } = require('../notes/validators/notes.validator');
const { notesModeSchema } = require('../validators/settings.validator');

const router = express.Router();

router.use(authMiddleware, requirePasswordChange, requireRole('admin'));
router.get('/overview', adminController.getOverview);
router.get('/users', validate(userListSchema, 'query'), adminController.getUsers);
router.get('/users/:id', validate(userIdSchema, 'params'), adminController.getUser);
router.patch('/users/:id', validate(userIdSchema, 'params'), validate(userUpdateSchema), adminController.updateUser);
router.patch('/users/:id/role', validate(userIdSchema, 'params'), validate(roleSchema), adminController.changeUserRole);
router.patch('/users/:id/status', validate(userIdSchema, 'params'), validate(statusSchema), adminController.setUserDisabled);
router.delete('/users/:id', validate(userIdSchema, 'params'), adminController.deleteUser);
router.post('/users/:id/password-reset', validate(userIdSchema, 'params'), adminController.resetUserPassword);
router.get('/posts', validate(postListSchema, 'query'), adminController.getPosts);
router.get('/posts/:id', validate(userIdSchema, 'params'), adminController.getPost);
router.put('/posts/:id', validate(userIdSchema, 'params'), validate(postSchema), adminController.updatePost);
router.delete('/posts/:id', validate(userIdSchema, 'params'), adminController.deletePost);
router.get('/audit', validate(auditListSchema, 'query'), adminController.getAudit);
router.get('/notes', validate(adminNoteListSchema, 'query'), notesController.adminList);
router.get('/notes/search', validate(adminNoteSearchSchema, 'query'), notesController.adminList);
router.get('/notes/:id', validate(noteIdSchema, 'params'), notesController.adminGet);
router.patch('/notes/:id', validate(noteIdSchema, 'params'), validate(noteUpdateSchema), notesController.adminUpdate);
router.put('/notes/:id', validate(noteIdSchema, 'params'), validate(noteUpdateSchema), notesController.adminUpdate);
router.delete('/notes/:id', validate(noteIdSchema, 'params'), notesController.adminRemove);
router.patch('/notes/:id/visibility', validate(noteIdSchema, 'params'), validate(visibilitySchema), notesController.adminChangeVisibility);
router.get('/settings/notes-mode', notesController.getNotesMode);
router.patch('/settings/notes-mode', validate(notesModeSchema), notesController.updateNotesMode);

module.exports = router;
