const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'AdminAudit',
    tableName: 'admin_audit_logs',
    columns: {
        id: {
            type: Number,
            primary: true,
            generated: true,
        },
        actor_id: {
            type: Number,
        },
        actor_username: {
            type: String,
            length: 80,
        },
        action: {
            type: String,
            length: 80,
        },
        target_type: {
            type: String,
            length: 30,
        },
        target_id: {
            type: Number,
            nullable: true,
        },
        target_ref: {
            type: String,
            length: 80,
            nullable: true,
        },
        request_id: {
            type: String,
            length: 80,
            nullable: true,
        },
        created_at: {
            type: 'timestamp with time zone',
            createDate: true,
        },
    },
});
