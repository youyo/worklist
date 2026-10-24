import { expect, test } from 'claude-code/testing'

import { bandRows, parseItems, summary } from './register'

test('summary は進行中の先頭と件数を 1 行にする', async () => {
  expect(summary([])).toBe(undefined)
  expect(
    summary([
      { title: '検証', state: 'doing' },
      { title: 'commit', state: 'next' },
      { title: 'README', state: 'next' },
      { title: '手順の確認', state: 'user' },
      { title: 'CI', state: 'later' },
    ]),
  ).toBe('▶ 検証 │ 次: commit / README │ あなた: 手順の確認 │ 保留 1')
  expect(summary([{ title: 'x', state: 'user' }])).toBe('▶ なし │ あなた: x')
})

test('parseItems は不正な入力を弾く', async () => {
  expect(parseItems({ items: [{ title: 'a', state: 'doing' }] })).toEqual([{ title: 'a', state: 'doing' }])
  expect(parseItems({ items: [{ title: 'a', state: 'done' }] })).toBe(null)
  expect(parseItems({ items: [{ title: ' ', state: 'next' }] })).toBe(null)
  expect(parseItems({})).toBe(null)
})

test('tool で一覧を置き換えると status line とペインに出る', async ($, on) => {
  const statuses: (string | undefined)[] = []
  on('tool.register', (_, e) => ({ value: { tool: `mcp__worklist__${e.name}` } }))
  on('command.register', () => ({ value: { command: 'worklist' } }))
  on('ui.status', (_, e) => (statuses.push(e.text), { value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ran = await $.tool.call({
    tool: 'mcp__worklist__worklist_set',
    items: [
      { title: '検証', state: 'doing' },
      { title: '返事', state: 'user' },
    ],
  } as never)
  expect(ran.deny).toBe(undefined)

  const ui = await $.ui.mount({
    plugin: 'worklist',
    component: 'Pane',
    requestId: 'worklist',
    surface: 'terminal',
    props: { title: '作業の一覧', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  } as never)
  expect((await ui.find({ type: 'Text', text: /あなた待ち/ }))?.text).toBe('あなた待ち（1）')
  await ui.unmount()
})

test('次が 3 件以上なら先頭 2 件と残りの数', async () => {
  expect(
    summary([
      { title: 'a', state: 'next' },
      { title: 'b', state: 'next' },
      { title: 'c', state: 'next' },
    ]),
  ).toBe('▶ なし │ 次: a / b +1')
})

test('帯は分類ごとに 1 行で、幅を超えたら末尾を省く', async () => {
  const rows = bandRows(
    [
      { title: '検証', state: 'doing' },
      { title: 'a'.repeat(50), state: 'next' },
      { title: 'b', state: 'next' },
      { title: '返事', state: 'user' },
    ],
    40,
  )
  expect(rows.map(r => r.state)).toEqual(['doing', 'next', 'user'])
  expect(rows[0]?.text).toBe('検証')
  expect(rows[1]?.text.length).toBe(28)
  expect(rows[1]?.text.endsWith('…')).toBe(true)
})
