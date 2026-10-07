const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'User',
    tableName: 'users',
    columns: {
        id: {
            type: Number,
            primary: true,
            generated: true,
        },
        name: {
            type: String,
            length: 120,
        },
        email: {
            type: String,
            unique: true,
            length: 255,
        },
    },
    relations: {
        notes: {
            type: 'one-to-many',
            target: 'Note',
            inverseSide: 'user',
        },
    },
});
