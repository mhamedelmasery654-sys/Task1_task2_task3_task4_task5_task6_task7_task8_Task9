const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppDataSource, ensureDatabaseExists } = require('./db');
const authMiddleware = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3003);

app.use(express.json());

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
    };
}

function publicNote(note, userId) {
    return {
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.created_at,
        userId,
    };
}

function createAccessToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
}

function getAuthenticatedUser(req, res) {
    const authorization = req.get('authorization') || '';
    const [scheme, token, extra] = authorization.trim().split(/\s+/);

    if (scheme !== 'Bearer' || !token || extra) {
        res.status(401).json({ error: 'Bearer token is required' });
        return null;
    }

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        if (!user || typeof user !== 'object' || !Number.isInteger(user.id)) {
            res.status(401).json({ error: 'Invalid or expired access token' });
            return null;
        }
        return user;
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired access token' });
        return null;
    }
}

app.get('/health', async (req, res) => {
    try {
        await AppDataSource.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'username, email, and password are required' });
    }
    if (String(password).length < 6) {
        return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    try {
        const userRepository = AppDataSource.getRepository('User');
        const existingUser = await userRepository.findOne({
            where: [{ username }, { email }],
        });
        if (existingUser) {
            return res.status(409).json({ error: 'username or email is already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = userRepository.create({ username, email, password: passwordHash });
        const savedUser = await userRepository.save(user);
        res.status(201).json({
            accessToken: createAccessToken(savedUser),
            user: publicUser(savedUser),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }

    try {
        const userRepository = AppDataSource.getRepository('User');
        const user = await userRepository.findOneBy({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'invalid email or password' });
        }

        res.json({
            accessToken: createAccessToken(user),
            user: publicUser(user),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/auth/me', async (req, res) => {
    const authenticatedUser = getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
        return;
    }

    try {
        const userRepository = AppDataSource.getRepository('User');
        const user = await userRepository.findOneBy({ id: authenticatedUser.id });
        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }
        res.json({ user: publicUser(user) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/notes', async (req, res) => {
    const authenticatedUser = getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
        return;
    }

    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: 'title and content are required' });
    }

    try {
        const userRepository = AppDataSource.getRepository('User');
        const noteRepository = AppDataSource.getRepository('Note');
        const user = await userRepository.findOneBy({ id: authenticatedUser.id });
        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }
        const note = noteRepository.create({ title, content, user });
        const savedNote = await noteRepository.save(note);
        res.status(201).json({ note: publicNote(savedNote, user.id) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/notes', async (req, res) => {
    const authenticatedUser = getAuthenticatedUser(req, res);
    if (!authenticatedUser) {
        return;
    }

    try {
        const noteRepository = AppDataSource.getRepository('Note');
        const notes = await noteRepository.find({
            where: { user: { id: authenticatedUser.id } },
            order: { id: 'ASC' },
        });
        res.json(notes.map((note) => publicNote(note, authenticatedUser.id)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/notes/:id', authMiddleware, async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: 'title and content are required' });
    }

    try {
        const noteRepository = AppDataSource.getRepository('Note');
        const note = await noteRepository.findOne({
            where: { id: Number(req.params.id), user: { id: req.user.id } },
        });
        if (!note) {
            return res.status(404).json({ error: 'note not found' });
        }

        note.title = title;
        note.content = content;
        const updatedNote = await noteRepository.save(note);
        res.json({ note: publicNote(updatedNote, req.user.id) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/notes/:id', authMiddleware, async (req, res) => {
    try {
        const noteRepository = AppDataSource.getRepository('Note');
        const note = await noteRepository.findOne({
            where: { id: Number(req.params.id), user: { id: req.user.id } },
        });
        if (!note) {
            return res.status(404).json({ error: 'note not found' });
        }

        await noteRepository.remove(note);
        res.json({ message: 'note deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/notes/search', authMiddleware, async (req, res) => {
    const search = String(req.query.q || '').trim();
    if (!search) {
        return res.status(400).json({ error: 'q query parameter is required' });
    }

    try {
        const noteRepository = AppDataSource.getRepository('Note');
        const notes = await noteRepository
            .createQueryBuilder('note')
            .where('note.user_id = :userId', { userId: req.user.id })
            .andWhere('(LOWER(note.title) LIKE LOWER(:search) OR LOWER(note.content) LIKE LOWER(:search))', {
                search: `%${search}%`,
            })
            .orderBy('note.id', 'ASC')
            .getMany();
        res.json(notes.map((note) => publicNote(note, req.user.id)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

ensureDatabaseExists()
    .then(() => AppDataSource.initialize())
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Password hashing API is running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Database initialization failed:', error.message);
        if (error.code === '42501') {
            console.error(
                'The PostgreSQL user must have permission to create databases, or create the configured database manually.'
            );
        }
        process.exit(1);
    });
