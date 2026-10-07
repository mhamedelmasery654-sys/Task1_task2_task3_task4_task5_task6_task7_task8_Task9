const express = require('express');
const AppDataSource = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3002);

app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        await AppDataSource.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/users', async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: 'name and email are required' });
    }

    try {
        const repository = AppDataSource.getRepository('User');
        const user = repository.create({ name, email });
        const savedUser = await repository.save(user);
        res.status(201).json(savedUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/users', async (req, res) => {
    try {
        const repository = AppDataSource.getRepository('User');
        res.json(await repository.find({ order: { id: 'ASC' } }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/notes', async (req, res) => {
    const { title, content, user_id } = req.body;
    if (!title || !content || !user_id) {
        return res.status(400).json({ error: 'title, content, and user_id are required' });
    }

    try {
        const userRepository = AppDataSource.getRepository('User');
        const noteRepository = AppDataSource.getRepository('Note');
        const user = await userRepository.findOneBy({ id: Number(user_id) });
        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        const note = noteRepository.create({ title, content, user });
        res.status(201).json(await noteRepository.save(note));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/notes', async (req, res) => {
    try {
        const repository = AppDataSource.getRepository('Note');
        res.json(await repository.find({
            relations: { user: true },
            order: { id: 'ASC' },
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/notes/search', async (req, res) => {
    const search = String(req.query.q || '').trim();
    if (!search) {
        return res.status(400).json({ error: 'q query parameter is required' });
    }

    try {
        const repository = AppDataSource.getRepository('Note');
        const notes = await repository
            .createQueryBuilder('note')
            .leftJoinAndSelect('note.user', 'user')
            .where('LOWER(note.title) LIKE LOWER(:search)', { search: `%${search}%` })
            .orWhere('LOWER(note.content) LIKE LOWER(:search)', { search: `%${search}%` })
            .orderBy('note.id', 'ASC')
            .getMany();
        res.json(notes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

AppDataSource.initialize()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`TypeORM server is running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Database initialization failed:', error.message);
        process.exit(1);
    });
