import { describe, it, expect, vi } from 'vitest'
import { getCommands } from '../../../src/lib/commands.js'

// The assistant toggle used to be hardcoded in App.jsx: it fired before the
// registry was consulted, so it appeared in neither the keybinds editor nor the
// palette. It was the one shortcut a user could not discover or remap. These
// tests pin the registry as the only place a binding is declared.
describe('command registry', () => {
  it('omits the assistant command when the assistant is unavailable', () => {
    const ids = getCommands({}).map((c) => c.id)
    expect(ids).not.toContain('app.assistant')
  })

  it('registers the assistant toggle when it is available', () => {
    const toggleAssistant = vi.fn()
    const cmd = getCommands({ toggleAssistant }).find((c) => c.id === 'app.assistant')
    expect(cmd).toBeDefined()
    expect(cmd.defaultKey).toBe('ctrl+/')
    cmd.handler()
    expect(toggleAssistant).toHaveBeenCalled()
  })

  // A bare letter that fires while editing makes that letter untypeable, which
  // is a much worse bug than a shortcut that only works outside an input.
  it('only lets modifier or chorded bindings run while editing', () => {
    const whileEditing = getCommands({ toggleAssistant: () => {} }).filter((c) => c.whileEditing)
    expect(whileEditing.length).toBeGreaterThan(0)
    for (const c of whileEditing) {
      expect(c.defaultKey, `${c.id} would swallow a plain keystroke`).toMatch(/(ctrl|alt|shift)\+/)
    }
  })

  it('gives every command a stable id, label and category', () => {
    const cmds = getCommands({ toggleAssistant: () => {} })
    const ids = cmds.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of cmds) {
      expect(c.label, c.id).toBeTruthy()
      expect(c.category, c.id).toBeTruthy()
    }
  })

  it('does not bind the same key to two commands', () => {
    const keys = getCommands({ toggleAssistant: () => {} }).map((c) => c.defaultKey).filter(Boolean)
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
    expect(dupes, `duplicate default bindings: ${dupes.join(', ')}`).toEqual([])
  })
})
