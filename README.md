# StreakUp 🔥
> A modern full-stack web application for daily tasks, consecutive-day streak tracking, timezone-aware countdowns, friends, and competitive leaderboards.

---

## 🎨 Design & Aesthetic System
Designed with a focused, premium **Warm Dark Titanium & Flame Amber** palette that avoids generic dark blue/navy and flat pitch black:
- **Canvas Base**: `#09090b` (Deep Zinc / Warm Titanium substrate)
- **Surfaces & Cards**: `#131316` / `#18181c` with subtle borders (`#27272f`)
- **Primary Streak Accent (Warm)**: Flame Amber (`#f59e0b` / `#d97706`), representing streaks, momentum, countdown urgency, and gold podium ranks.
- **Completion Accent (Success)**: Sage Emerald (`#10b981`), representing completed tasks, verified states, and active streaks.
- **Typography**: Inter for UI & JetBrains Mono for clocks, counters, and statistics.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Recharts
- **Backend**: Node.js, Express, TypeScript, Zod (validation), Luxon (timezones)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based session tokens + bcrypt password hashing
- **Testing**: Vitest automated unit test suite

---

## 📂 Project Structure

```
learning tracker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma                  # PostgreSQL models, enums & relations
│   │   ├── seed.ts                        # Realistic seed data (users, streaks, friendships)
│   │   └── migrations/0_init/migration.sql# Raw SQL DDL schema
│   ├── src/
│   │   ├── config/prisma.ts               # Prisma client singleton
│   │   ├── controllers/                   # Auth, tasks, friends, leaderboards, users
│   │   ├── middleware/                    # JWT authentication & optional auth guards
│   │   ├── routes/                        # Express API route modules
│   │   ├── services/
│   │   │   ├── streakService.ts           # Pure mathematical streak calculation engine
│   │   │   └── timezoneService.ts         # Timezone & midnight countdown logic
│   │   ├── app.ts                         # Express app setup with CORS
│   │   └── server.ts                      # Server entry point
│   ├── tests/
│   │   ├── streak.test.ts                 # Consecutive days, unticking, boundary tests
│   │   ├── auth.test.ts                   # Case-insensitive username, bcrypt, JWT tests
│   │   └── timezone.test.ts               # Midnight calculation & countdown tests
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── api/                           # Typed API clients for backend endpoints
│   │   ├── components/
│   │   │   ├── Navbar.tsx                 # Responsive nav with pending request badge
│   │   │   ├── DualClock.tsx              # Real-time local clock & reverse countdown
│   │   │   ├── TaskCard.tsx               # Interactive checkbox & task actions
│   │   │   ├── TaskModal.tsx              # Create/edit task modal
│   │   │   ├── ActivityHeatmap.tsx        # Consistency calendar heatmap
│   │   │   ├── StreakBadge.tsx            # Animated flame streak badge
│   │   │   └── LeaderboardTable.tsx       # Top 3 podium + full rankings table
│   │   ├── context/AuthContext.tsx        # Authentication state & persistent user sync
│   │   ├── pages/                         # Landing, Dashboard, Tasks, Leaderboards, etc.
│   │   ├── App.tsx                        # Router & route guards
│   │   └── index.css                      # Tailwind & custom glow utilities
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── .env.example                           # Root environment placeholder template
├── .gitignore                             # Ignored node_modules, .env, builds
└── README.md
```

---

## ⚡ Quick Start & Setup Instructions

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v24)
- **PostgreSQL Database** (e.g., local PostgreSQL, Docker, Neon.tech, Supabase, or Railway)

### 2. Configure Environment Variables
Create `.env` inside the `backend/` directory (you can copy from `backend/.env.example`):

```bash
# backend/.env
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/streakup?schema=public"
JWT_SECRET="your_secure_random_jwt_secret_key"
PORT=5000
CLIENT_URL="http://localhost:5173"
```

> **Note on Free Cloud PostgreSQL**: You can get a free instant PostgreSQL database in 30 seconds from [Neon](https://neon.tech) or [Supabase](https://supabase.com). Simply paste the connection string into `DATABASE_URL`.

### 3. Install Dependencies
Run from the root workspace directory:
```bash
# Install backend and frontend dependencies
npm run install:all
```
*(Or navigate to `backend` and `frontend` individually and run `npm install`)*

### 4. Push Database Schema & (Optional) Seed Demo Data
In the `backend/` directory:
```bash
cd backend

# Push schema directly to your PostgreSQL database
npx prisma db push

# (Optional) Seed sample users with existing streaks and friendships
npm run seed
```

### 5. Run the Automated Test Suite
Verify authentication, task completion, and streak calculation:
```bash
cd backend
npm test
```
*All 17 tests verify consecutive day tracking, unticking recalculation, deduplication, and case-insensitive username normalization.*

### 6. Start the Application
Run both backend and frontend concurrently from the root directory:
```bash
npm run dev
```
Or start each separately:
- **Backend API**: `cd backend && npm run dev` (starts on `http://localhost:5000`)
- **Frontend App**: `cd frontend && npm run dev` (starts on `http://localhost:5173`)

Open `http://localhost:5173` in your browser.

---

## 🧠 Streak Calculation Rules & Database Design

### Streak Rules Explained
1. **Definition**: A user's current streak is the number of **consecutive local calendar days** on which they completed at least one task.
2. **Timezone Awareness**: Day boundaries are evaluated against the user's configured timezone (default: `Asia/Kolkata`).
3. **No Multi-Counting**: Completing multiple tasks on the same calendar day counts as **one** streak day.
4. **Intact Day In Progress**: If a user completed yesterday's tasks, their streak remains intact while today is ongoing. Once today ends without a completion, the streak breaks tomorrow.
5. **Unticking Recalculation**: Unticking a task removes that completion. If no other completions exist for that date, streaks (both current and longest) are instantly recalculated from the true historical completion records in PostgreSQL.
6. **Historical Best Retention**: A broken streak never erases the user's `longestStreak`.

### Database Architecture Supporting Streaks
- **`User` Table**: Stores `currentStreak`, `longestStreak`, and `timezone`, with a unique `normalizedUsername` (lowercased) guaranteeing case-insensitive username uniqueness at the database level.
- **`TaskCompletion` Table**: Stores `(taskId, userId, completionDate, completedAt)`.
  - Has a compound unique constraint: `@@unique([taskId, completionDate])` preventing duplicate records for the same task on the same local date.
  - Recalculation queries distinct `completionDate` values for the user.
- **`Friendship` Table**: Enforces canonical ordering `user1Id < user2Id` with `@@unique([user1Id, user2Id])` to prevent duplicate reciprocal friendships.

---

## ⏱️ Dual Clock & Reverse Midnight Countdown
- **Clock A (Current Local Time)**: Real-time clock ticking with seconds (`HH:MM:SS AM/PM`), full date, and timezone label.
- **Clock B (Reverse Midnight Countdown)**: High-precision counter computing remaining hours, minutes, and seconds until the next local midnight (`24:00:00`).
  - Resets accurately when midnight arrives.
  - Automatically re-syncs when switching browser tabs via `visibilitychange`.
  - Includes a visual progress bar indicating the percentage of the current day elapsed.

---

## 🔐 Security & Authorization
- Passwords hashed with **bcrypt** (salt factor 10).
- JWTs signed with secret key and validated on all protected endpoints.
- User ownership strictly verified on all task updates, deletions, and toggles.
- Case-insensitive usernames prevent spoofing (`Nirmal` == `nirmal`).
- Public endpoints (Global Leaderboard & Public Profiles) scrub private task data, emails, and password hashes.
