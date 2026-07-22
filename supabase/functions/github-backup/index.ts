import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// This function exists for exactly one reason: the GitHub access token is
// encrypted at rest and must never reach the browser. It therefore owns the
// GitHub API calls and nothing else.
//
// Deciding WHAT to back up, rendering it, and reading it back is the client's
// job (src/lib/githubSync.js) — it is pure, unit-tested, and shares no logic
// with this file, so the two can never drift out of sync.
//
// Actions:
//   repos  → list the repos this token can push to (for the repo picker)
//   commit → { files, message } committed as one commit; creates the repo if needed
//   fetch  → every file in the repo, for a restore

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, files, message, repo: repoOverride } = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: config } = await supabase
      .from('user_configs')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!config?.github_token) throw new Error('GitHub not connected')

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not configured')
    const token = await decrypt(config.github_token, encryptionKey)

    const owner = config.github_user
    const repo = repoOverride || config.repo_name
    const branch = config.repo_branch || 'main'

    if (action === 'repos') {
      return json({ repos: await listRepos(token) })
    }

    if (action === 'commit') {
      if (!Array.isArray(files) || !files.length) throw new Error('No files to commit')
      const result = await commitFiles(token, owner, repo, branch, files, {
        message: message || 'MediaLog backup',
        isPrivate: config.is_private !== false,
      })
      await supabase
        .from('user_configs')
        .update({ last_backup_at: new Date().toISOString(), last_error: null })
        .eq('user_id', user.id)
      return json({ success: true, ...result })
    }

    if (action === 'fetch') {
      return json({ files: await fetchRepoFiles(token, owner, repo, branch) })
    }

    throw new Error(`Unknown action: ${action}`)
  } catch (error) {
    return json({ error: (error as Error).message }, 400)
  }
})

async function decrypt(encryptedBase64: string, keyStr: string) {
  const raw = new TextEncoder().encode(keyStr)
  const keyBytes = new Uint8Array(32)
  keyBytes.set(raw.slice(0, 32))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
  const combined = new Uint8Array(atob(encryptedBase64).split('').map((c) => c.charCodeAt(0)))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, 12) },
    key,
    combined.slice(12),
  )
  return new TextDecoder().decode(decrypted)
}

const gh = (token: string) => ({
  Authorization: `token ${token}`,
  Accept: 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
})

async function ghFetch(url: string, token: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: gh(token) })
  if (!res.ok) {
    const body = await res.text()
    let msg = body.slice(0, 300)
    try { msg = JSON.parse(body).message ?? msg } catch { /* keep raw */ }
    throw new Error(`GitHub ${res.status}: ${msg}`)
  }
  return res.json()
}

async function listRepos(token: string) {
  const out: any[] = []
  for (let page = 1; page <= 4; page++) {
    const batch = await ghFetch(
      `https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner&page=${page}`,
      token,
    )
    out.push(...batch)
    if (batch.length < 100) break
  }
  return out.map((r) => ({
    name: r.name,
    full_name: r.full_name,
    private: r.private,
    default_branch: r.default_branch,
    updated_at: r.updated_at,
  }))
}

async function ensureRepo(token: string, owner: string, repo: string, isPrivate: boolean) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: gh(token) })
  if (res.ok) return await res.json()
  if (res.status !== 404) throw new Error(`GitHub ${res.status}: could not read ${owner}/${repo}`)

  const created = await ghFetch('https://api.github.com/user/repos', token, {
    method: 'POST',
    body: JSON.stringify({
      name: repo,
      private: isPrivate,
      auto_init: true,
      description: 'MediaLog backup — notes, topics and metadata',
    }),
  })
  // auto_init commits asynchronously; the ref is not queryable immediately.
  await new Promise((r) => setTimeout(r, 2500))
  return created
}

async function commitFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: { path: string; content: string }[],
  { message, isPrivate }: { message: string; isPrivate: boolean },
) {
  const repoData = await ensureRepo(token, owner, repo, isPrivate)
  const targetBranch = branch || repoData.default_branch || 'main'

  const ref = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${targetBranch}`,
    token,
  )
  const parentSha = ref.object.sha
  const parentCommit = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits/${parentSha}`,
    token,
  )

  // Only upload what actually changed. A full library is ~1400 files, and one
  // blob POST each would burn a quarter of the 5000/hour API budget per backup
  // — the background auto-backup would exhaust it in an afternoon. Git blob
  // shas are content-addressed, so computing them locally tells us exactly
  // which files GitHub already has.
  const existing = await listTreeShas(token, owner, repo, parentCommit.tree.sha)
  const tree = []
  let uploaded = 0

  for (const f of files) {
    const sha = await gitBlobSha(f.content)
    if (existing.get(f.path) === sha) continue // unchanged; base_tree keeps it
    const blob = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, token, {
      method: 'POST',
      body: JSON.stringify({ content: f.content, encoding: 'utf-8' }),
    })
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha })
    uploaded++
  }

  // Entries deleted since the last backup must disappear from the repo too,
  // or the mirror keeps resurrecting notes the user removed.
  const current = new Set(files.map((f) => f.path))
  for (const path of existing.keys()) {
    if (!current.has(path) && (path.startsWith('data/') || path.startsWith('notes/'))) {
      tree.push({ path, mode: '100644', type: 'blob', sha: null })
    }
  }

  if (!tree.length) {
    return { sha: parentSha, branch: targetBranch, unchanged: true, fileCount: files.length, uploaded: 0 }
  }

  const newTree = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree }),
  })

  // Belt and braces: if the resulting tree is identical anyway, don't commit.
  if (newTree.sha === parentCommit.tree.sha) {
    return { sha: parentSha, branch: targetBranch, unchanged: true, fileCount: files.length, uploaded }
  }

  const commit = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] }),
  })

  await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${targetBranch}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  })

  return { sha: commit.sha, branch: targetBranch, unchanged: false, fileCount: files.length, uploaded }
}

// A git blob sha is sha1("blob <bytelength> " + content) — the same value
// GitHub reports, so it can be compared without asking GitHub for anything.
async function gitBlobSha(content: string) {
  const body = new TextEncoder().encode(content)
  const header = new TextEncoder().encode(`blob ${body.length} `)
  const buf = new Uint8Array(header.length + body.length)
  buf.set(header)
  buf.set(body, header.length)
  const digest = await crypto.subtle.digest('SHA-1', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function listTreeShas(token: string, owner: string, repo: string, treeSha: string) {
  const map = new Map<string, string>()
  const tree = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
    token,
  )
  for (const item of tree.tree ?? []) {
    if (item.type === 'blob') map.set(item.path, item.sha)
  }
  return map
}

async function fetchRepoFiles(token: string, owner: string, repo: string, branch: string) {
  const ref = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch || 'main'}`,
    token,
  )
  const commit = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits/${ref.object.sha}`,
    token,
  )
  const tree = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${commit.tree.sha}?recursive=1`,
    token,
  )

  // Only data/ is needed to restore; pulling every note blob would be hundreds
  // of extra API calls for files the restore ignores.
  const wanted = tree.tree.filter(
    (i: any) => i.type === 'blob' && i.path.startsWith('data/') && i.path.endsWith('.json'),
  )

  const files = []
  for (const item of wanted) {
    const blob = await ghFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`,
      token,
    )
    const bytes = Uint8Array.from(atob(blob.content.replace(/\n/g, '')), (c) => c.charCodeAt(0))
    files.push({ path: item.path, content: new TextDecoder().decode(bytes) })
  }
  return files
}
