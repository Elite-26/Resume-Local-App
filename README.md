# ResumeForge

Resume generator with React, Tailwind CSS, Express, and PostgreSQL.

## Stack

- **Client:** React + Vite + Tailwind CSS v4 (light/dark mode)
- **Server:** Express + TypeScript + JWT auth
- **Database:** PostgreSQL via Docker; schema via **TypeScript migration files** (not raw `.sql` dumps)

## Quick start

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

Optional Google Sign-In:

- Set `GOOGLE_CLIENT_ID` in `server/.env`
- Set `VITE_GOOGLE_CLIENT_ID` in `client/.env` (same client id)

### 3. Install & migrate

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run migrate
```

### 4. Run

```bash
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:4000  

The **first registered account** becomes **admin**. Later accounts are users.

## Features

### Auth
- Email/password register & sign-in
- Google account (when client ID is configured)
- Roles: `admin` | `user`

### Profile
- Full name, optional role, contact (joined with ` ● `)
- Multiple company experiences, education
- Prompt + output path
- Resume DOC formats from project `templates/` folder (plus optional admin upload)

### Resume build
1. Paste job links (line-separated) → Next  
2. Select one link → Start  
3. Fill JD (company, role, description); copy prompt & JD; similar-company warnings  
4. Paste resume content (`Professional Summary`, `Skill Set`, `TITLE: [role]`) → Generate  

Outputs under `{output_path}/{n}.{company}-{role}/`:

- PDF resume  
- DOC/DOCX resume  
- JD `.txt`  

All builds are stored in PostgreSQL.

### Resume templates

Place `.doc` / `.docx` files in the project-root `templates/` folder. The API syncs them into selectable resume formats on startup and when formats are listed.

```bash
# Regenerate sample DOCX stubs (optional)
cd server && npx tsx scripts/seed-templates.ts
```

### Job links
- Input/output panes  
- Remove duplicates  
- Sort  

## Migrations

```bash
npm run migrate          # apply pending
npm run migrate:down     # roll back last
cd server && npm run migrate:create -- add_something
```

Migration files live in `server/migrations/*.ts`.
