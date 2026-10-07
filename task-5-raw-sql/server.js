const express = require('express');
const pool = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
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
        const result = await pool.query(
            'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
            [name, email]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users ORDER BY id');
        res.json(result.rows);
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
        const result = await pool.query(
            'INSERT INTO notes (title, content, user_id) VALUES ($1, $2, $3) RETURNING *',
            [title, content, user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/notes', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT notes.*, users.name AS user_name, users.email AS user_email
             FROM notes
             JOIN users ON users.id = notes.user_id
             ORDER BY notes.id`
        );
        res.json(result.rows);
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
        const result = await pool.query(
            `SELECT notes.*, users.name AS user_name, users.email AS user_email
             FROM notes
             JOIN users ON users.id = notes.user_id
             WHERE notes.title ILIKE $1 OR notes.content ILIKE $1
             ORDER BY notes.id`,
            [`%${search}%`]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Raw SQL server is running on http://localhost:${PORT}`);
});
