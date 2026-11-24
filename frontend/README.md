# Student Appeal Management System — Frontend

React + Vite frontend for the supplied Flask/PostgreSQL backend.

## 1. Requirements

- Node.js 18 or newer (Node.js 20 LTS recommended)
- The Flask backend running at `http://127.0.0.1:5000`
- Your existing PostgreSQL database and backend `.env` configured

## 2. Install

Open a **second** VS Code terminal (leave Flask running in the first terminal).

Go to the frontend folder:

```powershell
cd .\frontend
```

If this folder already contains an older frontend, make a backup before replacing files. Extract/copy this package's contents into `frontend`.

Install packages:

```powershell
npm install
```

Start the frontend:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## 3. Start the backend first

In terminal 1, from the project root, activate your existing virtual environment and start Flask using the configuration that you verified:

```powershell
$env:PATH = "C:\Program Files\PostgreSQL\18\bin;$env:PATH"
$env:PSYCOPG_IMPL = "python"
python -m backend.app
```

Keep this terminal running.

The Vite development server proxies `/api` requests to `http://127.0.0.1:5000`. This keeps browser requests same-origin and allows Flask session cookies to work without a CORS configuration.

## 4. Included functionality

### Public
- Student registration using the backend's public registration endpoint
- Login
- Session restoration using `/api/auth/me`
- CSRF token retrieval and inclusion on state-changing requests

### Student
- Dashboard and appeal counts
- Submit appeal
- Optional PDF/PNG/JPG upload after appeal creation
- List appeals
- View appeal details, status and event history
- Upload more documents
- Download attachments
- View profile

### Reviewer
- Assigned appeal list
- View assigned appeal details and attachments
- Start review, approve or reject
- Send remarks
- Send the appeal version with a decision so backend concurrency checks remain active

### Admin
- Dashboard
- List all appeals
- Assign active reviewers to appeals
- Create user accounts (student, reviewer or admin)
- Update account status
- View departments and appeal categories

## 5. API contract used

The frontend uses only endpoints present in the supplied backend:

- `GET /api/meta/departments`
- `GET /api/meta/categories`
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/csrf`
- `POST /api/auth/logout`
- `GET /api/student/profile`
- `GET /api/student/appeals`
- `POST /api/student/appeals`
- `GET /api/student/appeals/<id>`
- `POST /api/student/appeals/<id>/attachments`
- `GET /api/student/attachments/<id>`
- `GET /api/reviewer/assignments`
- `GET /api/reviewer/appeals/<id>`
- `POST /api/reviewer/appeals/<id>/decision`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/<id>/status`
- `GET /api/admin/departments`
- `GET /api/admin/categories`
- `GET /api/admin/appeals`
- `POST /api/admin/appeals/<id>/assignments`
- `PATCH /api/admin/assignments/<id>/unassign`
- `GET /api/appeals/<id>/events`
- `GET /api/appeals/attachments/<id>/download`

## 6. Important backend limitations

The supplied backend exposes read-only department/category endpoints. This frontend therefore displays those records but does not pretend to create or edit them.

The supplied backend does not expose an admin endpoint to list active assignments for each appeal or to unassign from the UI. Reviewer assignment creation is implemented; assignment unassignment is not currently surfaced in the frontend.

The backend's student attachment route returns a download endpoint at `/api/student/attachments/<id>`, while the shared authenticated download endpoint is `/api/appeals/attachments/<id>/download`. The frontend uses the shared endpoint for downloads.

## 7. Test flow

1. Start Flask.
2. Start Vite.
3. Register a student using an existing department.
4. Sign in as the student and submit a test appeal.
5. Sign out.
6. Sign in as an admin and assign an active reviewer to that appeal.
7. Sign out.
8. Sign in as that reviewer and start review, then approve or reject.
9. Sign in as the student and check the appeal status/history.

Use test accounts and test records while validating. Do not expose `.env` or passwords.

## 8. Production note

The Vite proxy is for local development. For production, serve the built frontend and Flask API behind the same HTTPS origin (or configure a deliberate secure cross-origin cookie/CORS setup). Set a strong `SECRET_KEY`, enable secure cookies under HTTPS, and review upload limits and server logging before deployment.
