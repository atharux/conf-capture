# Conf Capture

A mobile-first conference companion app: scan business cards, log session notes, record voice memos, and turn any of it into a LinkedIn post before the moment's gone.

## Why this exists

I built this for myself for conferences — I kept meeting people and sitting in sessions with no fast way to capture any of it before the next thing started. It worked well enough that I'm giving it away. No paywall, no account, no tracking. Fork it, put your own name on it, use it at any conference, not tied to one event.

## What it does

- **Scan** — point your camera at a business card (or upload a photo, or type it in by hand), get the fields parsed automatically: name, title, company, email, LinkedIn, phone.
- **Sessions** — log a talk you just watched. Hit **Record Full Talk** and walk away — it records in the background in short rolling segments and extracts session fields from the whole thing when you stop, so one bad segment doesn't cost you the talk. Or record a quick voice note, or just type it. Attach photos (of a slide, the stage, whatever) to any saved session, and delete it individually if you don't want it.
- **Contacts** — everyone you've scanned, with room to add voice notes about follow-ups and how strong the connection felt. Delete any contact individually.
- **Posts** — write your own post directly, always available with zero AI. Optionally record an idea or ask AI to generate/polish what you've written, using a contact, a session, or a general reflection as context — in your own writing voice from a config block you edit once.
- **About** — who built it, how to fork it, a live QR code to the deployed app, and where to clear your data.

No backend, no database, no login, no tracking. Everything — your API key, and every card/session/contact/post you capture — saves to this browser's local storage, so closing the tab or reopening the app days later doesn't lose anything. It's all local to your device: nothing syncs, nothing leaves the browser except calls to whichever AI provider you choose. Export contacts as a `.vcf` (drops straight into your phone's address book) and sessions/posts as `.md` from each tab, or clear everything at once from the About tab. It's also installable — add it to your homescreen from the browser's share/install menu and it opens like a real app.

## Using it

1. Open the app — it works immediately with no setup. Scan cards, log sessions, and add contacts entirely by hand, no AI or key required.
2. Want AI help (auto-parsing card photos, voice notes, drafting/polishing posts)? Tap the key icon top-right and pick a provider:
   - **Anthropic** — full features, including voice notes.
   - **OpenRouter (free)** — card scanning and post help for free, using whichever free models are currently live on OpenRouter (checked automatically, no manual picking). Voice notes aren't available on this path — type your notes instead.
3. Everything works together from there — scan or type a card, log a session by hand or with a voice note, and write your own post (or let AI draft/polish it) whenever you're ready to post it.

## Making it yours

Everything personal lives in one block at the top of `src/wearedev-capture.jsx`:

```js
const USER_CONFIG = {
  name: "...",
  brand: "...",
  role: "...",
  website: "...",
  hiringUrl: "...",
  githubRepo: "...",
  appUrl: "...",
  writingStyle: `...`, // how you want generated posts to sound
};
```

Want your own icon on the homescreen instead of the default mark? Swap `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, and `public/apple-touch-icon.png`, and update `public/manifest.json`'s `name`/`short_name`.

Edit that, nothing else needs to change. The rest of the file reads from it — nothing else is hardcoded to me.

## Running it locally

```bash
npm install
npm run dev
```

## Deploying

Built with Vite, deploys anywhere static. This copy runs on Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- Connect the repo in the Cloudflare dashboard for auto-deploy on push.

## License

MIT — see [LICENSE](LICENSE). Take it, change it, ship it.
