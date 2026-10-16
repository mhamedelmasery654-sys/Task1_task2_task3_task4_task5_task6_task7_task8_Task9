const { z } = require('zod');

const notesModeSchema = z.object({
    notesMode: z.enum(['private_only', 'shared_only', 'both']),
}).strict();

module.exports = { notesModeSchema };
