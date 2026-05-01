# 🏏 IPL Auction 2025 — Multiplayer

A feature-complete, internet multiplayer IPL auction game built with React + TypeScript + Firebase Realtime Database.

## ✨ Features

- 🌐 **Internet Multiplayer** via Firebase Realtime Database
- 🏏 **500+ Real Players** — 400 Indians + 100 Overseas
- 🤖 **AI Teams** — fill remaining slots with smart AI bidders (3 strategies)
- ⚡ **Rapid Round** — all unsold players go to a timed rapid auction
- 📋 **Squad Rules** — Max 25, 8 Overseas cap, role minimums enforced
- 🔨 **Auction Hammer** sound + crowd reactions (Web Audio API)
- 👁️ **Spectator Mode** — watch without participating
- 🏆 **Scoreboard** — ranked by squad quality + efficiency
- 📊 **Team Drawer** — view any team's squad, purse, stats

---

## 🚀 Quick Start (Local)

```bash
git clone https://github.com/berasankhadeep20-lang/IPL_Auction_Multiplayer_Internet
cd IPL_Auction_Multiplayer_Internet
npm install
cp .env.example .env
# Fill in .env with your Firebase credentials
npm run dev
```

---

## 🔥 Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Realtime Database** (choose a region)
4. Enable **Authentication → Anonymous** sign-in
5. Copy your config into `.env`
6. Upload `database.rules.json` to your Realtime Database rules

---

## 🚢 GitHub Pages Deploy

1. Push to your GitHub repo
2. Go to **Settings → Secrets and variables → Actions**
3. Add all 7 Firebase secrets (see `.env.example`)
4. Go to **Settings → Pages → Source → GitHub Actions**
5. Push to `main` → auto-deploys!

Live at: `https://berasankhadeep20-lang.github.io/IPL_Auction_Multiplayer_Internet/`

---

## 🎮 How to Play

1. **Create Room** → share the 6-letter room code
2. **Select Team** — up to 10 humans, rest AI
3. Host clicks **START AUCTION**
4. Bid on players using incremental bid buttons
5. **Rapid Round** starts automatically after main auction
6. **Scoreboard** shown at end

---

## 🗂 Project Structure

```
src/
├── components/
│   ├── Landing.tsx       ← Home screen
│   ├── Lobby.tsx         ← Team selection
│   ├── AuctionScreen.tsx ← Main auction UI
│   ├── PlayerCard.tsx    ← Player info card
│   ├── TeamDrawer.tsx    ← Squad viewer
│   └── Scoreboard.tsx    ← Final results
├── data/
│   ├── players.ts        ← 500+ player database
│   └── teams.ts          ← 10 IPL teams + logos
├── firebase/
│   └── config.ts         ← Firebase init
├── hooks/
│   └── useGameRoom.ts    ← Multiplayer engine
├── store/
│   └── useGameStore.ts   ← Zustand global state
├── types/
│   └── index.ts          ← TypeScript interfaces
└── utils/
    ├── aiPlayer.ts       ← AI bidding logic
    ├── sounds.ts         ← Web Audio sounds
    └── squadRules.ts     ← Squad validation
```
Made by Sankhadeep