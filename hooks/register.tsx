import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { WorkItem, WorkState } from '../types'

const PANE = 'worklist'
const TOOL = 'worklist_set'
const items = atom({ plugin: 'worklist', key: 'items' } as const, [] as WorkItem[])

const STATES: readonly WorkState[] = ['doing', 'next', 'user', 'later']
const HEADINGS: Record<WorkState, string> = {
  doing: '進行中',
  next: '次',
  user: 'あなた待ち',
  later: '保留',
}

function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

/** status line の 1 行。進行中は題名を全部、次とあなた待ちは先頭 2 件の題名、保留は件数 */
export function summary(list: readonly WorkItem[]): string | undefined {
  if (list.length === 0) return undefined
  const of = (s: WorkState) => list.filter(i => i.state === s)
  const titles = (s: WorkState, shown: number, max: number) => {
    const all = of(s)
    const head = all.slice(0, shown).map(i => clip(i.title, max)).join(' / ')
    return all.length > shown ? `${head} +${all.length - shown}` : head
  }
  const doing = of('doing')
  const parts = [
    doing.length ? `▶ ${titles('doing', 3, 30)}` : '▶ なし',
    of('next').length ? `次: ${titles('next', 2, 18)}` : '',
    of('user').length ? `あなた: ${titles('user', 2, 18)}` : '',
    of('later').length ? `保留 ${of('later').length}` : '',
  ].filter(Boolean)
  return parts.join(' │ ')
}

/** 帯の行。分類ごとに「見出し + 題名を · でつないだもの」を幅に収める */
export function bandRows(list: readonly WorkItem[], width: number): { state: WorkState; label: string; text: string }[] {
  const labels: Record<WorkState, string> = { doing: '▶ 進行中  ', next: '  次      ', user: '  あなた  ', later: '  保留    ' }
  return STATES.filter(s => list.some(i => i.state === s)).map(s => {
    const text = list.filter(i => i.state === s).map(i => i.title).join(' · ')
    const room = width - 12
    return { state: s, label: labels[s], text: text.length > room ? `${text.slice(0, room - 1)}…` : text }
  })
}

/** tool の入力を検査して、正しい項目だけにする（不正なら null） */
export function parseItems(input: unknown): WorkItem[] | null {
  if (typeof input !== 'object' || input === null) return null
  const raw = (input as { items?: unknown }).items
  if (!Array.isArray(raw) || raw.length > 50) return null
  const out: WorkItem[] = []
  for (const one of raw) {
    if (typeof one !== 'object' || one === null) return null
    const { title, state } = one as { title?: unknown; state?: unknown }
    if (typeof title !== 'string' || title.trim() === '') return null
    if (typeof state !== 'string' || !STATES.includes(state as WorkState)) return null
    out.push({ title: clip(title, 120), state: state as WorkState })
  }
  return out
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: TOOL,
      description: [
        '作業の一覧を丸ごと置き換える（利用者は /worklist で全体を見られる）。',
        '複数の手順にまたがる作業を始めたとき、項目の状態が変わったとき、利用者に何かを頼んだとき・頼みが済んだときに呼ぶ。',
        'items は [{title, state}] で、state は doing（進行中）・next（このあと自分がやる）・user（利用者の返事や操作を待つ）・later（保留）。',
        '終わった項目は入れない。すべて終わったら items を空にする。title は短い日本語（1 行）。',
      ].join(''),
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            maxItems: 50,
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                state: { type: 'string', enum: STATES },
              },
              required: ['title', 'state'],
            },
          },
        },
        required: ['items'],
      },
      isDeferred: false,
    })
    await $.command.register({ name: 'worklist', description: '作業の一覧のペインを開く・閉じる' })
    $.ui.status(undefined)
    return next(e)
  })

  on('tool.call', { tool: 'mcp__worklist__worklist_set' }, async ($, e) => {
    const list = parseItems(e)
    if (list === null) {
      return { deny: 'items は [{title, state}] の配列（50 件まで）。state は doing / next / user / later のどれか。' }
    }
    await update($, items, () => list)
    return { result: `作業の一覧を ${list.length} 件にした。` }
  })

  // /worklist は開閉の切り替え。開いているときは閉じる。Esc（空のプロンプト）でも閉じる
  on('command.run', { command: 'worklist' }, async $ => {
    if ((await $.ui.panes()).some(p => p.id === PANE)) {
      await $.ui.close({ id: PANE })
      return { text: '作業の一覧を閉じた。' }
    }
    await $.ui.open({ id: PANE, title: 'worklist', closeOnEscape: true })
    return { text: '作業の一覧を開いた。' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, items)
    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>作業の一覧はまだありません。</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {STATES.filter(s => list.some(i => i.state === s)).map(s => (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={s === 'user' ? 'yellow' : s === 'doing' ? 'cyan' : undefined}>
              {HEADINGS[s]}（{list.filter(i => i.state === s).length}）
            </Text>
            {list
              .filter(i => i.state === s)
              .map(i => (
                <Text dimColor={s === 'later'}>
                  {s === 'doing' ? '▶ ' : '・'}
                  {i.title}
                </Text>
              ))}
          </Box>
        ))}
      </Box>
    )
  })
}
