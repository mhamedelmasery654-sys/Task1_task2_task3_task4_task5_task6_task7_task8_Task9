const express = require('express');
const postController = require('../controllers/post.controller');
const authMiddleware = require('../middleware/authMiddleware');
const requirePasswordChange = require('../middleware/requirePasswordChange');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { postSchema, postIdSchema, postSearchSchema } = require('../validators/post.validator');

const router = express.Router();

router.use(authMiddleware, requirePasswordChange);
router.post('/', requireRole('user', 'admin'), validate(postSchema), postController.create);
router.get('/', requireRole('user', 'admin'), postController.getFeed);
router.get('/search', requireRole('user', 'admin'), validate(postSearchSchema, 'query'), postController.search);
router.get('/:id', requireRole('user', 'admin'), validate(postIdSchema, 'params'), postController.getById);
router.put('/:id', requireRole('user', 'admin'), validate(postIdSchema, 'params'), validate(postSchema), postController.update);
router.delete('/:id', requireRole('user', 'admin'), validate(postIdSchema, 'params'), postController.remove);

module.exports = router;
