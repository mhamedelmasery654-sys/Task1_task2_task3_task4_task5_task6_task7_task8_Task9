# Task 6 - Notes API with TypeORM

This folder contains the same Notes API idea as Task 5, but the database operations use TypeORM repositories instead of direct SQL in the route handlers.

The search feature uses a TypeORM query builder and looks for a word or phrase in both the note title and note content.

## Requirements

- Node.js 18 or newer
- PostgreSQL
- DBeaver is optional for checking the database
- Postman is optional for testing the API

## Install

```bash
cd task-6-typeorm
npm install
cp .env.example .env
```

Open `.env` and set the PostgreSQL values for your computer.

Create a database called `notes_app` in PostgreSQL or DBeaver. TypeORM creates or updates the tables because `synchronize` is enabled for this learning task. The `schema.sql` file is also included as a database reference.

## Run

```bash
npm start
```

The server runs at:

```text
http://localhost:3002
```

## API routes

### Check the database connection

```text
GET http://localhost:3002/health
```

### Create a user

```text
POST http://localhost:3002/users
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
GET http://localhost:3002/users
```

### Create a note

Use a real user ID from `GET /users`.

```text
POST http://localhost:3002/notes
Content-Type: application/json
```

Body:

```json
{
  "title": "Learn TypeORM",
  "content": "Practice repositories and relations",
  "user_id": 1
}
```

### List notes

```text
GET http://localhost:3002/notes
```

### Search notes

The search is case-insensitive and checks `title` and `content`. This route uses TypeORM's query builder.

```text
GET http://localhost:3002/notes/search?q=typeorm
```

The `q` query parameter is required. If it is missing, the API returns status `400`.

## Postman steps

1. Create a new Postman collection.
2. Add the requests shown above.
3. For POST requests, choose `Body`, then `raw`, then `JSON`.
4. Set the header `Content-Type` to `application/json`.
5. Create a user first, then use its returned `id` when creating a note.
6. Send `GET /notes/search?q=typeorm` to test the ORM search feature.

## DBeaver connection

Use these values from `.env`:

- Host: `DB_HOST`
- Port: `DB_PORT`
- Database: `DB_NAME`
- Username: `DB_USER`
- Password: `DB_PASSWORD`

The entities create the `users` and `notes` tables. The `notes` table has a relation to `users` through `user_id`.

## Important files

- `server.js`: Express routes and TypeORM repository operations
- `db.js`: TypeORM DataSource configuration
- `entities/user.js`: User entity definition
- `entities/note.js`: Note entity definition
- `schema.sql`: database table reference
- `.env.example`: database configuration template
