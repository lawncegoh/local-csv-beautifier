# Local CSV Beautifier

A privacy-first, browser-only CSV cleanup app.

## Features

- Upload a CSV/TSV or paste CSV text
- Parse and clean CSV locally (no backend)
- Normalize headers to clean `snake_case`
- Optional duplicate header repair
- Trim whitespace in every cell
- Collapse internal whitespace
- Remove empty rows
- Remove duplicate rows
- Optional number/date normalization
- Normalize null-like values (`N/A`, `NULL`, `-`, etc.) to blanks
- Optional stripping of outer quotes
- Preview cleaned output
- Download cleaned CSV + change log
- Save/load profiles in localStorage (local only)

## Run

Open `index.html` and load a file or paste CSV text.

1. Choose a CSV file or paste text
2. Adjust options
3. Click **Run cleanup**
4. Download `cleaned-YYYY-MM-DD.csv`

## Privacy and data leakage guardrails

- All work happens in your browser. No file contents are sent anywhere.
- Profile settings can be saved in `localStorage`. File content stays in memory only.
- Cleaned output is generated in-browser and downloaded locally.
- Use only on trusted devices; browser extensions or malware can still expose local clipboard/session content.

## SEO setup for production

- Replace all `https://your-domain.com/` placeholders in:
  - `index.html` (`canonical`, OG/Twitter metadata, JSON-LD URL)
  - `robots.txt`
  - `sitemap.xml`
- Add a real `og-image.svg` or `og-image.png` matching the `og:image` URL.
- Add one or two pages with real examples and link them from the homepage.
- Keep titles and headings focused on real search terms, for example:
  - `local CSV cleaner`
  - `offline CSV beautifier`
  - `browser based CSV formatter`
- Push updates frequently (even short changelog entries) to keep crawlers active.

## AdSense setup (placeholder-ready)

- In `index.html`, replace all `ca-pub-0000000000000000` and `data-ad-slot` placeholders with your approved AdSense values.
- Place ad blocks in non-intrusive spots (sidebar/footer).
- Add clear privacy/compliance disclosure for ads and cookies.
- Keep ad code behind your approved configuration only after AdSense account approval.

## Deploy without Netlify

- Preferred path: **GitHub Pages**
  - Push this repo to GitHub on `main`.
  - Enable Pages deployment in Settings > Pages (deploy from GitHub Actions), which uses:
    - `.github/workflows/deploy-pages.yml`
  - Ensure production branch is `main` and files are in repo root.
- Alternative path: **Cloudflare Pages**
  - Connect your Git repo in Cloudflare dashboard
  - Build output dir: `/`
  - Framework preset: `None`
  - Deploy.
