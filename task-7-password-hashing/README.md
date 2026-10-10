# Password Hashing and JWT Task

This is a local Node.js practice project. It uses Express, PostgreSQL, TypeORM, bcryptjs, and JSON Web Tokens.

The project teaches three important ideas:

1. Store a password as a hash, not as plain text.
2. Check a login password with `bcrypt.compare`.
3. Protect private routes with a JWT Bearer access token.

## Project structure

```text
password-hashing-task/
├── entities/
│   ├── note.js
│   └── user.js
├── .env.example
├── .gitignore
├── db.js
├── package.json
├── schema.sql
└── server.js
```

## Requirements

- Node.js 18 or newer
- PostgreSQL
- DBeaver is optional for checking the database
- Postman is optional for API testing

## Install

```bash
npm install
copy .env.example .env
```

On macOS or Linux, use this instead of `copy`:

```bash
cp .env.example .env
```

Open `.env` and set the PostgreSQL values. Use a long private value for `JWT_SECRET`.

On startup, the application creates the PostgreSQL database named in `DB_NAME` (default: `notes_app`) if it does not exist, then TypeORM creates the tables because `synchronize` is enabled for this learning project. The configured PostgreSQL user must have permission to create databases. If your provider does not grant that permission, create the database manually first. Set `DB_ADMIN_DATABASE` if the administrative connection database should be something other than `postgres`.

## Start the server

```bash
npm start
```

The server runs at:

```text
http://localhost:3003
```

## Authentication flow

### 1. Register a user

```text
POST http://localhost:3003/auth/register
Content-Type: application/json
```

Body:

```json
{
  "username": "ahmed",
  "email": "ahmed@example.com",
  "password": "secret123"
}
```

The API hashes the password with bcrypt before saving the user. The password is never returned in the response. A successful registration returns both the public user details and an `accessToken`, so the new user can call protected routes without logging in again.

Example response:

```json
{
  "accessToken": "<JWT>",
  "user": {
    "id": 1,
    "username": "ahmed",
    "email": "ahmed@example.com"
  }
}
```

### 2. Login

```text
POST http://localhost:3003/auth/login
Content-Type: application/json
```

Body:

```json
{
  "email": "ahmed@example.com",
  "password": "secret123"
}
```

The response contains an `accessToken`. Registration also returns a token, so either response can be used for protected routes.

### 3. Use the access point

The access point is the protected route:

```text
GET http://localhost:3003/auth/me
```

Add this header:

```text
Authorization: Bearer YOUR_ACCESS_TOKEN
```

The route reads the Bearer token, verifies it with `JWT_SECRET`, and returns the matching user's public data (`id`, `username`, and `email`). The same verified token is required for the notes routes.

## Protected notes routes

### Create a note

```text
POST http://localhost:3003/notes
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

Body:

```json
{
  "title": "My first note",
  "content": "This note belongs to the logged-in user."
}
```

### List my notes

```text
GET http://localhost:3003/notes
Authorization: Bearer YOUR_ACCESS_TOKEN
```

A request without a valid token receives status `401`.

## Postman steps

1. Start PostgreSQL and the Node.js server.
2. Create a `POST /auth/register` request.
3. Create a `POST /auth/login` request and copy the returned `accessToken`.
4. For protected requests, open the `Authorization` tab.
5. Choose type `Bearer Token` and paste the token.
6. Send `GET /auth/me` to test the access point.
7. Use the same token to create a note with `POST /notes`.
8. Send `GET /notes` with the same token to see the saved notes.

## DBeaver connection

Use the values in `.env`:

- Host: `DB_HOST`
- Port: `DB_PORT`
- Database: `DB_NAME`
- Username: `DB_USERNAME`
- Password: `DB_PASSWORD`

The tables are `users` and `notes`. The `users.password` column contains bcrypt hashes, not original passwords.

### Show notes in Postman

First send `POST http://localhost:3003/notes` with the same Bearer Token used for `/auth/me`. Select **Body > raw > JSON** and send:

```json
{
  "title": "My first note",
  "content": "This note belongs to the logged-in user."
}
```

The response confirms the note was saved. Then send `GET http://localhost:3003/notes` with that same Bearer Token. The response is an array of the signed-in user's notes. An empty array means no notes have been created for that user yet. Each returned note includes `id`, `title`, `content`, `createdAt`, and `userId`; it does not include user credentials.

## New protected routes

### Update a note

This route updates a note only when it belongs to the logged-in user.

```text
PUT http://localhost:3003/notes/1
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

Body:

```json
{
  "title": "Updated title",
  "content": "Updated note content"
}
```

### Delete a note

```text
DELETE http://localhost:3003/notes/1
Authorization: Bearer YOUR_ACCESS_TOKEN
```

The route returns `404` when the note does not exist or belongs to another user.

### Search my notes

The search checks the title and content of notes owned by the logged-in user.

```text
GET http://localhost:3003/notes/search?q=updated
Authorization: Bearer YOUR_ACCESS_TOKEN
```

The `q` query parameter is required. The new update, delete, and search routes use `middleware/auth.js`, so they return `401` without a valid Bearer token.

## Security notes

- Never commit `.env`.
- Never print passwords or password hashes in logs.
- Never return the password column in an API response.
- Use HTTPS in a real production deployment.
- Use a strong random JWT secret.
- `synchronize: true` is useful for learning, but migrations are safer for production.
