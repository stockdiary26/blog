# parkmikyoung blog

Personal blog with Diary and Archive sections, post editing, media uploads, category management, and administrator sign-in.

## Run locally

Requires Node.js. No external packages are required.

```sh
npm start
```

Open http://localhost:3002. Set the PORT environment variable to use another port (the current local preview uses 3003).

Posts, categories, section settings, and uploaded media are stored in `data/`.
Administrator credentials are stored locally in `data/admin.json` and excluded from Git. On a fresh checkout, use Sign in to configure an administrator account.

See AGENTS.md for maintenance guidance.
