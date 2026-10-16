# Task 9 - Hybrid Blog, Notes, and Front-End Workbench

**Name:** خالد محمد احمد السيد المصري

This task extends the Blog API with a Notes API and a browser workbench. One Express server provides the API and the frontend.

## What is included?

- User authentication, Blog Posts, and administration backed by PostgreSQL and TypeORM.
- Private and shared Notes backed by MongoDB and Mongoose.
- Ownership checks that use the signed-in PostgreSQL user; a client cannot choose a Note owner.
- Three Notes policies: `private_only`, `shared_only`, and `both`.
- A browser workbench with Notes, an API Test Bench, and admin data tools.
- A Postman collection and local environment for API testing.
- Automated tests, a PostgreSQL schema reference, and an execution report.

## Requirements

- Node.js 18 or newer and npm
- PostgreSQL running on the local computer
- MongoDB Community Server running on the local computer for Notes
- Optional: Postman, DBeaver, and MongoDB Compass

## Install and configure

Open a terminal in the folder that contains `package.json`, then install the locked dependencies:

```bash
npm ci
```

Create a local environment file only when one does not already exist:

```powershell
Copy-Item .env.example .env
```

Set the local database values in `.env`. Do not replace an existing `.env`, and do not share or commit it. `.env.example` contains placeholders only.

## Start the application

Start PostgreSQL and MongoDB, then run:

```bash
npm start
```

Open `http://localhost:3004/` in a browser. The API and workbench use the same Express server. The `/health` endpoint reports PostgreSQL and MongoDB separately. Blog and user records use PostgreSQL; Notes operations require MongoDB.

## Test the project

```bash
npm run check
npm test
```

Database integration tests must use isolated test databases. Do not run destructive tests against a database that contains personal or production data. The execution report lists what was tested and what was blocked.

## Postman

Import these files into Postman:

- Collection: `postman/exports/Task 9 Hybrid API.postman_collection.json`
- Environment: `postman/environments/Task 9 Hybrid Local.postman_environment.json`

The environment has no production credentials. Use disposable test accounts and records.

## Notes visibility

- `private_only`: new Notes are private, and regular users cannot use the shared feed.
- `shared_only`: new Notes are shared.
- `both`: users may choose an allowed visibility.

Changing the policy does not publish existing private Notes. Admin routes are protected by the server.

## Files not included

This source submission does not include `.env`, `node_modules`, Git history, or the cached MongoDB test executable. These are local or generated files; `.env` contains private settings, and dependencies can be restored from `package-lock.json` with `npm ci`. Keep database credentials on your own computer.

## Development assistance

AI tools assisted with implementation, review, and documentation. The execution report lists the checks that actually ran and the checks that were blocked.
