import { expect, test } from 'claude-code/testing'

import { bandLine, bandRows, displayWidth, parseItems, summary } from './register'

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

test('/worklist は作業中のターンを待たせず、その場で開く（immediate）', async ($, on) => {
  const specs: { name: string; immediate?: true }[] = []
  on('tool.register', (_, e) => ({ value: { tool: `mcp__worklist__${e.name}` } }))
  on('command.register', (_, e) => (specs.push(e as never), { value: { command: 'worklist' } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(specs.find((s) => s.name === 'worklist')?.immediate).toBe(true)
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

test('bandLine は displayWidth が全角を 2 と数える', async () => {
  expect(displayWidth('abc')).toBe(3)
  expect(displayWidth('作業')).toBe(4)
})

test('bandLine: user があれば優先し、他の件数を添える', async () => {
  const line = bandLine(
    [
      { title: '検証', state: 'doing' },
      { title: '返事を待つ', state: 'user' },
      { title: '承認', state: 'user' },
      { title: '承認2', state: 'user' },
    ],
    80,
  )
  expect(line).toEqual({ kind: 'user', text: '● あなた待ち: 返事を待つ 他 2 件', tail: '' })
})

test('bandLine: doing だけなら先頭と、末尾に次・保留の数', async () => {
  const line = bandLine(
    [
      { title: '検証', state: 'doing' },
      { title: 'b', state: 'doing' },
      { title: 'n1', state: 'next' },
      { title: 'n2', state: 'next' },
      { title: 'l', state: 'later' },
    ],
    80,
  )
  expect(line).toEqual({ kind: 'doing', text: '▶ 検証 他 1 件', tail: '次 2 · 保留 1' })
})

test('bandLine: doing も user も無ければ出さない', async () => {
  expect(bandLine([], 80)).toBe(null)
  expect(bandLine([{ title: 'n', state: 'next' }, { title: 'l', state: 'later' }], 80)).toBe(null)
})

test('bandLine: 長いタイトルは全角の幅で … に切り、1 行に収める', async () => {
  const line = bandLine([{ title: 'あ'.repeat(40), state: 'doing' }, { title: 'n', state: 'next' }], 30)
  expect(line?.text.endsWith('…')).toBe(true)
  expect(displayWidth(`${line?.text} ${line?.tail}`)).toBeLessThanOrEqual(30)
  const u = bandLine([{ title: 'x'.repeat(100), state: 'user' }], 20)
  expect(u?.text.endsWith('…')).toBe(true)
  expect(displayWidth(u?.text ?? '')).toBeLessThanOrEqual(20)
})

const BAND = {
  plugin: 'worklist',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 60, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

async function setup($: any, on: any, items: unknown[], panes: unknown[] = []) {
  on('tool.register', (_: unknown, e: { name: string }) => ({ value: { tool: `mcp__worklist__${e.name}` } }))
  on('command.register', () => ({ value: { command: 'worklist' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: panes }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('ui.render', ($2: any, e: any) => {
    const { Text } = $2.ui.resolve(e)
    return <Text>(engine)</Text>
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'mcp__worklist__worklist_set', items } as never)
}

test('帯: user があれば warning の色で 1 行出す', async ($, on) => {
  await setup($, on, [{ title: '検証', state: 'doing' }, { title: '返事', state: 'user' }])
  const ui = await $.ui.mount(BAND as never)
  expect((await ui.find({ type: 'Text', text: /あなた待ち: 返事/ }))?.text).toBe('● あなた待ち: 返事')
  expect((await ui.find({ type: 'Text', text: /あなた待ち: 返事/ }))?.props?.color).toBe('warning')
  await ui.unmount()
})

test('帯: doing だけなら進行中と次・保留の数', async ($, on) => {
  await setup($, on, [{ title: '検証', state: 'doing' }, { title: 'n', state: 'next' }])
  const ui = await $.ui.mount(BAND as never)
  expect((await ui.find({ type: 'Text', text: /▶ 検証/ }))?.text).toBe('▶ 検証 ')
  expect((await ui.find({ type: 'Text', text: /次 1/ }))?.text).toBe('次 1 · 保留 0')
  await ui.unmount()
})

test('帯: doing も user も無ければ何も描かない', async ($, on) => {
  await setup($, on, [{ title: 'n', state: 'next' }])
  const ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ type: 'Text', text: /▶|●/ })).toBeFalsy()
  await ui.unmount()
})

test('帯: ペインが見えているときは出さない', async ($, on) => {
  await setup($, on, [{ title: '検証', state: 'doing' }], [{ id: 'worklist', title: 'worklist', isShown: true, isFocused: false, isPlaced: true }])
  const ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ type: 'Text', text: /▶|●/ })).toBeFalsy()
  await ui.unmount()
})

test('帯: ペインがタブの裏にあるだけなら出す', async ($, on) => {
  await setup($, on, [{ title: '検証', state: 'doing' }], [{ id: 'worklist', title: 'worklist', isShown: false, isFocused: false, isPlaced: true }])
  const ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ type: 'Text', text: /▶ 検証/ })).toBeTruthy()
  await ui.unmount()
})

test('帯: showBand=false なら出さない', { options: { showBand: false } }, async ($, on) => {
  await setup($, on, [{ title: '検証', state: 'doing' }])
  const ui = await $.ui.mount(BAND as never)
  expect(await ui.find({ type: 'Text', text: /▶|●/ })).toBeFalsy()
  await ui.unmount()
})
