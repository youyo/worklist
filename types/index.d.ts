export type WorkState = 'doing' | 'next' | 'user' | 'later'
export type WorkItem = { title: string; state: WorkState }

declare module 'claude-code' {
  interface PluginState {
    worklist: { items: WorkItem[] }
  }
}
