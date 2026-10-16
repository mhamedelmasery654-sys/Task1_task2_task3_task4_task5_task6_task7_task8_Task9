const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'id must be a valid MongoDB ObjectId');
const visibility = z.enum(['private', 'shared']);

const noteSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
    content: z.string().trim().min(1, 'Content is required').max(20000, 'Content must be 20000 characters or fewer'),
    visibility: visibility.default('private'),
}).strict();

const noteUpdateSchema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(20000).optional(),
    visibility: visibility.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const noteIdSchema = z.object({ id: objectId });
const pagination = {
    page: z.coerce.number().int().positive().max(100000).default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
};
const noteSearchSchema = z.object({ ...pagination, q: z.string().trim().min(1, 'q query parameter is required') });
const noteListSchema = z.object(pagination);
const adminNoteListSchema = z.object({
    ...pagination,
    q: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
    ownerId: z.coerce.number().int().positive().optional(),
    visibility: visibility.optional(),
});
const adminNoteSearchSchema = adminNoteListSchema.extend({
    q: z.string().trim().min(1, 'q query parameter is required'),
});
const visibilitySchema = z.object({ visibility });

module.exports = {
    objectId,
    visibility,
    noteSchema,
    noteUpdateSchema,
    noteIdSchema,
    noteSearchSchema,
    noteListSchema,
    adminNoteListSchema,
    adminNoteSearchSchema,
    visibilitySchema,
};
