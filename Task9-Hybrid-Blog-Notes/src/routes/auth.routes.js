const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const { changePasswordSchema } = require('../validators/auth.validator');

const router = express.Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authMiddleware, authController.getCurrentUser);
router.post('/change-password', authMiddleware, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
