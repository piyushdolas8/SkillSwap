# 🌐 SkillSwap | The Decentralized Skill Economy

### AI-Powered P2P Knowledge Exchange Platform

**SkillSwap** is a futuristic peer-to-peer (P2P) knowledge exchange platform that replaces traditional tuition with a reciprocal learning economy. Learners trade what they know for what they need using **SkillTokens**, powered by **Gemini AI** matchmaking and a **Supabase** backend.

---

## 🚀 Features

- **🤖 AI Matchmaking** – Gemini analyzes Expert IDs to create optimal skill swaps  
- **💰 SkillToken Economy** – Earn and spend tokens for verified teaching sessions  
- **✨ Live Sessions** – Collaborative code editor with interactive whiteboard  
- **🏆 Skill Proof** – Mint digital badges for your portfolio after every swap  
- **📊 Leaderboard** – Climb Skill Titan rankings based on teaching impact  

---

## 🛠 Tech Stack

- **Frontend:** React (ES6 Modules) + Tailwind CSS  
- **AI:** Google Gemini 3 Flash API  
- **Backend:** Supabase (Auth + PostgreSQL)  
- **Storage:** LocalStorage (Demo Mode)  
- **Design:** Glassmorphism + Neon-Glow UI  

---

## 📋 Database Schema

Execute the following in the **Supabase SQL Editor**:

```sql
-- PROFILES TABLE
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  bio text,
  created_at timestamp with time zone default now()
);

-- SKILLS TABLE
create table skills (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id),
  skill_name text,
  skill_level text,
  created_at timestamp with time zone default now()
);

-- BADGES / PORTFOLIO TABLE
create table badges (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id),
  badge_name text,
  issued_at timestamp with time zone default now()
);

-- SWAPS / INQUIRIES TABLE
create table swaps (
  id bigint generated always as identity primary key,
  requester_id uuid references profiles(id),
  provider_id uuid references profiles(id),
  skill_requested text,
  skill_offered text,
  status text,
  created_at timestamp with time zone default now()
);
```

### ⚙️ Getting Started
## 1️⃣ Clone the repository
git clone https://github.com/piyushdolas/skillswap.git
cd skillswap

## 2️⃣ Setup Supabase Project
### Create a project at https://supabase.com
### Copy the Project URL and anon public key

## 3️⃣ Environment Variables
### Add these to your environment or index.html (for browser ESM)
API_KEY=your_google_gemini_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

## 4️⃣ Run (Browser ESM – No Build Required)
### Open index.html in any modern browser
### OR use the Live Server extension in VS Code

## 5️⃣ Initialize Database
### Execute schema.sql in Supabase SQL Editor

✅ **Demo Mode Available** – Explore the full UI without authentication.

---

## 🛡️ Privacy First

- ✅ P2P streams are encrypted and never recorded  
- ✅ Transparent SkillToken transactions  
- ✅ No centralized data retention  

---

## 👨‍💻 Author

## ***Piyush Dolas***

---

© 2026 **SkillSwap Inc.**  
*Peer-Verified Excellence*

