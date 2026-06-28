# Video Archiver — Design Spec

**Date:** 2026-06-28  
**Status:** Specced — not yet planned or built  
**Scope:** Side project, integrates with medialog but runs on Raspberry Pi

---

## Problem

Informational YouTube videos get deleted or made private. By the time you want to rewatch something you saved months ago, it's gone. Downloading everything locally isn't feasible (storage). A selective, on-demand archive triggered from medialog solves this.

---

## Solution

A lightweight HTTP API running on a Raspberry Pi. When you click "Archive video" on a YouTube entry in medialog, it calls the Pi API, which downloads the video with yt-dlp, uploads it to Cloudflare R2, deletes the local copy, and returns the R2 URL. Medialog stores the URL and shows a local player for that entry.

The Pi is a transit buffer only — it never holds more than one video at a time.

---

## Architecture

```
medialog (browser)
  → POST /archive { url } → Pi API (local network via Tailscale)
    → yt-dlp download to /tmp/
    → rclone upload to R2
    → delete /tmp/ file
    → return { r2_url, title, duration, filesize }
  → medialog stores r2_url on entry
  → entry card shows video player / R2 link
```

---

## Components

### 1. Pi API (`~/videoarchiver/`)

Simple Python HTTP server (FastAPI or plain http.server).

**Endpoint:** `POST /archive`
```json
{ "url": "https://youtube.com/watch?v=..." }
```

**Response:**
```json
{
  "r2_url": "https://pub-xxx.r2.dev/videos/abc123.mp4",
  "title": "How Attention Mechanisms Work",
  "duration": 1842,
  "filesize_mb": 312
}
```

**Process:**
1. Validate URL is a YouTube URL
2. Run `yt-dlp -f "bestvideo[height<=1080]+bestaudio/best[height<=1080]" --merge-output-format mp4 -o /tmp/%(id)s.%(ext)s <url>`
3. Upload to R2 via `rclone copy /tmp/<file> r2:medialog-videos/`
4. Delete `/tmp/<file>`
5. Return metadata

**Auth:** simple bearer token in `Authorization` header — hardcoded secret shared between medialog and the Pi. Not exposed to the public internet (Tailscale only).

**Error handling:**
- yt-dlp fails (video deleted, private, age-gated) → return `{ error: "unavailable", message: "..." }`
- Upload fails → cleanup tmp file, return error
- Disk full during download → return error before starting

### 2. Cloudflare R2 Bucket

- Bucket name: `medialog-videos`
- Public access enabled (for streaming)
- No lifecycle rules — manual cleanup if needed
- rclone config: `rclone config` → `r2` remote → Cloudflare credentials

### 3. Tailscale

Exposes the Pi API on a stable `100.x.x.x` address accessible from any device on your Tailnet (laptop, phone, etc.) without port forwarding or exposing to the public internet.

Pi API listens on `0.0.0.0:8765`. Accessible as `http://100.x.x.x:8765` from any Tailscale device.

### 4. medialog integration

**DB:** `alter table entries add column if not exists video_url text;`

**UI:** On entries where `url` contains `youtube.com` or `youtu.be`:
- Show "Archive video" button (download icon) in secondary card actions
- While archiving: button shows spinner, disabled
- On success: button replaced by "Watch archived ↗" link to R2 URL
- On error: show toast with error message

**API call from medialog:**
```js
// src/lib/videoArchiver.js
export async function archiveVideo(youtubeUrl, piBaseUrl, token) {
  const res = await fetch(`${piBaseUrl}/archive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ url: youtubeUrl }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

**Config:** `piBaseUrl` and `token` stored in `user_configs` table (same pattern as GitHub token), editable in Settings.

---

## Storage Estimates

| Videos/month | Avg size | Monthly storage | R2 cost |
|---|---|---|---|
| 10 | 400MB | 4GB | Free tier |
| 50 | 400MB | 20GB | ~$0.15/mo |
| 200 | 400MB | 80GB | ~$0.90/mo |

R2 pricing: $0.015/GB/month after 10GB free. Egress to browser is free (R2 has no egress fees).

---

## Pi Setup (one-time)

```bash
# Install dependencies
sudo apt install python3-pip rclone
pip3 install fastapi uvicorn yt-dlp

# Configure rclone for R2
rclone config  # create "r2" remote with Cloudflare credentials

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Run API (add to crontab @reboot or systemd)
cd ~/videoarchiver && uvicorn main:app --host 0.0.0.0 --port 8765
```

---

## Out of Scope (this version)

- Instagram, Twitter, TikTok (YouTube only for now)
- Video transcription / transcript sync
- Automatic archiving (manual trigger only)
- Storage cleanup UI
- Multiple quality options (defaults to best ≤1080p)
- Progress streaming (long videos will just spin until done)

---

## Files to Build

| File | Where |
|------|-------|
| `~/videoarchiver/main.py` | Raspberry Pi |
| `~/videoarchiver/requirements.txt` | Raspberry Pi |
| `~/videoarchiver/README.md` | Raspberry Pi |
| `supabase/migrations/0038_video_url.sql` | medialog |
| `src/lib/videoArchiver.js` | medialog |
| `src/components/EntryCard.jsx` (modify) | medialog — add archive button |
| `src/components/SettingsView.jsx` (modify) | medialog — Pi URL + token config |

---

## Open Questions

- Should archived videos show an inline `<video>` player in the entry card, or just a link to R2?
- Should the Pi URL be per-user in `user_configs` or hardcoded in `.env`? (Per-user is cleaner for the existing pattern.)
- yt-dlp can take 2–10 minutes for long videos — should the API be async (return a job ID, poll for completion) or just block until done?
