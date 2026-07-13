export interface MessageWithId {
  id: string
}

export function replaceMessageById<T extends MessageWithId>(
  messages: T[],
  updated: T,
): T[] {
  return messages.map((message) => (message.id === updated.id ? updated : message))
}
