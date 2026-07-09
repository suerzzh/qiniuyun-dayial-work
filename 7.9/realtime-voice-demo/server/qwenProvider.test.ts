import test from 'node:test'
import assert from 'node:assert/strict'
import { QwenProviderClient, formatUnexpectedResponseError } from './qwenProvider.js'
import type { RealtimeConfig } from './config.js'
import type { QwenProviderCallbacks } from './qwenProvider.js'

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

test('Qwen audio transcript events are mapped to AI text callbacks', () => {
  const textDeltas: string[] = []
  const textDoneIds: string[] = []
  const debugEvents: string[] = []
  const client = new QwenProviderClient(
    testConfig(),
    'call_test',
    testCallbacks({
      onAiTextDelta: (text) => textDeltas.push(text),
      onAiTextDone: (messageId) => textDoneIds.push(messageId),
      onDebug: (event) => debugEvents.push(event),
    }),
  )
  const messageHandler = client as unknown as { handleMessage(raw: string): void }

  messageHandler.handleMessage(JSON.stringify({
    type: 'response.audio_transcript.delta',
    delta: 'Sure, that sounds nice.',
  }))
  messageHandler.handleMessage(JSON.stringify({
    type: 'response.audio_transcript.done',
    item_id: 'item_1',
    transcript: 'Sure, that sounds nice.',
  }))

  assert.deepEqual(textDeltas, ['Sure, that sounds nice.'])
  assert.deepEqual(textDoneIds, ['item_1'])
  assert.equal(debugEvents.includes('provider_event_unhandled'), false)
})

function testConfig(): RealtimeConfig {
  return {
    provider: 'qwen',
    dashscopeApiKey: 'test-key',
    dashscopeWorkspaceId: 'test-workspace',
    dashscopeRegion: 'cn-beijing',
    modelName: 'qwen3.5-omni-plus-realtime',
    voice: 'Ethan',
    inputAudioFormat: 'pcm',
    inputSampleRate: 16000,
    outputAudioFormat: 'pcm',
    outputSampleRate: 24000,
    maxCallSeconds: 600,
    maxReconnectAttempts: 0,
    debugLog: true,
    port: 8787,
  }
}

function testCallbacks(
  overrides: Partial<QwenProviderCallbacks> = {},
): QwenProviderCallbacks {
  return {
    onReady: () => {},
    onUserTranscriptDelta: () => {},
    onUserTranscriptFinal: () => {},
    onAiTextDelta: () => {},
    onAiTextDone: () => {},
    onAiAudioDelta: () => {},
    onAiAudioDone: () => {},
    onUserSpeechStarted: () => {},
    onUserSpeechStopped: () => {},
    onResponseStarted: () => {},
    onResponseDone: () => {},
    onError: () => {},
    onClose: () => {},
    onDebug: () => {},
    ...overrides,
  }
}
