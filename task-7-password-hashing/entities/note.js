const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Note',
    tableName: 'notes',
    columns: {
        id: {
            type: Number,
            primary: true,
            generated: true,
        },
        title: {
            type: String,
            length: 200,
        },
        content: {
            type: String,
        },
        created_at: {
            type: 'timestamp with time zone',
            createDate: true,
        },
    },
    relations: {
        user: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: { name: 'user_id' },
            nullable: false,
            onDelete: 'CASCADE',
        },
    },
});
