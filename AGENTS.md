# Blog maintenance

- app-core.js owns shared state, menu descriptions, list/card rendering, routing and refresh. Do not reassign or wrap render/refresh in another module.
- app-start.js performs the only initial refresh, after every module is loaded.
- detail-page.js renders post details only through renderPostDetail; navigation goes through app-core.js.
- taxonomy.js handles the administration dialog only. After mutations, call refresh; do not render lists or rebuild navigation separately.
- inline-blocks.js owns post editing; post-links.js owns text linkification; auth-controls.js listens for auth-state-changed.
- Keep current CSS, mobile behavior, data and server API intact when changing presentation. archive-overview.js is retired and must not be loaded.
- Verify Home / Diary / Archive / new menu, child filtering, sidebar return, browser back, reload, login, post create/edit/delete, admin add/rename/delete, mobile styles.
- Test CRUD with separate fixture data. Do not use real posts for destructive tests.