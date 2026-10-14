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
        username: {
            type: String,
            length: 80,
            unique: true,
        },
        email: {
            type: String,
            length: 255,
            unique: true,
        },
        password: {
            type: String,
            length: 255,
        },
        role: {
            type: String,
            length: 30,
            default: 'user',
        },
    },
    relations: {
        posts: {
            type: 'one-to-many',
            target: 'Post',
            inverseSide: 'author',
        },
    },
});
