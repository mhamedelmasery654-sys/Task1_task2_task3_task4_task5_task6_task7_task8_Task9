const { z } = require('zod');

const registerSchema = z.object({
    username: z.string().trim().min(3, 'Username must be at least 3 characters long').max(80),
    email: z.string().trim().email('Invalid email address').max(255),
    password: z.string()
        .min(6, 'Password must be at least 6 characters long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});

const loginSchema = z.object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

const passwordSchema = z.string()
    .min(6, 'Password must be at least 6 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
}).strict().refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current password',
});

module.exports = { registerSchema, loginSchema, changePasswordSchema };
