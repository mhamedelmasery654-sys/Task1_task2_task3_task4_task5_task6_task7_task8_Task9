const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { AppDataSource, ensureDatabaseExists } = require('./db');
const authMiddleware = require('./middleware/auth');
const requireRole = require('./middleware/requireRole');
const validate = require('./middleware/validate');
const postOwnerCondition = require('./middleware/postOwnerCondition');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3004);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be a valid port number between 1 and 65535.');
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'replace_with_a_random_secret_at_least_32_characters_long') {
    throw new Error('Set JWT_SECRET in .env to a random value with at least 32 characters.');
}

app.use(express.json());

const registerSchema = z.object({
    username: z.string().trim().min(3, 'Username must be at least 3 characters long').max(80),
    email: z.string().trim().email('Invalid email address').max(255),
    password: z.string()
        .min(6, 'Password must be at least 6 characters long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});

const loginSchema = z.object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

const postSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
    content: z.string().trim().min(1, 'Content is required'),
});

const postIdSchema = z.object({
    id: z.string()
        .regex(/^[1-9]\d*$/, 'id must be a positive integer')
        .transform(Number)
        .refine(Number.isSafeInteger, 'id must be a positive integer'),
});

const postSearchSchema = z.object({
    q: z.string().trim().min(1, 'q query parameter is required'),
});

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
    };
}

function publicPost(post) {
    return {
        id: post.id,
        title: post.title,
        content: post.content,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        author: post.author ? {
            id: post.author.id,
            username: post.author.username,
        } : null,
    };
}

function createAccessToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
}

app.get('/health', async (req, res) => {
    await AppDataSource.query('SELECT 1');
    return res.json({ status: 'ok', database: 'connected' });
});

app.post('/auth/register', validate(registerSchema), async (req, res) => {
    const { username, email, password } = req.body;
    const normalizedUsername = String(username).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const userRepository = AppDataSource.getRepository('User');
    const existingUser = await userRepository.findOne({ where: [{ username: normalizedUsername }, { email: normalizedEmail }] });
    if (existingUser) {
        return res.status(409).json({ error: 'username or email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = userRepository.create({ username: normalizedUsername, email: normalizedEmail, password: passwordHash });
    const savedUser = await userRepository.save(user);
    return res.status(201).json({
        accessToken: createAccessToken(savedUser),
        user: publicUser(savedUser),
    });
});

app.post('/auth/login', validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await AppDataSource.getRepository('User').findOneBy({ email: normalizedEmail });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'invalid email or password' });
    }

    return res.json({ accessToken: createAccessToken(user), user: publicUser(user) });
});

// Only health, registration, and login are public. Everything below requires a valid JWT.
app.use(authMiddleware);

app.get('/auth/me', async (req, res) => {
    const user = await AppDataSource.getRepository('User').findOneBy({ id: req.user.id });
    if (!user) {
        return res.status(404).json({ error: 'user not found' });
    }
    return res.json({ user: publicUser(user) });
});

app.post('/posts', requireRole('user', 'admin'), validate(postSchema), async (req, res) => {
    const user = await AppDataSource.getRepository('User').findOneBy({ id: req.user.id });
    if (!user) {
        return res.status(404).json({ error: 'user not found' });
    }
    const postRepository = AppDataSource.getRepository('Post');
    const post = postRepository.create({ ...req.body, author: user });
    const savedPost = await postRepository.save(post);
    savedPost.author = user;
    return res.status(201).json({ post: publicPost(savedPost) });
});

// The authenticated feed contains posts from all users, newest first.
app.get('/posts', requireRole('user', 'admin'), async (req, res) => {
    const posts = await AppDataSource.getRepository('Post').find({
        relations: { author: true },
        order: { created_at: 'DESC', id: 'DESC' },
    });
    return res.json(posts.map(publicPost));
});

app.get('/posts/search', requireRole('user', 'admin'), validate(postSearchSchema, 'query'), async (req, res) => {
    const search = String(req.query.q).trim();
    const posts = await AppDataSource.getRepository('Post')
        .createQueryBuilder('post')
        .leftJoinAndSelect('post.author', 'author')
        .where('(LOWER(post.title) LIKE LOWER(:search) OR LOWER(post.content) LIKE LOWER(:search))', {
            search: `%${search}%`,
        })
        .orderBy('post.created_at', 'DESC')
        .addOrderBy('post.id', 'DESC')
        .getMany();
    return res.json(posts.map(publicPost));
});

app.get('/posts/:id', requireRole('user', 'admin'), validate(postIdSchema, 'params'), async (req, res) => {
    const post = await AppDataSource.getRepository('Post').findOne({
        where: { id: req.params.id },
        relations: { author: true },
    });
    if (!post) {
        return res.status(404).json({ error: 'post not found' });
    }
    return res.json({ post: publicPost(post) });
});

app.put(
    '/posts/:id',
    requireRole('user', 'admin'),
    validate(postIdSchema, 'params'),
    validate(postSchema),
    async (req, res) => {
        const postRepository = AppDataSource.getRepository('Post');
        const post = await postRepository.findOne({
            where: postOwnerCondition(req.user, req.params.id),
            relations: { author: true },
        });
        if (!post) {
            return res.status(404).json({ error: 'post not found' });
        }

        post.title = req.body.title;
        post.content = req.body.content;
        const updatedPost = await postRepository.save(post);
        return res.json({ post: publicPost(updatedPost) });
    }
);

app.delete('/posts/:id', requireRole('user', 'admin'), validate(postIdSchema, 'params'), async (req, res) => {
    const postRepository = AppDataSource.getRepository('Post');
    const post = await postRepository.findOne({ where: postOwnerCondition(req.user, req.params.id) });
    if (!post) {
        return res.status(404).json({ error: 'post not found' });
    }
    await postRepository.remove(post);
    return res.json({ message: 'post deleted' });
});

app.get('/admin/users', requireRole('admin'), async (req, res) => {
    const users = await AppDataSource.getRepository('User').find({
        select: { id: true, username: true, email: true, role: true },
        order: { id: 'ASC' },
    });
    return res.json({ users: users.map(publicUser) });
});

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
    await ensureDatabaseExists();
    await AppDataSource.initialize();
    app.listen(PORT, () => {
        console.log(`Blog API is running on http://localhost:${PORT}`);
    });
}

if (require.main === module) {
    startServer().catch((error) => {
        console.error('Database initialization failed:', error.message);
        if (error.code === '42501') {
            console.error('Create the configured database manually or use a PostgreSQL account allowed to create databases.');
        }
        process.exit(1);
    });
}

module.exports = { app, startServer, publicPost, publicUser };
