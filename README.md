# Conf Capture

A mobile-first conference companion app: scan business cards, log session notes, record voice memos, and turn any of it into a LinkedIn post before the moment's gone.

## Why this exists

I built this for myself for conferences — I kept meeting people and sitting in sessions with no fast way to capture any of it before the next thing started. It worked well enough that I'm giving it away. No paywall, no account, no tracking. Fork it, put your own name on it, use it at any conference, not tied to one event.

## What it does

- **Scan** — point your camera at a business card (or upload a photo), get the fields parsed automatically: name, title, company, email, LinkedIn, phone.
- **Sessions** — log a talk you just watched. Record a voice note or type it — speaker, key insight, a quote or stat, an action item, a 1–5 rating.
- **Contacts** — everyone you've scanned, with room to add voice notes about follow-ups and how strong the connection felt.
- **Posts** — turn a contact, a session, or a raw idea into a LinkedIn post in your own writing voice, generated from a config block you edit once.
- **About** — who built it, how to fork it, a live QR code to the deployed app.

No backend, no database, no login, no tracking. Captured cards, sessions, contacts, and posts live in React state for the browser tab — close it and that data is gone (nothing to leak, nothing to lose control of). Your API key is the one exception: it's saved to this browser's local storage so you're not re-entering it every time you open the app, and you can clear it anytime from the key modal ("Forget key").

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
  event: "...",
  eventLocation: "...",
  eventYear: "...",
  website: "...",
  hiringUrl: "...",
  githubRepo: "...",
  appUrl: "...",
  writingStyle: `...`, // how you want generated posts to sound
};
```

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
