const { z } = require('zod');

const postSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
    content: z.string().trim().min(1, 'Content is required'),
});

const postIdSchema = z.object({
    id: z.string()
        .regex(/^[1-9]\d*$/, 'id must be a positive integer')
        .transform(Number)
        .refine(Number.isSafeInteger, 'id must be a positive integer'),
});

const postSearchSchema = z.object({
    q: z.string().trim().min(1, 'q query parameter is required'),
});

module.exports = { postSchema, postIdSchema, postSearchSchema };
