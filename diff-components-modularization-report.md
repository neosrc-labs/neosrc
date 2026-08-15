# Diff Components Modularization Report

## 1. High-level overview

The refactor separates the diff and review-comment experience into smaller responsibilities without merging the two existing comment contexts.

The main outcomes are:

- Diff parsing, patch normalization, language detection, anchor resolution, gap calculation, and render-item construction are now pure model concerns.
- Line permalink selection, comment-range dragging, hash navigation, and syntax highlighting are isolated from table rendering.
- Review comments share one semantic item renderer, one reply composer, and shared reply/edit mutation lifecycles.
- Changes-page threads and timeline review threads remain separate controllers, preserving their different resolution, deletion, cache, and autosave behavior.
- File presentation decisions and raw-content URL construction are explicit and independently testable.
- File state and file-comment mutation lifecycles are extracted from the file shell.
- SVG fetching/preview rendering and image fallback behavior have dedicated media modules.
- Diff-mode controls now expose accessible button names.
- Existing cache keys, optimistic stubs, permission predicates, URL hash formats, and path-scoping behavior remain compatibility boundaries.

The repository verification completed successfully: Biome, TypeScript, Knip, and the full Vitest suite passed. No end-to-end suite was run because the repository requires human input for e2e tests.

## 2. Order in which changes were made

### Phase 1: Domain contracts

1. Added the diff contracts and renamed `ActiveComment` usage to `DiffCommentTarget`.
2. Extracted the pure diff model for normalization, parsing, language lookup, render gaps, position maps, and comment anchors.
3. Moved thread grouping into `groupReviewCommentThreads`.
4. Moved file/line classification into `isFileComment` and `isLineComment`.
5. Added focused model, grouping, classification, deprecated-position, `original_position`, and unresolved-anchor tests.

Primary files:

- `src/components/diff/types.ts`
- `src/components/diff/model.ts`
- `src/components/review-comment-threads.ts`
- `src/components/diff/model.test.ts`
- `src/components/review-comment-threads.test.ts`
- `src/__tests__/components/group-threads.test.ts`

### Phase 2: Shared review-comment primitives

1. Extracted the one-comment renderer, including permissions, reactions, editing, task toggles, delete confirmation, and optimistic-stub presentation.
2. Extracted the reply composer and collapsed reply button.
3. Extracted shared reply mutation lifecycle handling.
4. Extracted shared edit/task-toggle state and mutation handling.
5. Migrated inline and timeline comment renderers.
6. Added focused component tests for placement, editing, deletion confirmation, stub state, whitespace submission, and error presentation.

Primary files:

- `src/components/review-comment-item.tsx`
- `src/components/review-comment-reply-composer.tsx`
- `src/hooks/use-review-comment-reply.ts`
- `src/hooks/use-review-comment-edit.ts`
- `src/components/review-comment-item.test.tsx`
- `src/components/review-comment-reply-composer.test.tsx`

### Phase 3: Thread shells

1. Kept `InlineCommentThread` responsible for changes-page identity, reply autosave, negative-ID remount bridging, resolution banners, and direct-reply reactions.
2. Kept `ReviewComments`/`CommentBlock` responsible for timeline filtering, review headers, resolved-thread expansion, timeline deletion behavior, and timeline-specific autosave.
3. Replaced the old timeline reply-button import with the semantic reply-composer module.
4. Preserved separate deletion cache snapshots and resolution ownership.
5. Re-ran the existing inline-thread and timeline review-comment suites.

Primary files:

- `src/components/inline-comment-thread.tsx`
- `src/app/gh/[owner]/[repo]/pull/[number]/_components/review-comments.tsx`
- `src/components/__tests__/components/inline-comment-thread.test.tsx`
- `src/app/gh/[owner]/[repo]/pull/[number]/_components/review-comments.test.tsx`

### Phase 4: Diff rendering and interaction extraction

1. Extracted ordinary line selection and permalink updates.
2. Extracted plus-button and drag-based comment selection.
3. Extracted hash parsing, gap expansion, stable-position polling, sticky-offset scrolling, and cleanup.
4. Extracted syntax highlighting into a named hook.
5. Extracted the line comment editor, context-row rendering, line-row wrapper, gap-size helper, and table presentation shell.
6. Reduced `DiffView` to model creation, map derivation, hook composition, and table wiring.
7. Re-ran diff rendering and model tests.

Primary files:

- `src/components/diff/use-diff-line-selection.ts`
- `src/components/diff/use-diff-comment-selection.ts`
- `src/components/diff/use-diff-hash-navigation.ts`
- `src/components/diff/use-diff-syntax-highlighting.ts`
- `src/components/diff/diff-line-comment-editor.tsx`
- `src/components/diff/diff-line-row.tsx`
- `src/components/diff/diff-context-row.tsx`
- `src/components/diff/diff-block-rows.tsx`
- `src/components/diff/diff-table.tsx`
- `src/components/diff-view.tsx`

### Phase 5: File shell extraction

1. Added explicit presentation decisions and raw-content URL construction.
2. Moved viewed/collapsed/comment-draft state into `useFileDiffState`.
3. Moved optimistic file-comment and start-review actions into `useFileCommentActions`.
4. Extracted file header, file editor, file-level thread, and hidden-diff views.
5. Reduced `FileDiff` to state/action composition, comment partitioning, shell layout, and content routing.
6. Added URL and presentation-policy tests plus re-ran the existing `FileDiff` suite.

Primary files:

- `src/components/file-diff-source.ts`
- `src/components/use-file-diff-state.ts`
- `src/components/use-file-comment-actions.ts`
- `src/components/file-diff-header.tsx`
- `src/components/file-comment-editor.tsx`
- `src/components/file-comment-threads.tsx`
- `src/components/hidden-diff-notice.tsx`
- `src/components/file-diff.tsx`
- `src/components/file-diff-source.test.ts`

### Phase 6: Media controllers

1. Added accessible names to generic diff-mode buttons.
2. Extracted reusable image fallback rendering under `media-diff`.
3. Extracted abortable SVG content loading and sandboxed SVG preview rendering.
4. Added direct diff-mode selection coverage.
5. Re-ran file/media-focused tests.

Primary files:

- `src/components/diff-mode-toggle.tsx`
- `src/components/diff-mode-toggle.test.tsx`
- `src/components/media-diff/image-with-fallback.tsx`
- `src/components/media-diff/use-svg-contents.ts`
- `src/components/media-diff/svg-preview.tsx`
- `src/components/image-diff.tsx`
- `src/components/svg-diff.tsx`

### Phase 7: Verification

Commands completed successfully:

- `rtk pnpm check`
- `rtk pnpm typecheck`
- Focused Vitest suites for domain, comments, diff, file, and media behavior
- `rtk pnpm verify`

The local UI smoke check loaded the unauthenticated Neosrc landing page. An authenticated changes-page session was unavailable. A supervised dev-server launch also encountered an already-running Next process on port 3000; the existing local page remained reachable.

## 3. Recommended file review order

Review in this order to follow the dependency direction from pure contracts to UI composition.

### A. Domain model and contracts

1. `src/components/diff/types.ts`
2. `src/components/diff/model.ts`
3. `src/components/review-comment-threads.ts`
4. `src/components/diff/model.test.ts`
5. `src/components/review-comment-threads.test.ts`

### B. Shared comment behavior

6. `src/components/review-comment-item.tsx`
7. `src/components/review-comment-reply-composer.tsx`
8. `src/hooks/use-review-comment-reply.ts`
9. `src/hooks/use-review-comment-edit.ts`
10. `src/components/review-comment-item.test.tsx`
11. `src/components/review-comment-reply-composer.test.tsx`

### C. Thread controllers

12. `src/components/inline-comment-thread.tsx`
13. `src/app/gh/[owner]/[repo]/pull/[number]/_components/review-comments.tsx`
14. `src/components/__tests__/components/inline-comment-thread.test.tsx`
15. `src/app/gh/[owner]/[repo]/pull/[number]/_components/review-comments.test.tsx`

### D. Diff interaction and rendering

16. `src/components/diff/use-diff-line-selection.ts`
17. `src/components/diff/use-diff-comment-selection.ts`
18. `src/components/diff/use-diff-hash-navigation.ts`
19. `src/components/diff/use-diff-syntax-highlighting.ts`
20. `src/components/diff/diff-line-comment-editor.tsx`
21. `src/components/diff/diff-context-row.tsx`
22. `src/components/diff/diff-line-row.tsx`
23. `src/components/diff/diff-block-rows.tsx`
24. `src/components/diff/diff-table.tsx`
25. `src/components/diff-view.tsx`
26. `src/__tests__/components/diff-view.test.tsx`

### E. File shell and content policy

27. `src/components/file-diff-source.ts`
28. `src/components/use-file-diff-state.ts`
29. `src/components/use-file-comment-actions.ts`
30. `src/components/file-diff-header.tsx`
31. `src/components/file-comment-editor.tsx`
32. `src/components/file-comment-threads.tsx`
33. `src/components/hidden-diff-notice.tsx`
34. `src/components/file-diff.tsx`
35. `src/__tests__/components/file-diff.test.tsx`
36. `src/components/file-diff-source.test.ts`

### F. Media behavior

37. `src/components/diff-mode-toggle.tsx`
38. `src/components/image-diff.tsx`
39. `src/components/media-diff/image-with-fallback.tsx`
40. `src/components/svg-diff.tsx`
41. `src/components/media-diff/use-svg-contents.ts`
42. `src/components/media-diff/svg-preview.tsx`
43. `src/components/diff-mode-toggle.test.tsx`

This order lets a reviewer validate pure compatibility contracts first, then shared mutation behavior, then the two intentionally different shells, and finally the presentation layers that consume those contracts.
