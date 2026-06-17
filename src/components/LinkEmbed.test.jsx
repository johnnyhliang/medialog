import { render, screen } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import LinkEmbed, { isPdfUrl } from './LinkEmbed.jsx'

vi.mock('../lib/supabaseClient.js', () => ({ supabase: {} }))
vi.mock('../lib/enrich.js', () => ({
  fetchLinkPreview: vi.fn(() => Promise.resolve({
    title: 'Example Page',
    site: 'example.com',
    image: 'https://example.com/img.jpg',
    description: 'A description',
  })),
}))

test('isPdfUrl detects pdf paths', () => {
  expect(isPdfUrl('https://x.com/doc.pdf')).toBe(true)
  expect(isPdfUrl('https://x.com/page')).toBe(false)
})

test('renders YouTube embed for youtube URLs', () => {
  render(<LinkEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />)
  expect(document.querySelector('.embed-youtube iframe')).not.toBeNull()
})

test('renders link card with fetched metadata', async () => {
  render(<LinkEmbed url="https://example.com/article" />)
  expect(await screen.findByText('Example Page')).toBeInTheDocument()
  expect(screen.getByText('example.com')).toBeInTheDocument()
})
