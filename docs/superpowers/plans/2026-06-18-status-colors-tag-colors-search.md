# Status Colors, Tag Colors & Tag Search

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Card backgrounds tinted by status; tag chips show assigned background colors (set in Settings); `tag:` prefix in search bar shows a paginated tag dropdown that filters entries.

**Architecture:** Status tints are pure CSS classes on `.card`. Tag colors are stored as a `color` column on the `tags` table (Supabase migration). App.jsx loads a tag→color map and passes it to EntryCard via EntryList/TopicView. The tag: search is handled in TopicView: when the query starts with `tag:`, a dropdown replaces the normal search results and filters entries client-side.

**Tech Stack:** React 18, Supabase (migration), CSS

## Global Constraints

- No new npm packages
- Tag color is stored as a CSS color string (e.g. `#f0c040`, `rgba(...)`) on `tags.color` column (nullable — null = no color)
- Status tint classes: `.card-status-backlog`, `.card-status-active`, `.card-status-done` applied to `.card` div
- Tag: search syntax: query starting with `tag:` (case-insensitive), e.g. `tag:book` or `tag:` (empty = show all)
- Tag dropdown loads up to 20 tags initially; "Load more" adds 20 at a time
- Settings section heading: "Tag Colors"

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/0009_tag_colors.sql` | Add `color text` column to `tags` table |
| `src/lib/db/tags.js` | Add `updateTagColor(supabase, tagId, color)`, update `listTags` to return color |
| `src/styles.css` | Status tint classes; tag chip color styles |
| `src/components/EntryCard.jsx` | Apply status tint class; accept `tagColors` map prop; pass to TagInput |
| `src/components/TagInput.jsx` | Accept `tagColors` map; apply background color to chips |
| `src/components/EntryList.jsx` | Forward `tagColors` prop to EntryCard |
| `src/components/TopicView.jsx` | Forward `tagColors`; tag: search detection + dropdown |
| `src/App.jsx` | Load tag colors on mount; pass down; `handleUpdateTagColor` |
| `src/components/SettingsView.jsx` | Tag color editor section |

---

## Task 1: DB migration — add color to tags

**Files:**
- Create: `supabase/migrations/0009_tag_colors.sql`

**Interfaces:**
- Produces: `tags.color` column (nullable text)

- [ ] **Step 1: Create migration file**

```sql
-- Add optional color to tags
alter table tags add column if not exists color text;
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: migration applies without error. If Supabase CLI is not available, the migration file is still created for manual application.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_tag_colors.sql
git commit -m "feat(db): add color column to tags table"
```

---

## Task 2: Tags DB helpers + load in App.jsx

**Files:**
- Modify: `src/lib/db/tags.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `updateTagColor(supabase, tagId, color)` — upserts tag color
- Produces: `listTags(supabase)` already exists, now returns `color` field too (no change needed if `select('*')`)
- Produces: `tagColors` map `{ [tagName]: color }` in Workspace state
- Produces: `handleUpdateTagColor(tagName, color)` in Workspace

- [ ] **Step 1: Add updateTagColor to tags.js**

```js
export async function updateTagColor(supabase, tagId, color) {
  const { error } = await supabase
    .from('tags')
    .update({ color: color || null })
    .eq('id', tagId)
  if (error) throw new Error(error.message)
}
```

(`listTags` already uses `select('*')` so it will return `color` automatically once the column exists.)

- [ ] **Step 2: Load tag colors in App.jsx**

Add import at top of App.jsx:
```jsx
import { listTags, updateTagColor } from './lib/db/tags.js'
```

Add state in Workspace:
```jsx
const [allTags, setAllTags] = useState([])
```

Add load call in `refreshTopics` (or a separate `refreshTags` called from `useEffect`):
```jsx
useEffect(() => {
  refreshTopics()
  refreshTags()
}, [])

async function refreshTags() {
  const tags = await listTags(supabase)
  setAllTags(tags)
}
```

Derive `tagColors` map (name → color) for passing to components:
```jsx
const tagColors = useMemo(
  () => Object.fromEntries(allTags.filter(t => t.color).map(t => [t.name, t.color])),
  [allTags]
)
```

Add handler:
```jsx
async function handleUpdateTagColor(tagName, color) {
  const tag = allTags.find(t => t.name === tagName)
  if (!tag) return
  await updateTagColor(supabase, tag.id, color)
  setAllTags(prev => prev.map(t => t.name === tagName ? { ...t, color: color || null } : t))
}
```

Pass to SettingsView:
```jsx
<SettingsView
  topics={topics}
  onRefreshData={refreshTopics}
  addToast={addToast}
  allTags={allTags}
  onUpdateTagColor={handleUpdateTagColor}
/>
```

Pass `tagColors` to TopicView:
```jsx
<TopicView
  ...
  tagColors={tagColors}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/tags.js src/App.jsx
git commit -m "feat: load tag colors from DB, expose tagColors map and updateTagColor handler"
```

---

## Task 3: Status tints + tag chip colors (CSS + components)

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/EntryCard.jsx`
- Modify: `src/components/TagInput.jsx`
- Modify: `src/components/EntryList.jsx`
- Modify: `src/components/TopicView.jsx`

**Interfaces:**
- Consumes: `tagColors` map from Task 2

- [ ] **Step 1: Add status tint CSS**

After the existing `.card` rule, add:
```css
.card-status-backlog { background: var(--surface); }
.card-status-active  { background: color-mix(in srgb, var(--active) 8%, var(--surface)); }
.card-status-done    { background: color-mix(in srgb, var(--done) 8%, var(--surface)); }
```

If `color-mix` needs a fallback for older browsers, add:
```css
@supports not (background: color-mix(in srgb, red 8%, white)) {
  .card-status-active { background: rgba(184,92,26,0.06); }
  .card-status-done   { background: rgba(46,122,82,0.06); }
}
```

- [ ] **Step 2: Apply status tint class in EntryCard.jsx**

In `EntryCard`, update the card div className to include the status class:
```jsx
const statusTint = entry.status ? `card-status-${entry.status}` : 'card-status-backlog'

// In the card div:
<div
  className={`card ${statusTint}${entry.pinned ? ' pinned' : ''}${expanded ? '' : ' card-collapsed'}`}
  ...
>
```

Also update the `tagColors` prop acceptance and forward to TagInput. Update the prop signature:
```jsx
export default function EntryCard({ ..., tagColors }) {
```

Pass to TagInput in expandedBody:
```jsx
<TagInput value={entry.tags || []} onChange={(next) => onTagsChange(entry.id, next)} tagColors={tagColors} />
```

Also pass to TagInput in collapsedBody's compact meta (for the tag spans):
```jsx
{(entry.tags || []).map((t) => (
  <span
    key={t}
    style={{
      opacity: 0.85,
      background: tagColors?.[t] || 'transparent',
      padding: tagColors?.[t] ? '1px 5px' : undefined,
      borderRadius: tagColors?.[t] ? '4px' : undefined,
    }}
  >#{t}</span>
))}
```

- [ ] **Step 3: Update TagInput to accept and apply tagColors**

Open `src/components/TagInput.jsx`. Accept `tagColors` prop. Apply background color to each tag chip:

Find where tag chips are rendered (the `<span>` or `<button>` for each existing tag). Add inline style:
```jsx
style={{ background: tagColors?.[tag] || undefined }}
```

If the chip already has `className="tag-chip"` or similar, add a CSS rule too:
```css
.tag-chip[style*="background"] { padding: 2px 7px; border-radius: 4px; }
```

- [ ] **Step 4: Forward tagColors through EntryList and TopicView**

In `EntryList.jsx`, add `tagColors` to prop signature and forward to EntryCard:
```jsx
export default function EntryList({ ..., tagColors }) {
// ...
  <EntryCard ... tagColors={tagColors} />
```

In `TopicView.jsx`, add `tagColors` to prop signature and forward to EntryList:
```jsx
export default function TopicView({ ..., tagColors }) {
// ...
  <EntryList ... tagColors={tagColors} />
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/components/EntryCard.test.jsx src/components/EntryList.test.jsx
```

Expected: all tests pass (tagColors is optional/undefined in tests — no change needed).

- [ ] **Step 6: Commit**

```bash
git add src/styles.css src/components/EntryCard.jsx src/components/TagInput.jsx src/components/EntryList.jsx src/components/TopicView.jsx
git commit -m "feat: status tinted card backgrounds and tag chip color highlighting"
```

---

## Task 4: Tag: search in TopicView

**Files:**
- Modify: `src/components/TopicView.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `allTags` — need to pass from App.jsx to TopicView for the dropdown. Add `allTags` prop to TopicView (array of `{id, name, color}`).
- In App.jsx, pass `allTags={allTags}` to `<TopicView>`.

- [ ] **Step 1: Add allTags prop to TopicView and update App.jsx**

In App.jsx, add to TopicView JSX:
```jsx
<TopicView ... allTags={allTags} />
```

In TopicView.jsx, add `allTags = []` to prop signature.

- [ ] **Step 2: Tag: search detection and filtering logic**

In TopicView, add derived state for tag search:
```jsx
const isTagSearch = query.toLowerCase().startsWith('tag:')
const tagSearchTerm = isTagSearch ? query.slice(4).toLowerCase().trim() : ''

const tagSuggestions = useMemo(() => {
  if (!isTagSearch) return []
  return (allTags || [])
    .filter(t => !tagSearchTerm || t.name.toLowerCase().includes(tagSearchTerm))
    .slice(0, 20)
}, [isTagSearch, tagSearchTerm, allTags])

const [tagSuggestLimit, setTagSuggestLimit] = useState(20)

// When in tag search mode, filter entries by selected tag or tag search term
const filteredByTag = useMemo(() => {
  if (!isTagSearch || !tagSearchTerm) return null
  return entries.filter(e => (e.tags || []).some(t => t.toLowerCase() === tagSearchTerm))
}, [isTagSearch, tagSearchTerm, entries])
```

Update the `filtered` memo to use `filteredByTag` when in tag search mode:
```jsx
const filtered = useMemo(() => {
  if (filteredByTag !== null) return filteredByTag
  if (scope === 'all') {
    return globalSearchResults ?? fuzzyFind(query, entries, ['title', 'note'])
  }
  let pool = scope === 'doc' ? entries.filter((e) => docEmbedIds.has(e.id)) : entries
  return fuzzyFind(query, pool, ['title', 'note'])
}, [entries, query, scope, docEmbedIds, globalSearchResults, filteredByTag])
```

- [ ] **Step 3: Tag dropdown JSX and CSS**

Add CSS in styles.css:
```css
.tag-search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-card-hover);
  z-index: 50;
  max-height: 240px;
  overflow-y: auto;
}
.tag-search-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag-search-item:hover { background: var(--surface-3); }
.tag-search-item .tag-color-swatch {
  width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
}
.search-scope { position: relative; }
```

In the TopicView JSX, add the dropdown below the search input (inside `.search-scope`):
```jsx
<div className="search-scope">
  <input
    className="searchbar"
    type="search"
    placeholder="Search… (try tag:book)"
    value={inputVal}
    onChange={(e) => setInputVal(e.target.value)}
  />
  <select value={scope} onChange={(e) => setScope(e.target.value)}>
    {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
  </select>
  {isTagSearch && tagSuggestions.length > 0 && (
    <div className="tag-search-dropdown">
      {tagSuggestions.map(t => (
        <div
          key={t.id}
          className="tag-search-item"
          onClick={() => setInputVal(`tag:${t.name}`)}
        >
          {t.color && <span className="tag-color-swatch" style={{ background: t.color }} />}
          #{t.name}
        </div>
      ))}
      {(allTags || []).filter(t => !tagSearchTerm || t.name.toLowerCase().includes(tagSearchTerm)).length > tagSuggestions.length && (
        <div className="tag-search-item" style={{ color: 'var(--muted)' }} onClick={() => setTagSuggestLimit(l => l + 20)}>
          Load more…
        </div>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TopicView.jsx src/styles.css src/App.jsx
git commit -m "feat: tag: prefix search with dropdown suggestions and entry filtering"
```

---

## Task 5: Tag color editor in Settings

**Files:**
- Modify: `src/components/SettingsView.jsx`

**Interfaces:**
- Consumes: `allTags: Array<{id, name, color}>` prop
- Consumes: `onUpdateTagColor(tagName, color)` prop

- [ ] **Step 1: Add Tag Colors section to SettingsView**

Update SettingsView prop signature:
```jsx
export default function SettingsView({ topics, onRefreshData, addToast, allTags = [], onUpdateTagColor }) {
```

At the end of the returned JSX (before closing tag), add a Tag Colors section:
```jsx
<section>
  <h3 className="section-label">Tag Colors</h3>
  {allTags.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No tags yet. Add tags to entries to see them here.</p>}
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {allTags.map(tag => (
      <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          flex: 1,
          fontSize: 13,
          padding: '2px 8px',
          borderRadius: 5,
          background: tag.color || 'var(--surface-3)',
        }}>#{tag.name}</span>
        <input
          type="color"
          value={tag.color || '#ffffff'}
          onChange={(e) => onUpdateTagColor(tag.name, e.target.value)}
          style={{ width: 32, height: 28, border: 'none', cursor: 'pointer', borderRadius: 4 }}
          title={`Color for #${tag.name}`}
        />
        <button
          style={{ fontSize: 11, padding: '3px 8px' }}
          onClick={() => onUpdateTagColor(tag.name, null)}
          title="Remove color"
        >✕</button>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsView.jsx
git commit -m "feat: tag color editor in Settings"
```
