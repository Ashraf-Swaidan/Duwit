export type HomeChatRole = 'assistant' | 'user'

export interface HomeChatMessage {
  role: HomeChatRole
  content: string
}

interface HomeChatSnapshot {
  messages: HomeChatMessage[]
  pendingNavGoalId: string | null
  lastUpdated: number
}

let snapshot: HomeChatSnapshot = {
  messages: [],
  pendingNavGoalId: null,
  lastUpdated: 0,
}

export function loadHomeChat(): HomeChatSnapshot {
  return snapshot
}

export function saveHomeChat(messages: HomeChatMessage[], pendingNavGoalId: string | null) {
  snapshot = { messages, pendingNavGoalId, lastUpdated: Date.now() }
}

export function clearHomeChat() {
  snapshot = { messages: [], pendingNavGoalId: null, lastUpdated: 0 }
}

