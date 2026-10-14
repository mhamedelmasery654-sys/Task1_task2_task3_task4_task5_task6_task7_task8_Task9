const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Post',
    tableName: 'posts',
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
            type: 'text',
        },
        created_at: {
            type: 'timestamp with time zone',
            createDate: true,
        },
        updated_at: {
            type: 'timestamp with time zone',
            updateDate: true,
        },
    },
    relations: {
        author: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: { name: 'user_id' },
            nullable: false,
            onDelete: 'CASCADE',
        },
    },
});
