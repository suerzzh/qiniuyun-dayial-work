import assert from 'node:assert/strict'
import test from 'node:test'
import { replaceMessageById } from '../src/messageState.ts'

test('replaceMessageById replaces the matching message without reading mutable refs', () => {
  const original = [
    { id: 'a_1', role: 'ai' as const, text: 'Hello', final: false },
    { id: 'u_1', role: 'user' as const, text: 'Hi', final: true },
  ]
  const updated = { id: 'a_1', role: 'ai' as const, text: 'Hello there', final: true }

  const result = replaceMessageById(original, updated)

  assert.deepEqual(result, [updated, original[1]])
})
