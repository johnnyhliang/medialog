/**
 * GitHub API Client using the Git Data API for atomic commits.
 */

const GITHUB_API = 'https://api.github.com'

export async function ensureRepo(token, repoName, isPrivate = true) {
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  // Check if repo exists
  const res = await fetch(`${GITHUB_API}/user/repos`, { headers })
  const repos = await res.json()
  const existing = repos.find((r) => r.name === repoName)

  if (existing) return existing

  // Create repo
  const createRes = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repoName,
      private: isPrivate,
      auto_init: true, // Crucial for Git Data API to work on a new repo
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.json()
    throw new Error(err.message || 'Failed to create repository')
  }

  return await createRes.json()
}

export async function pushFiles(token, githubUser, repoName, files) {
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }

  // 1. Get the latest commit SHA of the main branch
  const branchRes = await fetch(`${GITHUB_API}/repos/${githubUser}/${repoName}/branches/main`, { headers })
  if (!branchRes.ok) throw new Error('Could not find main branch')
  const branchData = await branchRes.json()
  const baseTreeSha = branchData.commit.commit.tree.sha
  const parentCommitSha = branchData.commit.sha

  // 2. Create Blobs for each file
  const blobPromises = files.map(async (file) => {
    const res = await fetch(`${GITHUB_API}/repos/${githubUser}/${repoName}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: file.content,
        encoding: 'utf-8',
      }),
    })
    const data = await res.json()
    return { path: file.path, sha: data.sha, mode: '100644', type: 'blob' }
  })
  const treeItems = await Promise.all(blobPromises)

  // 3. Create a new Tree
  const treeRes = await fetch(`${GITHUB_API}/repos/${githubUser}/${repoName}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  })
  const treeData = await treeRes.json()

  // 4. Create a Commit
  const commitRes = await fetch(`${GITHUB_API}/repos/${githubUser}/${repoName}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: `MediaLog Backup: ${new Date().toISOString()}`,
      tree: treeData.sha,
      parents: [parentCommitSha],
    }),
  })
  const commitData = await commitRes.json()

  // 5. Update Ref
  const refRes = await fetch(`${GITHUB_API}/repos/${githubUser}/${repoName}/git/refs/heads/main`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      sha: commitData.sha,
      force: false,
    }),
  })

  if (!refRes.ok) throw new Error('Failed to update branch reference')

  return commitData.sha
}

/**
 * Fetches the entire directory structure and file contents for restore.
 */
export async function fetchRepoContent(token, githubUser, repoName) {
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
  }

  // Get the tree recursively
  const branchRes = await fetch(`${GITHUB_API}/repos/${githubUser}/${repoName}/branches/main`, { headers })
  const branchData = await branchRes.json()
  const treeSha = branchData.commit.commit.tree.sha

  const treeRes = await fetch(`${GITHUB_API}/repos/${githubUser}/${repoName}/git/trees/${treeSha}?recursive=1`, { headers })
  const treeData = await treeRes.json()

  // Filter for markdown files and fetch their content
  const files = []
  for (const item of treeData.tree) {
    if (item.type === 'blob' && item.path.endsWith('.md')) {
      const blobRes = await fetch(item.url, { headers })
      const blobData = await blobRes.json()
      // GitHub blobs are base64 encoded
      const content = atob(blobData.content.replace(/\n/g, ''))
      files.push({ path: item.path, content })
    }
  }

  return files
}
