# Entropy & Complexity Reduction Report (rev 3)

Date: 2026-08-23 · Scope: `src/**` (71,840 LOC TS/TSX) · Baseline: `pnpm verify` green (biome, tsc, knip, vitest — 922 tests). jscpd (not part of `verify`) reports 220 exact clones / 3,270 duplicated lines (4.69%).

## Root causes of entropy

1. **Three layers handle the gh/cb provider split three different ways.** The tRPC layer hand-rolls an `if (input.provider === 'cb')` branch per procedure (~50 sites); the provider classes exist only behind a single-method `search()` interface with a copy-pasted `Ctx` type; the sync layer duplicates a transactional skeleton that `sync/shared.ts` already half-factors.
2. **God files.** `server/github.ts` (4,184), `server/codeberg.ts` (1,364), `github-graphql.ts` (2,264), `diff-view.tsx` (1,833), `markdown-editor.tsx` (1,354) hold entire subsystems in one module. Most sub-units have typed interfaces already — they were never given files.
3. **Copy-paste twins kept in lock-step by hand.** Reaction add/remove pairs, PR-vs-issue search functions, update/task-toggle mutation pairs, gh/cb search qualifier parsing — each pair differs only in endpoint or field name.
4. **Micro-idioms pasted at call sites.** Qualifier toggling ×12, `domain(provider)` ternary ×8, plus assorted re-implemented utils (`formatRelativeTime`, `repoUrl`).

## Known coverage gaps (context for risk ratings)

No router-level caller tests exist for repos/pulls routers (`trpc.test.ts` covers only the requireSession middleware). Nothing renders `actions-section.tsx`, `MarkdownEditor`, or timeline mutations. PRs touching these surfaces must add their own tests; this is stated per-PR below.

## Proposed PRs (10) — with required sequencing

Merge order (dependencies are real, not stylistic): **PR 2 → PR 4 → PR 3 → PR 1 → PR 5 → {PR 6, PR 7} → PR 8 → PR 9 → PR 10**.

- PR 4 before PR 3: both edit `github-graphql.ts`; PR 3 exports `createGraphql` from it.
- PR 1 before PR 5: both rewrite `pulls/index.ts` import surface.
- PR 9 before PR 10 item 1 (`toggleQualifier` edits exactly the four components PR 9 refactors); PR 10 items 2–5 are independent and may land anytime after PR 6.
- PR 6/PR 7 parallel-safe with everything above (disjoint files).

### PR 1 — Provider-aware tRPC procedure builders
**Files:** `src/server/api/routers/repos.ts`, `pulls/index.ts`, `src/server/api/trpc.ts`
**Duplication (verified):** pulls/index.ts repeats `getGitHubToken(ctx.db, ctx.session?.user?.id)` **33×**; repos.ts provider-enum procedures span L125–963 (**~23**, not uniform). ~15 pulls mutations end in `deleteCache(prCacheKey(...))` + `{success:true}`.
**Asymmetries the builder MUST model** (naive unification is wrong):
- `updateComment` (pulls/index.ts:181) and `deleteComment` (:205) do NOT evict prCacheKey while siblings do → eviction must be opt-in per procedure, not baked into the builder.
- `merge` has conditional extra evictions (:737–762) → builder exposes post-success hook.
- cb branches vary: return null (repos.ts:414), throw BAD_REQUEST (repos.ts:438–443), fetch-otherwise → builder takes a per-procedure fallback, not one global behavior.
- `userId = 'anonymous'` fallback (repos.ts:134).
**Escape hatch:** any procedure that resists the builder keeps its inline form. No forced migration.
**Tests REQUIRED in-PR:** caller-level tests for gh / cb / anonymous paths of representative procedures (one read + one cache-evicting mutation + one non-evicting mutation). Est. −300–400 LOC.

### PR 2 — Sync permission-sync template method
**Files:** `src/server/sync/{shared,github,codeberg}.ts`
Both providers duplicate: recency gate → snapshot hash → advisory lock → stale-snapshot guard → personal-repo skip → permissionsToRelation rebuild → view refresh (gh L106–345 ≅ cb L81–290); snapshot-hash repo sections byte-identical.
**Known leak:** GitHub-only `teamsComplete` gating covers relations AND team-subject delete AND storeSyncState (sync/github.ts ~L252–316). Template needs ≥5 hook points (pre-relations, team-delete gate, relation build, storeSyncState gate, tail) or it leaks provider detail into shared.ts.
Est. −60–100 LOC (revised from −200). Coverage net: `sync/incremental.test.ts` (906 ln) tests recency/hash/stale-guard/team-skip for both providers.

### PR 3 — Split `server/github.ts` into domain modules
**Files:** `src/server/github.ts` → `src/server/github/{client,pulls,issues,review-threads,repos,contents,...}.ts`
Sections: PR/stack L186–1330, checks/reactions L1330–2025, cached getters L2025–2260, issues L2260–2560, review threads L2560–3040, contents L3131–3384, refs/deployments L3385–3709, tree/app L4002–4184. Export `createGraphql` from `github-graphql.ts` and delete the **19** inline `octokitGraphql.defaults(...)` sites (issues ~2382, threads 2594/2688/2792/2818, contents 3262, deployments 3474, refcounts 3716, file-commits 4061).
REST fallback functions travel WITH their GraphQL twins (org-restriction fallback pairs stay adjacent). Public surface re-exported from current entry points; if knip flags the barrel, keep named exports explicit. Mechanical move; covered by github.test.ts, merge-requirements, stack-suggestion suites.

### PR 4 — Deduplicate `github-graphql.ts` internals
**Files:** `src/server/github-graphql.ts`
(a) Compress hand-written `GQL*` timeline-event types (block ≈ L507–928, ~420 ln) to an `EventBase` intersection pattern → est. **−270 LOC** (revised from −750). The collapse MUST exclude signature types: `GQLGpgSignature.isValid: boolean` (:790) vs `GQLGitSignatureSummary.isValid: boolean|null` (:819–835) — merging them changes accepted payloads.
(b) Parameterize `addReaction`(L1451)/`removeReaction`(L1739) twins; collapse inverted CONTENT_MAP(:966)/GRAPHQL_CONTENT_MAP(:1440).
(c) Unify PR/issue search twins only where result shapes match.
(d) Fix the 8 `?? ""` normalizations at ~L1400–1431 properly.
Coverage: reaction aggregation tested (github-graphql.test.ts); type compression guarded by tsc.

### PR 5 — Shared Forgejo search layer + unified provider types
**Files:** `routers/pulls/codeberg.ts`, `issues/codeberg.ts`, `pulls/github.ts`, `issues/github.ts`, `pulls/provider.ts`, `issues/provider.ts`, `mappers.ts`, `types.ts`
~60 duplicated lines between codeberg search files (state regex differing only by `is:merged` — pulls/codeberg.ts:24–26 vs issues/codeberg.ts:26–30; author:/label: parsing; 6-entry sortMap; count fan-out) → shared module. GitHub search providers structurally identical → generic `searchGqlItems`; move mapGqlItem twins into mappers.ts. Single `SearchProvider` interface + `Ctx` (currently duplicated in both provider.ts); single home for Label/Author/Assignee/SearchParams types (currently 3 copies).
Coverage note: providers exercised only via mocked tRPC in list tests — tsc is the main net here; acceptable for pure-shape moves.

### PR 6 — Split `diff-view.tsx` into `components/diff/` modules
Pure moves of already-typed in-file units: UnifiedBlockRows (L448–719), split-side helpers (L721–937), SplitBlockRows (L939–1278), BlockRows dispatcher (L1279–1540), GapRow (L1559–1695), DiffTableBody (L1717–1816). File drops 1,833 → ~430 LOC. Finishes the abandoned move into `diff/diff-block-rows.tsx`. Best-covered PR: diff-view.test.tsx (2,376 ln, unified+split suites).

### PR 7 — Split `markdown-editor.tsx`
Hooks → `markdown/accessories/use-slash-autocomplete.ts` (L421–740), `use-formatting-handlers.ts` (L742–921); view parts → `editor-toolbar.tsx` (L944–1133), `editor-footer.tsx` (L1205–1279), `editor-popovers.tsx` (L1302–1354). ~950 LOC moved; entry file drops to ~400.
**Risk (known gap): no test renders MarkdownEditor.** In-PR requirement: add a smoke render test exercising toolbar/footer/popover wiring before the move.

### PR 8 — Extract timeline mutation hooks (+ actions-section decomposition)
**Files:** `pull/[number]/_components/timeline/event.tsx`, `action-section/actions-section.tsx`
Event.tsx carries 7 `useMutation` sites (:347/362/379/392/405/459/522, in-code FIXME): updateComment/updateReview share one optimistic-body pattern; commentTaskToggle/reviewTaskToggle likewise; commentReactionMutation vs reviewReactionMutation differ only in endpoint and cache-key prefix (`comment:`/`review:`) → parameterized factories in `use-timeline-comment-actions.ts`.
Actions-section: permissions are plain derived consts at :250–262 and merge options are inline JSX — extract them INTO new `usePullPermissions()` hook and `MERGE_OPTION_DEFS` constant (they do not exist yet; extraction, not relocation). Extract SubmitReviewButton (L506–700), ReadyForReviewButton (:466), RevertButton (:742).
**Tests REQUIRED in-PR:** interaction tests for reaction-toggle and update-mutation factories (react-query cache surgery has no current coverage). Est. ~850 LOC redistributed, ~130 deleted by dedup.

### PR 9 — Dedup shared issue/pull list components
**Files:** `[owner]/[repo]/issues/_components/*`, `pulls/_components/*`
jscpd top clone: issue-list vs pull-request-list-shared 87-line body (plus search-bar 63+28, skeleton 34=34, toolbar ≈22 ≈ 230 dup lines total). Shared list-body/skeleton/toolbar primitives parameterized by item type; the abstraction needs a hook slot for the PR-side `listDetailsByPrNumbers` enrichment query (pull-request-list-shared.tsx:95, gated by config.fetchStatusChecks) — issues have no counterpart. Both search bars collapse onto one config-driven component.
Coverage: issue-list.test.tsx (456 ln), pull-request-list.test.tsx (493 ln).

### PR 10 — Micro-dedup bundle (low-risk sweep)
Items 1–2 touch PR 9's rewrite scope (issues/_components/*) and MUST land after PR 9. Items 3–5 are independent and may land anytime after PR 6.
1. `toggleQualifier(query,key,value)` in `search-utils.ts`; replace 12 call sites (−120 LOC).
2. Move `domain()` (navbar.tsx:165)/new `repoUrl()` to `utils/provider-url.ts`; replace ~8 inline ternaries + hand-built URLs (header-client ×3 :310/:328/:337, clone-popover.tsx:37, repo-header.tsx:488, issue-row.tsx ×2 :54/:138 — inside PR 9 scope, issue-search-bar.tsx:50 — same, code-title.tsx:55; repo-file-table.tsx:28–31 private repoUrl).
3. `file-diff.tsx`: `svgContentUrls`/`imageUrls` memos (guards `isSvg`:105 vs `isImage`:127, deps differ) — NOT byte-identical, but both call `buildRawContentUrls`; compute raw URLs once and derive both (−25 LOC).
4. `repo-sidebar.tsx`: local `getAgeText` (:377) duplicates the already-imported `formatRelativeTime` (:22) — delete it.
5. Header: shared `parseRepoPath()` — header-client.tsx:386–391 ≅ header.tsx:23–27 (−60 LOC consolidated).

Best-covered suites cited per PR above (diff-view.test.tsx 2,376 ln; sync/incremental.test.ts 906 ln).

## Deferred / rejected
- `sync/mappers.ts` gh/cb mapper unification: genuine field differences, low payoff.
- `use-search-list.ts` internal split: cohesive and tested; leave unless touched anyway.
- `server/codeberg.ts` (1,364 ln) god-file split: same pattern as PR 3 but unexamined at line level; out of this batch — candidate follow-up using PR 3's template.
- `?? ""` sweep beyond PR 4/5 sites: per-site type analysis; opportunistic within each PR's files.
- Repo-level: add jscpd to `pnpm verify` as a regression gate — separate tooling change, not bundled with refactors.

## Verification plan
Every PR must keep `pnpm verify` green (biome, tsc, knip, vitest 922+ tests). Pure-move PRs additionally grep-confirmed symbol-complete. Behavioral PRs (1, 8) carry NEW tests as required above; PR 7 carries a smoke render test. jscpd run ad hoc before/after to confirm dup-line reduction.
