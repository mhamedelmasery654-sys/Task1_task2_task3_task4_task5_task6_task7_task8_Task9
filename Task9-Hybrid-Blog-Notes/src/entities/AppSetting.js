const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'AppSetting',
    tableName: 'app_settings',
    columns: {
        key: {
            type: String,
            primary: true,
            length: 80,
        },
        value: {
            type: String,
            length: 120,
        },
        updated_at: {
            type: 'timestamp with time zone',
            updateDate: true,
        },
    },
});
