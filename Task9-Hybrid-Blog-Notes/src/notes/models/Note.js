const { mongoose } = require('../db');

const noteSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20000,
    },
    ownerId: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: Number.isSafeInteger,
            message: 'ownerId must be a PostgreSQL integer user id',
        },
        immutable: true,
        index: true,
    },
    visibility: {
        type: String,
        enum: ['private', 'shared'],
        default: 'private',
        index: true,
    },
}, {
    timestamps: true,
    versionKey: false,
    strict: true,
});

noteSchema.index({ ownerId: 1, createdAt: -1 });
noteSchema.index({ visibility: 1, createdAt: -1 });

module.exports = mongoose.models.Note || mongoose.model('Note', noteSchema);
