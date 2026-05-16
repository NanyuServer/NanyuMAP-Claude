# 校园智能导航系统 (Campus Navigation System)

A production-ready campus navigation system built with Next.js 15, TypeScript, TailwindCSS, Framer Motion, Prisma ORM, and Neon PostgreSQL.

## Features

- 🗺️ **Interactive Campus Map** — Pannable, zoomable map with location pins
- 🔍 **Smart Fuzzy Search** — Search by location name, function, or description
- 🧭 **A\* Pathfinding** — Real road network navigation from North Gate or Southeast Gate
- 🛠️ **Admin Panel** — Full CRUD for locations and road network editor
- 🔐 **JWT Authentication** — Secure admin login with bcrypt + HttpOnly cookies
- 📱 **Responsive Design** — Apple-style dark UI with glassmorphism

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 App Router, TypeScript, TailwindCSS |
| Animation | Framer Motion |
| State | Zustand |
| Database | Neon PostgreSQL + Prisma ORM |
| Auth | JWT (jose) + bcryptjs |
| Algorithm | A\* Pathfinding |
| Deploy | Vercel |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@host/dbname?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key"
```

Get your Neon database connection strings from [neon.tech](https://neon.tech).

### 3. Set up database

```bash
npm run db:push      # Push schema to Neon
npm run db:seed      # Create default admin user
```

### 4. Add your campus map

Replace `public/assets/map.png` with your actual campus map image.
- Recommended: 2400 × 1600 px
- Format: PNG or JPG

### 5. Run development server

```bash
npm run dev
```

Visit:
- **Frontend Map**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
  - Default login: `admin` / `admin123456`

## Admin Panel Setup Guide

### Step 1: Add Location Points

1. Go to `/admin/locations`
2. Click "新增地点"
3. Select the location **type** (category)
4. Fill in **detailed info** (e.g., "校务办公室（行政楼二楼213）")
5. Fill in **extra info** (e.g., "校务办理、招生咨询、学生事务")
6. Click on the map to place the pin
7. Save

> The detail info and extra info fields are what gets searched when users type in the search bar.

### Step 2: Build Road Network

1. Go to `/admin/roads`
2. **Add nodes** mode: Click along the campus roads to add waypoints
3. **Connect nodes** mode: Click one node, then click another to link them
4. **Move nodes** mode: Drag nodes to adjust positions
5. **Delete** mode: Click nodes or edges to remove them

> The more detailed your road network, the more accurate the navigation paths.

### Step 3: Test Navigation

1. Visit the main map at `/`
2. Search for a location (e.g., "图书馆", "食堂", "自习室")
3. Select a result from the dropdown
4. Choose your departure point (北门 or 东南门)
5. Watch the animated A\* path render on the map

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/locations` | GET | List all locations |
| `/api/locations` | POST | Create location (auth required) |
| `/api/locations/:id` | PUT | Update location (auth required) |
| `/api/locations/:id` | DELETE | Delete location (auth required) |
| `/api/search?q=` | GET | Fuzzy search locations |
| `/api/roads` | GET | Get all nodes and edges |
| `/api/roads` | POST | Manage road network (auth required) |
| `/api/navigation` | POST | Calculate A\* path |
| `/api/auth/login` | POST | Admin login |
| `/api/auth/logout` | POST | Admin logout |
| `/api/auth/verify` | GET | Verify session |

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/yourusername/campus-nav.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project" → Import your GitHub repo
3. Add environment variables:
   - `DATABASE_URL` — Neon connection string (pooled)
   - `DIRECT_URL` — Neon connection string (direct)
   - `JWT_SECRET` — Random secret string

### 3. Build command

The `vercel.json` is already configured. Vercel will run:
```
prisma generate && next build
```

### 4. Seed the database

After first deployment, run locally:
```bash
npm run db:seed
```

Or add a one-time seed API route for production.

## Database Schema

```sql
locations      -- id, category, detail_info, extra_info, x, y, created_at
road_nodes     -- id, x, y
road_edges     -- id, from_node, to_node, distance
admin_users    -- id, username, password_hash
```

## Changing Admin Password

```bash
npx tsx -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
bcrypt.hash('YOUR_NEW_PASSWORD', 12).then(hash => {
  return prisma.adminUser.update({ where: { username: 'admin' }, data: { passwordHash: hash } });
}).then(() => { console.log('Password updated'); prisma.\$disconnect(); });
"
```

## License

MIT
