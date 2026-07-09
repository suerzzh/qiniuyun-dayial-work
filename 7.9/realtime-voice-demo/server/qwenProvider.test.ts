import test from 'node:test'
import assert from 'node:assert/strict'
import { formatUnexpectedResponseError } from './qwenProvider.js'

test('formatUnexpectedResponseError includes status and provider response body', () => {
  const message = formatUnexpectedResponseError(
    400,
    'Bad Request',
    '{"code":"BadRequest.IllegalEndpoint","message":"Workspace endpoint is invalid."}',
  )

  assert.match(message, /400 Bad Request/)
  assert.match(message, /BadRequest\.IllegalEndpoint/)
  assert.match(message, /Workspace endpoint is invalid/)
})

