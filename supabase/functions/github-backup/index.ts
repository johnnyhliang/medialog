import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action } = await req.json()
    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: config, error: configError } = await supabaseClient
      .from('user_configs')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (configError || !config || !config.github_token) {
      throw new Error('GitHub not connected')
    }

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
    const accessToken = await decrypt(config.github_token, encryptionKey)

    if (action === 'push') {
      const { data: topics } = await supabaseClient.from('topics').select('*').eq('user_id', user.id)
      const { data: entries } = await supabaseClient.from('entries').select('*').eq('user_id', user.id).is('deleted_at', null)
      
      for (const entry of entries || []) {
        const { data: tags } = await supabaseClient.rpc('get_entry_tags', { p_entry_id: entry.id })
        entry.tags = tags || []
      }

      const files = buildGitHubFileMap(topics || [], entries || [])
      const sha = await pushToGitHub(accessToken, config.github_user, config.repo_name, files, config.is_private)

      await supabaseClient
        .from('user_configs')
        .update({ last_backup_at: new Date().toISOString(), last_error: null })
        .eq('user_id', user.id)

      return new Response(JSON.stringify({ success: true, sha }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'pull') {
      const files = await fetchRepoContent(accessToken, config.github_user, config.repo_name)
      let importedCount = 0
      const topicCache = {}

      for (const file of files) {
        const entry = parseEntryMarkdown(file.content)
        if (!entry) continue

        const topicName = file.path.split('/')[0]
        if (!topicCache[topicName]) {
          let { data: topic } = await supabaseClient
            .from('topics')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', topicName)
            .maybeSingle()
          
          if (!topic) {
            const { data: newTopic } = await supabaseClient
              .from('topics')
              .insert({ user_id: user.id, name: topicName })
              .select('id')
              .single()
            topic = newTopic
          }
          topicCache[topicName] = topic.id
        }

        const { data: newEntry } = await supabaseClient
          .from('entries')
          .insert({
            user_id: user.id,
            topic_id: topicCache[topicName],
            title: entry.title,
            url: entry.url,
            note: entry.note,
            status: entry.status,
            created_at: entry.created_at,
            pinned: entry.pinned || false
          })
          .select('id')
          .single()

        if (newEntry && entry.tags) {
          for (const tagName of entry.tags) {
            let { data: tag } = await supabaseClient
              .from('tags')
              .select('id')
              .eq('user_id', user.id)
              .eq('name', tagName)
              .maybeSingle()
            
            if (!tag) {
              const { data: newTag } = await supabaseClient
                .from('tags')
                .insert({ user_id: user.id, name: tagName })
                .select('id')
                .single()
              tag = newTag
            }

            await supabaseClient
              .from('entry_tags')
              .insert({ entry_id: newEntry.id, tag_id: tag.id })
              .maybeSingle()
          }
        }
        importedCount++
      }

      return new Response(JSON.stringify({ success: true, count: importedCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid action')
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function decrypt(encryptedBase64: string, keyStr: string) {
  const enc = new TextEncoder()
  const keyBuffer = await crypto.subtle.importKey('raw', enc.encode(keyStr), { name: 'AES-GCM' }, false, ['decrypt'])
  const combined = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12); const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyBuffer, data)
  return new TextDecoder().decode(decrypted)
}

async function pushToGitHub(token: string, user: string, repo: string, files: any[], isPrivate: boolean) {
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  
  // Check if repo exists, create if not
  const checkRes = await fetch(`https://api.github.com/repos/${user}/${repo}`, { headers })
  if (checkRes.status === 404) {
    const createRes = await fetch(`https://api.github.com/user/repos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: repo, private: isPrivate, auto_init: true })
    })
    if (!createRes.ok) {
      const err = await createRes.json()
      throw new Error(`Failed to create repo: ${err.message}`)
    }
    // Wait a moment for GitHub to initialize the repo
    await new Promise(r => setTimeout(r, 2000))
  }

  const branchRes = await fetch(`https://api.github.com/repos/${user}/${repo}/branches/main`, { headers })
  if (!branchRes.ok) throw new Error('Could not find main branch. Make sure the repo is initialized.')
  const branchData = await branchRes.json()
  const baseTreeSha = branchData.commit.commit.tree.sha
  const parentSha = branchData.commit.sha

  const tree = files.map(f => ({ path: f.path, mode: '100644', type: 'blob', content: f.content }))
  
  const treeRes = await fetch(`https://api.github.com/repos/${user}/${repo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree })
  })
  const treeData = await treeRes.json()

  const commitRes = await fetch(`https://api.github.com/repos/${user}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: 'MediaLog Sync', tree: treeData.sha, parents: [parentSha] })
  })
  const commitData = await commitRes.json()

  await fetch(`https://api.github.com/repos/${user}/${repo}/git/refs/heads/main`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: commitData.sha })
  })

  return commitData.sha
}

async function fetchRepoContent(token: string, user: string, repo: string) {
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  const branchRes = await fetch(`https://api.github.com/repos/${user}/${repo}/branches/main`, { headers })
  if (!branchRes.ok) throw new Error('Repo not found or empty')
  const branchData = await branchRes.json()
  const treeSha = branchData.commit.commit.tree.sha
  const treeRes = await fetch(`https://api.github.com/repos/${user}/${repo}/git/trees/${treeSha}?recursive=1`, { headers })
  const treeData = await treeRes.json()
  const files = []
  for (const item of treeData.tree) {
    if (item.type === 'blob' && item.path.endsWith('.md')) {
      const blobRes = await fetch(item.url, { headers })
      const blobData = await blobRes.json()
      const content = atob(blobData.content.replace(/\n/g, ''))
      files.push({ path: item.path, content: new TextDecoder().decode(new Uint8Array([...content].map(c => c.charCodeAt(0)))) })
    }
  }
  return files
}

function parseEntryMarkdown(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return null
  const [, yaml, body] = match
  const metadata: any = {}
  yaml.split('\n').forEach(line => {
    const [key, ...vals] = line.split(':')
    if (!key || !vals.length) return
    const val = vals.join(':').trim()
    try { metadata[key.trim()] = JSON.parse(val) } catch { metadata[key.trim()] = val }
  })
  return { ...metadata, note: body.trim() }
}

function buildGitHubFileMap(topics: any[], entries: any[]) {
  const files: any[] = []
  for (const topic of topics) {
    const topicEntries = entries.filter((e) => e.topic_id === topic.id)
    const topicPath = topic.name.replace(/[\\/:*?"<>|]/g, '-').trim()
    for (const entry of topicEntries) {
      const fileName = `${(entry.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').trim()}-${entry.id.slice(0, 8)}.md`
      files.push({ path: `${topicPath}/${fileName}`, content: renderEntryMarkdown(entry) })
    }
  }
  return files
}

function renderEntryMarkdown(e: any) {
  const lines = ['---', `title: ${JSON.stringify(e.title || '')}`, `url: ${JSON.stringify(e.url || '')}`, `status: ${e.status || 'backlog'}`]
  if (e.tags && e.tags.length) lines.push(`tags: [${e.tags.map((t: any) => JSON.stringify(t)).join(', ')}]`)
  lines.push(`created_at: ${JSON.stringify(e.created_at)}`)
  if (e.pinned) lines.push('pinned: true')
  lines.push('---', '', e.note || '')
  return lines.join('\n')
}
