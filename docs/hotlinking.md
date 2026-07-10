# Hotlinking Files into MediaLog

MediaLog does not host your files. You host them somewhere, paste the **direct link**, and the app
reads from there. This keeps storage cost at zero and keeps the app out of the business of being a
file host.

Use this for: PDFs you read in a deep topic, and images you embed in notes.

---

## The one rule that decides whether it works

The in-app PDF viewer (pdf.js) **fetches the file with JavaScript**. That means the host must send
the `Access-Control-Allow-Origin` header (CORS). If it doesn't, the file can't render inline — you'll
get the **“open original ↗”** link instead, which always works.

**Check any URL in one command:**

```bash
curl -sI "https://example.com/paper.pdf" | grep -i access-control-allow-origin
```

- Prints a header → it will render inline.
- Prints nothing → use the "open original" link, or rehost it somewhere below.

Also: the link must point at the **raw file**, not a viewer page. A GitHub "blob" page, a Google Drive
share page, or a publisher's landing page are HTML, not PDFs.

---

## Where to host (free, CORS-friendly)

### 1. GitHub + jsDelivr — best for public, non-copyrighted files
Commit the file to a public repo, then serve it through jsDelivr's CDN (globally cached, CORS on):

```
https://cdn.jsdelivr.net/gh/USER/REPO@BRANCH/path/to/file.pdf
```

`raw.githubusercontent.com/USER/REPO/BRANCH/path/to/file.pdf` also sends CORS and works, but it's
rate-limited and GitHub discourages using it as a CDN. Prefer jsDelivr. Keep files reasonably small
(jsDelivr rejects very large files; GitHub warns above ~50 MB and rejects above 100 MB).

**Everything in a public repo is public.** Never put copyrighted books or anything private here.

### 2. Cloudflare Pages — best when you want your own control
If you already deploy the frontend to Pages, drop files in a `/public` folder and add a `_headers`
file so they're served with CORS:

```
/files/*
  Access-Control-Allow-Origin: *
```

Free, real CDN, and you own the URLs. Still public.

### 3. Cloudflare R2 — best when it should stay private
Free tier is ~10 GB with **zero egress fees**. Two modes:
- **Custom domain on the bucket** → public, CDN-cached, hotlinkable.
- **Presigned URLs** (S3-compatible) → the bucket stays private and you generate time-limited links.

This is the right home for anything you don't want world-readable. It's the upgrade path if
hotlinking stops being enough.

### 4. The source's own URL
Many papers and docs are already online. arXiv PDF links (`https://arxiv.org/pdf/2401.12345`) and
most personal blogs work fine as a link; whether they render *inline* depends on their CORS headers —
run the `curl` check. If they don't, the "open original" link still gets you there in one click.

---

## Hosts that generally do NOT work

| Host | Why |
|---|---|
| Google Drive share links | Redirects to an HTML viewer page; no CORS on the file |
| Dropbox `?dl=0` links | HTML page. `?raw=1` gets closer but CORS is unreliable |
| GitHub `blob` URLs | That's a web page, not the file — use `raw`/jsDelivr |
| Most publisher paywalls | HTML, auth-gated, no CORS |

---

## Using it in MediaLog

**A PDF resource:** Reading → **new resource** → source **PDF (link or upload)** → paste the direct
URL. It renders in the viewer, and "open original ↗" sits beneath it as the fallback.

**A book with no file:** source **Book (no file)** → optionally paste a **reference url** (a companion
page, the publisher, your own notes). You get an "open source ↗" link and take takeaways without any
file at all. This is the right choice for copyrighted books you own physically.

**An image in a note:** paste a markdown image link pointing at a hotlinked URL:

```markdown
![diagram](https://cdn.jsdelivr.net/gh/you/assets@main/diagram.png)
```

---

## Copyright and privacy — read this

Hotlinking does not launder copyright. **Do not upload copyrighted books or paywalled papers to a
public GitHub repo or Pages site.** For material you legitimately own but can't publish:

- Use the **Book (no file)** source and take takeaways against your physical/local copy, or
- Keep the file in a **private R2 bucket** and use presigned URLs.

The same applies to anything personal: a public URL is public forever, indexable, and not revocable
just because you deleted the repo.
