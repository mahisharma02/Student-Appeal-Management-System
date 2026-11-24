# Student Appeal Management System

A full-stack web application designed to simplify and digitize the student appeal management process. The platform provides separate functionalities for students, administrators, and reviewers, enabling structured appeal submission, reviewer assignment, decision-making, and status tracking.

## Overview

The Student Appeal Management System replaces a manual appeal-handling process with a centralized web-based platform. It allows students to submit appeals and monitor their progress, administrators to manage appeals and assign reviewers, and reviewers to evaluate assigned cases and record decisions.

The application uses a React frontend, Node.js and Express backend, and PostgreSQL database.

## Key Features

### Student Module
- Student registration and login.
- Submit new appeals.
- Upload supporting documents and attachments.
- View submitted appeals.
- Track appeal status and progress.

### Administrator Module
- View and manage student appeals.
- Assign appeals to reviewers.
- Unassign active reviewer assignments.
- Monitor appeal progress.

### Reviewer Module
- View assigned appeals.
- Start the review process.
- Approve or reject appeals.
- Add remarks while recording decisions.

### System Features
- Session-based authentication.
- Role-based access control.
- REST API architecture.
- PostgreSQL database integration.
- Input validation and error handling.
- Transaction-based database operations.
- Appeal event history for tracking important actions.
- File upload handling for supporting documents.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, JavaScript, CSS |
| Frontend Development Server | Vite |
| Backend | Node.js |
| Backend Framework | Express.js |
| Database | PostgreSQL |
| Database Client | node-postgres (`pg`) |
| Authentication | Express Session |
| Session Storage | PostgreSQL using connect-pg-simple |
| API Communication | Fetch API, REST APIs |

## System Architecture

The application follows a client-server architecture.

1. The React frontend provides the user interface.
2. The frontend communicates with the backend through REST API requests.
3. The Express backend handles routing, validation, authentication, authorization, and business logic.
4. The backend interacts with PostgreSQL to store and retrieve application data.
5. The backend returns JSON responses to the frontend.

## Project Structure

```text
student-appeal-management-system/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api.js
│   │   └── auth.js
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   └── uploads/
│   ├── package.json
│   └── .env.example
│
├── .gitignore
└── README.md
```

*Note: Adjust this structure to match the actual folders and files in your repository.*

## Getting Started

### Prerequisites

Make sure you have installed:

- Node.js and npm
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd student-appeal-management-system
```

### 2. Configure the backend

Navigate to the backend directory:

```bash
cd backend
npm install
```

Create a `.env` file using `.env.example` as a reference.

Configure the following environment variables with your local database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=student_appeal_db
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password

SECRET_KEY=replace_with_a_secure_random_secret
NODE_ENV=development
```

Make sure the PostgreSQL database and the required application tables are created before starting the backend.

Start the backend:

```bash
npm run dev
```

The backend development server runs on:

```text
http://localhost:5000
```

### 3. Configure the frontend

Open another terminal and navigate to the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

The frontend development server runs on:

```text
http://localhost:5173
```

The Vite development proxy forwards `/api` requests to the backend.

## API Communication

The frontend communicates with the backend through REST APIs using HTTP methods such as:

- GET — Retrieve information.
- POST — Submit information or perform an action.
- PATCH — Update existing information.

The backend returns JSON responses to the frontend.

## Security Considerations

- Passwords are stored as password hashes rather than plaintext.
- Role-based authorization restricts access to protected operations.
- Session cookies are configured with security-related options.
- SQL queries use parameterized values.
- Sensitive configuration values are stored in environment variables.
- File uploads are subject to extension and size validation.

## Future Improvements

- Automated unit and integration testing.
- Enhanced file-content validation and malware scanning.
- Email notifications for appeal status updates.
- Improved analytics and reporting dashboards.
- Production deployment and monitoring.
- Stronger audit-history protection and security testing.

## Author

Developed as a full-stack web development project.

## License

This project is intended for educational and demonstration purposes. Add an appropriate open-source license if you intend to distribute it publicly.
