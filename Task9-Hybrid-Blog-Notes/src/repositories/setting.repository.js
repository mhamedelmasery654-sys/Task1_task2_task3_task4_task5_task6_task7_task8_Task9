const { AppDataSource } = require('../db');

const NOTES_MODE_KEY = 'notesMode';
const DEFAULT_NOTES_MODE = 'both';

function getRepository() {
    return AppDataSource.getRepository('AppSetting');
}

async function getNotesMode() {
    const setting = await getRepository().findOneBy({ key: NOTES_MODE_KEY });
    return setting ? setting.value : DEFAULT_NOTES_MODE;
}

async function setNotesMode(value) {
    const repository = getRepository();
    let setting = await repository.findOneBy({ key: NOTES_MODE_KEY });
    if (!setting) setting = repository.create({ key: NOTES_MODE_KEY, value });
    else setting.value = value;
    return repository.save(setting);
}

module.exports = { NOTES_MODE_KEY, DEFAULT_NOTES_MODE, getNotesMode, setNotesMode };
