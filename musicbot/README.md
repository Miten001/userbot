# 🎵 VVIP MUSIC BOT — Telegram Group Voice Chat Me Gaane Bajaao

## ✅ Sab credentials already filled in `.env`!

| Cheez | Status |
|---|---|
| Bot | @VVIP_MUSIC_BOTT |
| API_ID / API_HASH | ✅ filled |
| BOT_TOKEN | ✅ filled |
| SESSION_STRING (assistant) | ✅ filled |
| OWNER_ID | ✅ `7219765958` |

---

## 🪟 WINDOWS PE 3 STEPS ME CHALAO

### Step 1: Python install karo (agar nahi hai)
- https://www.python.org/downloads/ se Python download karo
- Install karte waqt **"Add Python to PATH"** wale checkbox pe TICK zaroor lagana!
- Install ho jaye to CMD me `python --version` chala ke check kar — `Python 3.11.x` ya 3.12 aana chahiye.

### Step 2: FFmpeg install karo (GAANA BAJANE KE LIYE ZAROORI HAI)
Iske bina audio play nahi hoga:
1. Ye link se zip download karo: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
2. Zip extract karo, andar `bin` folder hoga usme `ffmpeg.exe` hoga
3. `ffmpeg.exe` ko **is `musicbot` wale folder me hi copy kar do** (sabse aasan tareeka)

Ya phir `bin` folder ka path system PATH variable me add kar lo.

Check karo: is folder me CMD khol ke `ffmpeg -version` chalo, version dikhni chahiye.

### Step 3: Dependencies install + bot chalao
1. `install.bat` pe **double-click karo** — saari Python libraries auto install ho jayengi.
2. Install ho jaye to `start.bat` pe **double-click karo** — bot chalu ho jayega!

Terminal me aayega:
```
✅ VVIP MUSIC BOT live: @VVIP_MUSIC_BOTT (id=...)
```

---

## 🎯 BOT TEST KAISE KARO

1. Apne personal Telegram account se **@VVIP_MUSIC_BOTT** ko search karo, `/start` bhejo.
2. Ek test group banao.
3. Group me **dono** ko add karo:
   - @VVIP_MUSIC_BOTT (bot)
   - @VVIP_MUSIC_BOTT ka assistant (jo naya account banaya tha `+916354314143` uska naam "VVIP MUSIC" hoga — usko bhi add karo)
4. Bot ko **admin banao** (Manage Voice Chats permission on ho).
5. Group me **Voice Chat start karo** (headphone icon dabao).
6. Group me type karo:
   ```
   /play tum hi ho
   ```
7. 2-3 second me song dhoondh ke chalu ho jayega! Assistant voice chat me aa jayega 🎶

---

## 📱 COMMANDS (Group Me)

| Command | Kaam |
|---|---|
| `/play <naam ya yt link>` | Song chalao / queue me add |
| `/skip` | Agla song |
| `/pause` | Pause |
| `/resume` | Resume |
| `/stop` | Band karo + queue saaf |
| `/queue` | List dikhao |
| `/loop` | Current song on repeat (owner only) |
| `/leave` | Bot ko VC se nikaalo (owner) |
| `/restart` | Bot restart (owner) |

Inline buttons bhi aate hain message pe — play/pause/skip/stop woh bhi kaam karte hain.

---

## 🌐 24×7 KE LIYE DEPLOY KAHAN KARO

Apne PC pe chalaoge to PC off hote hi bot band ho jayega. Permanent chalaane ke liye:

### Option A: RENDER.COM (FREE, but idle 15 min me)
- GitHub pe is musicbot folder ko repo bana ke push karo
- render.com → New Web Service → GitHub repo select
- Runtime: Python
- Build Command: `bash render_build.sh`
- Start Command: `python main.py`
- Environment variables: `.env` ke saare variables daal do
- Deploy dabao

⚠️ Free tier har 15 min ke idle pe bot band kar deta hai. Music bot ke liye utna acha nahi.

### Option B: VPS (BEST — 24×7 chalta hai, ~₹200/mahine)
Contabo (€3/mo), Hostinger VPS (₹249/mo), DigitalOcean ($4/mo), Oracle Cloud (FREE forever). Ubuntu VPS pe:

```bash
ssh root@<VPS-IP>
sudo apt update && sudo apt install python3-pip ffmpeg git screen -y
git clone https://github.com/Miten001/userbot.git
cd userbot/musicbot
pip3 install -r requirements.txt
# .env already uploaded hai ya scp se upload karo
screen -S musicbot
python3 main.py
# Ctrl+A then D  ->  detach karne ke liye (SSH close kar ke bhi chalta rahega)
# wapas aane ke liye: screen -r musicbot
```

Auto-start on reboot ke liye systemd service banao (README pura padho).

### Option C: HEROKU / KOYEB / RAILWAY
Dokku/docker support hai, Dockerfile bhi diya hua hai. Koyeb free tier me better chalta hai Render se.

---

## ❓ TROUBLESHOOTING

- **"No active group call"** → Pehle group me voice chat manually start karo.
- **Assistant nahi ja pa raha VC me** → Assistant account ko group me add karo (admin mat banao par member bana lo).
- **Bot command nahi sun raha** → Bot ko group me admin banao.
- **Session invalid / auth key error** → Session expire ho gaya, naya session string generate karo (gen.py chalao).
- **ffmpeg error** → ffmpeg install hai ki nahi check karo (`ffmpeg -version`).
- **tgcrypto build fail** → Chinta nahi, bot bina tgcrypto ke bhi chalta hai (thoda slow). Ya Visual Studio Build Tools install karo.

---

## ⚠️ IMPORTANT YAAD RAKHNA

- Assistant account (+916354314143) ka Telegram app **hamesha logged-in** rakhna. Agar dusra phone me login kiya to session expire ho jayega, naya string banana padega.
- SESSION_STRING kisi se share mat kar.
- Bot token bhi mat share kar.
