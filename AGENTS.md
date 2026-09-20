# AGENTS.md

React 18 + TypeScript + Vite + Tailwind + Dexie (IndexedDB) vocabulary app. No backend, no login. UI strings are Chinese — keep them Chinese.

## Commands

- `npm run dev` — Vite dev server (web base `/web_vocabulary/`).
- `npx tsc --noEmit` — typecheck (there is no lint script and no ESLint config). `npm run build` = `tsc && vite build`.
- `npm run test:e2e` — Playwright. Single spec: `npx playwright test tests/words.spec.ts`. Single case: add `-g "TC-ADD-001"`. Online-dependent specs have shortcuts: `npm run test:e2e:translation`, `npm run test:e2e:dictionary`.
- `npm run build:android` — not defined; use `$env:VITE_ANDROID=1; npm run build` (outputs `dist-android/`, base `/`).

## Architecture

- One set of pages, two languages. `useLang()` (`src/context/Language.tsx`) selects the data source via `src/hooks/languageAware.tsx`.
- `languageAware.tsx` dispatches every read/write to the English source (`useWords` / `useSentences` / `useStudyPlan`) or Japanese source (`useJapaneseWords` / `useJapaneseStudyPlan`). **When adding a data operation, add the language-aware wrapper too, or one language will silently break.**
- Non-React async helpers decide language from module-level state: use `getCurrentLang()`, not `useLang()`.
- DB is Dexie `VocabularyDB_v2`, 11 tables, defined in `src/db/database.ts`. Migrations are versioned (`this.version(n).stores(...)`); **never edit an existing version in place — add a new one** (see v11 comment for why).
- Categories carry `lang: 'en' | 'ja'` (undefined = `en`) and `entityType`. Create categories through `addLangCategory(...)` so `lang` is set correctly.
- `definitions[]` is canonical; legacy `definition`/`translation` are fallbacks — read via `src/utils/definitions.ts`. Japanese words use `reading` (kana only, no romaji), `accent`, and `definitions: { pos, meaning, translation }[]`.
- SRS is a 7-stage Ebbinghaus scheme in `src/utils/srs.ts` (intervals 1-2-4-7-10-15-20; 2 correct in a stage advances; stage 7 = mastered). Do not change intervals/clean-count casually.

## Testing quirks

- `playwright.config.ts` runs `workers: 1` (serial) because IndexedDB state is shared per store; each test gets a fresh browser context.
- Dev server is fixed to `--port 5199 --strictPort`; base URL is `http://127.0.0.1:5199/web_vocabulary/` — **the trailing slash is required**. Use `url('/path')` from `tests/helpers.ts`; `page.goto('/path')` loses the base.
- Tests reach into IndexedDB directly for SRS time-travel (`makeAllWordsDue`) and old-data scenarios (`moveSentencesCategory`).
- Online calls are mocked with `page.route` (translation/dictionary tests) to stay deterministic.
- The study queue is **randomly shuffled** (`getRandomWords` in `src/hooks/useWords.ts`), so study tests must not assume a fixed word order — track words by name.
- Tests run Desktop Chrome (1280×720); only the mobile layout has a bottom `nav`. For bottom-nav/scroll assertions set a mobile viewport (`page.setViewportSize`) and select the **fixed** nav, not the desktop sidebar.
- Test docs: `tests/TESTING.md`. `tests/language.spec.ts` covers language switching / data isolation.

## Conventions & gotchas

- Use the shared component classes `.card`, `.btn-primary`, `.btn-secondary`, `.input-field` from `src/index.css`, not raw utility stacks.
- Tailwind custom palette (`primary` is green, plus `accent`/`success`/`warn`) and `darkMode: 'class'`; define new colors in `tailwind.config.js`.
- Vite injects `import.meta.env.VITE_APP_BASE` (router basename) — use it instead of hardcoding `/web_vocabulary`. `VITE_BASE` / `VITE_OUT_DIR` override defaults.
- TTS (`src/utils/tts.ts`): English prefers Youdao, Japanese prefers Google TTS, both fall back to Web Speech. Japanese detection only matches kana, so pure-kanji text is ambiguous.
- Online services use multi-channel fallback (translation: Google → MyMemory; dictionary: Youdao via `r.jina.ai` → FreeDictionary + Wiktionary supplement, synonyms from Datamuse) and cache in `localStorage`. `src/utils/dictionary.ts` is English-only and deliberately **not** wired through `languageAware.tsx`; render it with `DictionaryPanel` (reused by `/dictionary` page and AddWord fill). The Youdao parser also reads `collins` / `rel_word` / `discriminate` (note `discriminate.data` is an **array**); `oxford`/`webster`/`senior` are encrypted and unusable client-side.
- `README.md` is the detailed feature/architecture reference; check it before large changes.
