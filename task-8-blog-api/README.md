# Task 8 - Blog API with Authentication and Roles
**Name:** خالد محمد احمد السيد المصري

This project changes the Notes API idea into a small Blog API. A user can register, sign in, write posts, and view the authenticated feed containing posts from all users. Users can edit or delete their own posts. An administrator can edit or delete any post.

The API uses Node.js, Express, PostgreSQL, TypeORM, bcryptjs, JSON Web Tokens, and Zod. It is a backend API; Postman is used to send requests. There is no separate web or mobile application in this task.

## What is a blog post and feed?

A **post** is an article created by a user. It has a title, body, author, and timestamps. The **feed** is the list of posts from all users, ordered newest first. In this project, the feed is available only after signing in.

## Project structure

```text
task-8-blog-api/
├── entities/
│   ├── post.js
│   └── user.js
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   ├── postOwnerCondition.js
│   ├── requireRole.js
│   └── validate.js
├── test/
│   └── middleware.test.js
├── .env.example
├── .gitignore
├── db.js
├── package-lock.json
├── package.json
├── Postman-Blog-Demo.postman_collection.json
├── schema.sql
└── server.js
```

## Requirements

- Node.js 18 or newer (Node.js 20 LTS is recommended)
- PostgreSQL running on your computer
- Postman for API testing
- DBeaver is optional; it can be used to inspect the PostgreSQL database

You do not need a separate Blog application or a browser frontend. The Express server is the API, Postman is the client used for this exercise, and PostgreSQL stores users and posts.

## Install and configure

Open PowerShell or a terminal in this folder (the one containing `package.json`), then install the exact dependencies from the lockfile:

```bash
npm ci
```

If there is no `package-lock.json`, use `npm install` once instead. Copy the environment template:

```bash
# macOS / Linux
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Open `.env` and set the connection values to match your PostgreSQL installation. `DB_PASSWORD` must be the password of the PostgreSQL user, not a Postman password. Set `JWT_SECRET` to a private random value of at least 32 characters. Do not commit or share `.env`.

The server creates the database named by `DB_NAME` (default `blog_app`) if it does not exist, then TypeORM creates or updates the tables for this learning project. The PostgreSQL account must be allowed to create databases. If it does not have that permission, create `blog_app` manually in PostgreSQL or DBeaver first. `schema.sql` is included as a readable schema reference; automatic synchronization is used when the server starts.

## Run the API

Start PostgreSQL first, then run:

```bash
npm start
```

The server uses `http://localhost:3004` by default. Leave the terminal open while testing. If you change `PORT` in `.env`, use that port in the Postman requests.

Check the code and run the middleware tests with:

```bash
npm run check
npm test
```

## Authentication flow

1. Register with `POST /auth/register`.
2. The API stores a bcrypt password hash and returns an `accessToken` and public user details. It never returns the password or hash.
3. Send `POST /auth/login` to get a fresh token later.
4. For protected requests, choose **Authorization > Bearer Token** in Postman and paste the token. Do not type the word `Bearer` into Postman's Token field; Postman adds it for you.
5. New accounts always have the `user` role. A caller cannot grant themselves admin by adding a `role` field to the registration JSON.

Registration requires a username of 3-80 characters, a valid email, and a password with at least 6 characters, including an uppercase letter and a number. Duplicate username or email returns `409`.

## API routes

All URLs below use `http://localhost:3004` as the base address.

| Method | Path | Token | Purpose |
|---|---|---|---|
| `GET` | `/health` | No | Check database connectivity |
| `POST` | `/auth/register` | No | Register a user; returns a token |
| `POST` | `/auth/login` | No | Sign in; returns a token |
| `GET` | `/auth/me` | Yes | Return the signed-in user's public details |
| `POST` | `/posts` | Yes | Create a post for the signed-in user |
| `GET` | `/posts` | Yes | Read the global feed, newest posts first |
| `GET` | `/posts/:id` | Yes | Read one post |
| `GET` | `/posts/search?q=word` | Yes | Search titles and post content across the feed |
| `PUT` | `/posts/:id` | Yes | Edit own post; an admin may edit any post |
| `DELETE` | `/posts/:id` | Yes | Delete own post; an admin may delete any post |
| `GET` | `/admin/users` | Admin | List public user fields (never passwords) |

The feed, search, and single-post route require a valid token. A regular user sees posts from all authors but can only change their own posts. If a user tries to edit or delete another user's post, the API returns `404` so it does not reveal whether a private operation target belongs to someone else. An admin can edit or delete any post, but the feed remains protected by login.

### Register

```text
POST http://localhost:3004/auth/register
Content-Type: application/json
```

```json
{
  "username": "ahmed",
  "email": "ahmed@example.com",
  "password": "StrongPass123"
}
```

A successful response has status `201` and resembles:

```json
{
  "accessToken": "<JWT>",
  "user": {
    "id": 1,
    "username": "ahmed",
    "email": "ahmed@example.com",
    "role": "user"
  }
}
```

### Create a post

Send a valid Bearer token and a JSON body:

```text
POST http://localhost:3004/posts
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "title": "My first blog post",
  "content": "This is the full text of my first post."
}
```

The API returns `201 Created`. The author is taken from the token; clients cannot choose another author's user ID.

### View the feed

```text
GET http://localhost:3004/posts
Authorization: Bearer YOUR_ACCESS_TOKEN
```

The response is an array of posts with title, content, timestamps, and public author information (`id` and `username`). An empty array means no posts have been published yet. Every signed-in user sees the same global feed.

### Search the feed

```text
GET http://localhost:3004/posts/search?q=blog
Authorization: Bearer YOUR_ACCESS_TOKEN
```

The search ignores case and matches the title or content. The `q` parameter is required; missing or blank search text returns `400`.

### Update or delete a post

Replace `1` with the post ID. A regular user can update or delete only their own posts. Admins can update or delete posts from any author.

```text
PUT http://localhost:3004/posts/1
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

```json
{
  "title": "Updated blog title",
  "content": "Updated post body."
}
```

```text
DELETE http://localhost:3004/posts/1
Authorization: Bearer YOUR_ACCESS_TOKEN
```

The `PUT` body requires both `title` and `content`. A malformed ID or invalid body returns `400`; a missing post or a post the regular user does not own returns `404`.

## Postman steps

1. Start PostgreSQL and the API server.
2. Import `Postman-Blog-Demo.postman_collection.json` using **Import** in Postman, or create requests from the route table above.
3. Send **Register** once. The collection creates a unique demo username/email and saves the returned token automatically.
4. Send **Login** whenever you want a fresh token for the account saved by Register.
5. Send **Create a post**; its test saves the created post ID.
6. Send **View feed**, **Search feed**, **View one post**, **Update created post**, and **Delete created post**. Requests that need an ID use the saved collection variable.
7. To create a second account, send Register again; it creates another unique user and replaces the collection token. The feed should now show posts by different authors.
8. To test admin-only behavior, first create a user, then promote that account in the local database as described below, log in again to get a new JWT, and set that token in Postman. The admin can then use `/admin/users` and manage posts by any author.

A `401` means the token is missing, invalid, or expired. Log in or register again and use the returned token.

## DBeaver connection and admin exercise

DBeaver is optional. Create a PostgreSQL connection with the same values as `.env`:

- Host: `DB_HOST`
- Port: `DB_PORT`
- Database: `DB_NAME`
- Username: `DB_USERNAME`
- Password: `DB_PASSWORD`

To promote your own local test account, connect to the `blog_app` database and run this SQL, replacing the email with the account you created:

```sql
UPDATE users SET role = 'admin' WHERE email = 'ahmed@example.com';
```

Then log in again; the previous token still contains the old role. Test `GET /admin/users` and use the new admin token to update or delete a post created by another user. The admin route returns only `id`, `username`, `email`, and `role`.

## Important files

- `server.js`: Express routes, authentication, feed, post operations, and validation schemas
- `db.js`: PostgreSQL and TypeORM DataSource configuration and local database creation
- `entities/user.js`: user fields and relationship to posts
- `entities/post.js`: post fields and relationship to its author
- `middleware/auth.js`: JWT verification
- `middleware/postOwnerCondition.js`: owner-only post changes with admin override
- `middleware/requireRole.js`: role checks
- `middleware/validate.js`: Zod request validation
- `middleware/errorHandler.js`: consistent 404 and safe error responses
- `schema.sql`: readable PostgreSQL table reference
- `.env.example`: safe environment template

## Security notes

- Never commit `.env`, database passwords, or a real JWT secret. `.env` is ignored by Git.
- Passwords are stored as bcrypt hashes and are never returned by the API.
- A user's role is assigned by the server, not by registration input.
- Post ownership is enforced on update/delete; admin override is explicit.
- `synchronize: true` and automatic database creation are for this learning task. Use migrations and tighter database permissions in production.
- Use HTTPS in a real deployment.
