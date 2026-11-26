# AGENTS.md

React 18 + TypeScript + Vite + Tailwind + Dexie (IndexedDB) vocabulary app. No backend, no login. UI strings are Chinese — keep them Chinese.

## Commands

- `npm run dev` — Vite dev server (web base `/web_vocabulary/`).
- `启动.bat` — Windows 一键启动（双击）：检查 Node/npm、缺依赖时自动 `npm install`、端口 8457 已占用则直接开浏览器，否则 `npm run dev -- --port 8457 --strictPort --host 127.0.0.1 --open`。**该文件用 GBK（CP936）编码 + CRLF 保存，不要改成 UTF-8**：UTF-8 批处理配 `chcp 65001` 会让含中文的 `echo` 行在 CP936 控制台被误判为命令。
- `npx tsc --noEmit` — typecheck (there is no lint script and no ESLint config). `npm run build` = `tsc && vite build`.
- `npm run test:e2e` — Playwright. Single spec: `npx playwright test tests/words.spec.ts`. Single case: add `-g "TC-ADD-001"`. Online-dependent specs have shortcuts: `npm run test:e2e:translation`, `npm run test:e2e:dictionary`.
- `npm run build:android` — not defined; use `$env:VITE_ANDROID=1; npm run build` (outputs `dist-android/`, base `/`).
- Browser scratch extension (`extension/`, MV3, built separately): `npm run build:extension` (→ `extension/dist`), `npm run typecheck:extension`, `npm run test:e2e:extension` (own config `playwright.extension.config.ts`, headful). Load `extension/dist` unpacked in Chrome; its popup iframes the dev server at `http://127.0.0.1:8457/web_vocabulary/?embed=1`.

## Architecture

- One set of pages, two languages. `useLang()` (`src/context/Language.tsx`) selects the data source via `src/hooks/languageAware.tsx`.
- `languageAware.tsx` dispatches every read/write to the English source (`useWords` / `useSentences` / `useStudyPlan`) or Japanese source (`useJapaneseWords` / `useJapaneseStudyPlan`). **When adding a data operation, add the language-aware wrapper too, or one language will silently break.**
- Non-React async helpers decide language from module-level state: use `getCurrentLang()`, not `useLang()`.
- DB is Dexie `VocabularyDB_v2`, 11 tables, defined in `src/db/database.ts`. Migrations are versioned (`this.version(n).stores(...)`); **never edit an existing version in place — add a new one** (see v11 comment for why).
- Categories carry `lang: 'en' | 'ja'` (undefined = `en`) and `entityType`. Create categories through `addLangCategory(...)` so `lang` is set correctly.
- `definitions[]` is canonical; legacy `definition`/`translation` are fallbacks — read via `src/utils/definitions.ts`. Japanese words use `reading` (kana only, no romaji), `accent`, and `definitions: { pos, meaning, translation }[]`.
- SRS is a 7-stage Ebbinghaus scheme in `src/utils/srs.ts` (intervals 1-2-4-7-10-15-20; 2 correct in a stage advances; stage 7 = mastered). Do not change intervals/clean-count casually.
- Study type (`recall`/`choice`/`quick`) is global in `localStorage['vocab.study.prefs']` (`src/utils/studyPrefs.ts`), but word plans may override it per plan: optional non-indexed row fields `newType`/`reviewType` on `studyPlans`/`japaneseStudyPlans` (absent = follow global, so **no Dexie version bump needed**). Resolve with `resolveStudyType(isReview, plan)`; write through `updateLangPlanSettings` (never the English-only `updatePlanSettings` directly, or Japanese plans land in the wrong table). Inside a plan session the gear icon edits that plan; free study still edits the global prefs. Sentence plans (`entityType === 'sentence'`) must not use these fields.
- Embed mode: `src/main.tsx` renders `src/pages/EmbedHost.tsx` instead of `App` when the URL has `?embed=1`. It only listens for `postMessage` from `window.parent` and writes via `src/utils/embedBridge.ts` (auto-creates the English category, skips same-name words). Protocol lives in `src/utils/embedProtocol.ts`; the extension keeps a mirrored copy at `extension/src/shared/protocol.ts` — keep the two in sync.

## Testing quirks

- `playwright.config.ts` runs `workers: 1` (serial) because IndexedDB state is shared per store; each test gets a fresh browser context.
- Dev server is fixed to `--port 8457 --strictPort`; base URL is `http://127.0.0.1:8457/web_vocabulary/` — **the trailing slash is required**. Use `url('/path')` from `tests/helpers.ts`; `page.goto('/path')` loses the base.
- Tests reach into IndexedDB directly for SRS time-travel (`makeAllWordsDue`) and old-data scenarios (`moveSentencesCategory`).
- Online calls are mocked with `page.route` (translation/dictionary tests) to stay deterministic.
- The study queue is **randomly shuffled** (`getRandomWords` in `src/hooks/useWords.ts`), so study tests must not assume a fixed word order — track words by name.
- Tests run Desktop Chrome (1280×720); only the mobile layout has a bottom `nav`. For bottom-nav/scroll assertions set a mobile viewport (`page.setViewportSize`) and select the **fixed** nav, not the desktop sidebar.
- Test docs: `tests/TESTING.md`. `tests/language.spec.ts` covers language switching / data isolation.

## Conventions & gotchas

- Use the shared component classes `.card`, `.btn-primary`, `.btn-secondary`, `.input-field` from `src/index.css`, not raw utility stacks.
- Study card body comes from `item.renderDefs()` (`renderJaDefs` / `renderEnDefs` in `languageAware.tsx`) and is shared by `FlipCard`'s back face (recall) and `QuickMode`'s expanded row — editing it changes both. In-card audio uses `SpeakButton` (it stops propagation so tapping it won't flip the card); the list/card header keeps its own speak button.
- Tailwind custom palette (`primary` is green, plus `accent`/`success`/`warn`) and `darkMode: 'class'`; define new colors in `tailwind.config.js`.
- Vite injects `import.meta.env.VITE_APP_BASE` (router basename) — use it instead of hardcoding `/web_vocabulary`. `VITE_BASE` / `VITE_OUT_DIR` override defaults.
- TTS (`src/utils/tts.ts`): both languages use Youdao `dictvoice` (English by accent `type=1|2`, Japanese via `le=jap`), falling back to Web Speech. Google Translate TTS was dropped because Chrome blocks it with `net::ERR_BLOCKED_BY_ORB`. Japanese detection only matches kana, so pure-kanji text is ambiguous.
- Online services cache in `localStorage` (translation: Google → MyMemory fallback; dictionary: Bing only). Detail-page auto-lookup is an English-only opt-in stored at `vocab.autolookup` (see `src/utils/dictionaryPrefs.ts`); it only expands the Bing `DictionaryPanel` and must not write word fields. Any new `vocab.*` pref must be added to `PREF_KEYS` in `src/utils/backup.ts` or it won't survive backup/restore. `src/utils/dictionary.ts` is English-only and deliberately **not** wired through `languageAware.tsx`; render it with `DictionaryPanel` (reused by `/dictionary` page, AddWord fill, and the `/translate` 「查词典」 entry). The Bing channel fetches `cn.bing.com/dict/search` through `r.jina.ai` (needs header `x-respond-with: html`) and parses the HTML with `DOMParser`: `.hd_prUS`/`.hd_pr` phonetics, `.qdef ul li` senses (`.pos.web` → 网络释义, checked via `classList.contains('web')`), `#sentenceSeg .se_li` → `.sen_en`/`.sen_cn` bilingual examples with source from the nested `div.sen_li a`. Selectors are best-effort — missing blocks are skipped, not fatal.
- `README.md` is the detailed feature/architecture reference; check it before large changes.
- Repo hygiene: build/test outputs (`dist/`, `dist-android/`, `test-results/`, `playwright-report/`, `playwright-artifacts/`, `.playwright-cli/`), deps (`node_modules/`) and `.claude/settings.local.json` are git-ignored and must stay untracked. `英语单词/` and `日语单词/` track **only** `.json` import data; their `.md`/`.pdf`/`.txt`/`*.json.bak` and `英语单词/.work/` stay ignored — never `git add -f` those. Run `git status` before adding a new top-level directory. History was rewritten once to drop the non-json material — keep it out.
- Extension (`extension/`) gotchas: content scripts can't use ESM `import` (keep `content.ts` self-contained); MV3 service workers have no DOM, so `dictionary.ts` runs in a `chrome.offscreen` document; `window.setTimeout` → global `setTimeout` and a `VITE_DICT_PROXY`-overridable proxy prefix were added to `dictionary.ts` for this; MV3 headless doesn't inject content scripts, so extension E2E is headful; `r.jina.ai` challenges automated profiles (Cloudflare), so extension tests point `VITE_DICT_PROXY` at a local mock (`build:extension:test`). The popup opens via `chrome.windows.create` (observable, no user-gesture dependency) rather than `chrome.action.openPopup()`.
