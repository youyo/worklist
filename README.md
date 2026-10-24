# worklist

A thin viewer for what Claude is working on, as a Claude Code plugin (a mod).

Claude keeps a short list of its work with the `worklist_set` tool — each item is **doing**, **next**, **waiting for you**, or **later** — and you open it in a pane with `/worklist`. Nothing is read from or sent anywhere: the list lives in the current session only, and only Claude writes it.

## Install

At the prompt of a terminal session:

```
/plugin install worklist --marketplace youyo/worklist
```

From a shell:

```
claude plugin install worklist --marketplace youyo/worklist
```

Answer `y` to add the marketplace, then pick a scope (the user scope makes it available in every project).

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `youyo/worklist`, then Add plugin.

## Use

- `/worklist` opens the pane, and `/worklist` again (or Esc at an empty prompt) closes it.
- Claude updates the list on its own when a multi-step task starts, when an item changes state, and when it asks you for something. If you want it to always do so, add a line to your `CLAUDE.md`, e.g. "Keep the worklist up to date with `worklist_set`."
- The list starts empty in each new session.
- A thin one-line band appears above the prompt, only when it is useful: if something is **waiting for you** it shows `● あなた待ち: <first title>` (plus ` 他 n 件` for more); otherwise, if something is **doing**, `▶ <first title>` with a dimmed `次 n · 保留 n` (next / later counts) at the end. With neither, nothing is drawn. It is hidden while the `/worklist` pane is shown, and titles too long for the width are cut with `…`.
- To turn the band off, set the `showBand` option of the plugin to `false` (it is on by default).

The pane and the tool description are in Japanese for now.

---

## 日本語

Claude が今なにをしているかを見るための、薄い viewer です（Claude Code のプラグイン）。

Claude が `worklist_set` ツールで作業の一覧（進行中・次・あなた待ち・保留）を書き、あなたは `/worklist` でペインに開いて見ます。データはそのセッションの中だけにあり、どこにも送られません。一覧を書くのは Claude だけです。

- 入れ方は上の Install のとおりです（user scope で入れると、どのプロジェクトでも使えます）。
- `/worklist` で開き、もう一度 `/worklist`（または空のプロンプトで Esc）で閉じます。
- 必ず使わせたいときは、`CLAUDE.md` に「作業の一覧は `worklist_set` で更新する」と一行書いてください。
- 入力欄の上に、必要なときだけ細い 1 行の帯が出ます。「あなた待ち」があれば `● あなた待ち: <先頭の題名>`（ほかにもあれば ` 他 n 件`）、なければ「進行中」があるとき `▶ <先頭の題名>` と、末尾に薄く `次 n · 保留 n`。どちらも無ければ何も出しません。`/worklist` のペインが見えている間は出さず、幅に収まらない題名は `…` で切ります。
- 帯が不要なら、プラグインの設定 `showBand` を `false` にしてください（既定は表示）。

## License

MIT
