const { z } = require('zod');

const userIdSchema = z.object({
    id: z.string()
        .regex(/^[1-9]\d*$/, 'id must be a positive integer')
        .transform(Number)
        .refine(Number.isSafeInteger, 'id must be a positive integer'),
});

const pagination = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const userListSchema = z.object({
    ...pagination,
    search: z.string().trim().max(120).optional(),
    sortBy: z.enum(['id', 'username', 'email', 'role', 'created_at']).default('id'),
    sortOrder: z.enum(['ASC', 'DESC']).default('ASC'),
}).strict();

const userUpdateSchema = z.object({
    username: z.string().trim().min(3).max(80).optional(),
    email: z.string().trim().email().max(255).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one allowed user field is required',
});

const roleSchema = z.object({
    role: z.enum(['user', 'admin']),
}).strict();

const statusSchema = z.object({
    disabled: z.boolean(),
}).strict();

const postListSchema = z.object({
    ...pagination,
    search: z.string().trim().max(120).optional(),
    authorId: z.coerce.number().int().positive().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ['to'],
    message: 'to must be the same as or later than from',
});

const postSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
    content: z.string().trim().min(1, 'Content is required'),
}).strict();

const auditListSchema = z.object({
    ...pagination,
    action: z.string().trim().max(80).optional(),
    targetType: z.enum(['user', 'post']).optional(),
}).strict();

module.exports = {
    userIdSchema,
    userListSchema,
    userUpdateSchema,
    roleSchema,
    statusSchema,
    postListSchema,
    postSchema,
    auditListSchema,
};
