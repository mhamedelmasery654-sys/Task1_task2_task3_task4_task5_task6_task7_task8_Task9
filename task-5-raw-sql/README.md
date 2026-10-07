# Task 5 - Notes API with Raw SQL

This folder contains a small Notes API built with Node.js, Express, PostgreSQL, and the `pg` package.

The database work uses direct SQL statements with `pool.query`. The search feature looks for a word or phrase in both the note title and note content.

## Requirements

- Node.js 18 or newer
- PostgreSQL
- DBeaver is optional for running SQL and checking the tables
- Postman is optional for testing the API

## Install

```bash
cd task-5-raw-sql
npm install
cp .env.example .env
```

Open `.env` and set the PostgreSQL values for your computer.

Create a database called `notes_app` in PostgreSQL or DBeaver. Then open `schema.sql` in DBeaver and run it in the `notes_app` database.

## Run

```bash
npm start
```

The server runs at:

```text
http://localhost:3001
```

## API routes

### Check the database connection

```text
GET http://localhost:3001/health
```

### Create a user

```text
POST http://localhost:3001/users
Content-Type: application/json
```

Body:

```json
{
  "name": "Test User",
  "email": "test@example.com"
}
```

### List users

```text
GET http://localhost:3001/users
```

### Create a note

Use a real user ID from `GET /users`.

```text
POST http://localhost:3001/notes
Content-Type: application/json
```

Body:

```json
{
  "title": "Learn PostgreSQL",
  "content": "Practice SELECT and JOIN queries",
  "user_id": 1
}
```

### List notes

```text
GET http://localhost:3001/notes
```

### Search notes

The search is case-insensitive and checks `title` and `content`.

```text
GET http://localhost:3001/notes/search?q=postgres
```

The `q` query parameter is required. If it is missing, the API returns status `400`.

## Postman steps

1. Create a new Postman collection.
2. Add the requests shown above.
3. For POST requests, choose `Body`, then `raw`, then `JSON`.
4. Set the header `Content-Type` to `application/json`.
5. Create a user first, then use its returned `id` when creating a note.
6. Send `GET /notes/search?q=postgres` to test the search feature.

## DBeaver connection

Use these values from `.env`:

- Host: `DB_HOST`
- Port: `DB_PORT`
- Database: `DB_NAME`
- Username: `DB_USER`
- Password: `DB_PASSWORD`

The tables created by `schema.sql` are `users` and `notes`.

## Important files

- `server.js`: Express routes and raw SQL queries
- `db.js`: PostgreSQL connection pool
- `schema.sql`: database tables and demo user
- `.env.example`: database configuration template
