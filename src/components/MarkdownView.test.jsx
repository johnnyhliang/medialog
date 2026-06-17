import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import MarkdownView from './MarkdownView.jsx'

const ID = '11111111-1111-1111-1111-111111111111'
const entry = { id: ID, title: 'Embedded Entry', url: null, note: 'hi' }
const getEntry = (id) => (id === ID ? entry : null)

test('renders embed token as a chip showing the entry title', () => {
  render(
    <MarkdownView getEntry={getEntry} onJump={() => {}}>
      {`Look: [[entry:${ID}]] done`}
    </MarkdownView>
  )
  expect(screen.getByRole('button', { name: /embedded entry/i })).toBeInTheDocument()
})
