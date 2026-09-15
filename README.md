# CTRI — Centar za tehnološki razvoj Istarske županije

Public site, searchable equipment catalogue, member accounts and an hourly
booking system for the Centre's makerspace. Croatian and English, light and
dark, ready to deploy to Netlify.

---

## Deploy

```bash
npm install
npm run build      # → dist/
```

Push the repo and connect it on Netlify — `netlify.toml` already sets the build
command, publish directory, functions directory and redirects. **No environment
variables are required** and there is no database to provision: state lives in
[Netlify Blobs](https://docs.netlify.com/blobs/overview/), which is part of the
deploy.

The first request creates the administrator account:

| Username | Password |
| -------- | -------- |
| `admin`  | `admin`  |

The admin panel shows a red banner until that password is changed
(**Moj račun → Sigurnost**). Change it before the site is public.

## Local development

```bash
npm run dev        # http://localhost:5173 — app + API
npm start          # netlify dev, if you want the real Netlify runtime
npm run test:api   # 53 API tests, no server needed
```

`npm run dev` mounts the Netlify function as Vite middleware (see
`vite.config.js`), so the whole app works without the Netlify CLI. Outside the
Netlify runtime, Blobs are unavailable, so the store falls back to JSON files in
`.netlify/blobs-local/` — delete that directory to reset local data.

---

## How access works

There is no public sign-up. The flow is deliberate:

1. **Apply** — `/apply`. Three applicant types (student, individual, company),
   each with its own fields, plus a free-text explanation of the project. The
   applicant gets a reference number like `CTRI-2026-0001`.
2. **Review** — the application lands in **Administracija → Prijave** with
   everything the applicant submitted.
3. **Approve** — creates an account with a generated username (`ime.prezime`)
   and a temporary password, and returns a one-time activation link. The panel
   shows all three plus a ready-to-send message in the admin's current
   language; each has a copy button.
4. **Activate** — the link opens `/set-password`. The member sets their own
   password, which burns the link and invalidates any other session.
5. **Book** — `/book`, or the button on any equipment page.

Approval never emails anyone. The admin copies the details and sends them
however they like. To add email later, send `credentials.inviteUrl` from
`handleApproveApplication` in `netlify/functions/api.js` — everything else is
already in place.

Admins can also create accounts directly (**Korisnici → Dodaj korisnika**),
reset a member's password, promote or demote admins, and deactivate accounts.
An admin cannot demote or deactivate themselves.

## How booking works

Hourly slots, **Mon–Sat 08:00–20:00**, Sunday closed. Opening hours live in
`src/lib/schedule.js` and are shared by the browser and the server, so both
agree on what a valid slot is — and the server re-validates every request.

Each catalogue entry has a quantity; that is its capacity. Six workbenches mean
six people can book 10:00 on Tuesday. The grid shows remaining units per hour.

**Safety-critical equipment requires an induction.** Ten items are marked
`restricted` — table saw, mitre saw, planer, drill press, router, drill/grinder
set, belt sander, multi-tool, compressor and the 3D printer. For those:

- a member **without** a recorded induction gets a booking with status
  `pending`, which an admin approves under **Rezervacije**;
- a member **with** one (ticked in **Obuke**) is confirmed immediately.

Everything else confirms on the spot. Pending bookings hold capacity, so an
approval can never overbook.

---

## The equipment catalogue

`src/data/tools.json` — **68 entries, 138 physical units**, built from the
procurement documents in `tools/`:

| Source | Contents |
| ------ | -------- |
| Group 2 | IT equipment and machines |
| Group 3 | Tools for research and innovation work (78 line items) |
| Group 4 | Electrical machines, apparatus and consumables (29 line items) |
| CamTech, Holex, SB Commerce, Tokić | Supplier quotes |

Line items were sorted into three buckets and only the third is catalogued:

- **Furniture and storage** — cabinets, pegboards, clothing rails, bins,
  first-aid cabinets, extinguishers, chairs. Not listed.
- **Consumables** — filament, solder, flux, wire, abrasives, saw blades, drill
  bits, board stock, tape, cable ties, PPE coveralls. Not listed.
- **Tools, machines, instruments and computers** — catalogued, searchable, and
  bookable where booking makes sense.

28 entries are bookable. The other 40 are listed as **free to use**: a 300 mm
clamp or a hex key set is worth finding in the catalogue, but reserving one by
the hour is not.

Each entry carries bilingual name, summary and description, specifications,
quantity, supplier and model where known, a per-tool session cap, and
`tags` — bilingual search synonyms, so "lemljenje", "soldering" and "tinol" all
find the soldering station.

Search is diacritic-insensitive and matches on word prefixes across both
languages, so `skener` and `scanner` both work, and `pila` finds the saws
without matching `ljepila`.

---

## Design

Taken from the brand sheet in `design/`:

| Token | Value | Use |
| ----- | ----- | --- |
| Navy | `#142B3B` | dark background, light-mode text |
| Teal | `#019C98` | eyebrows, accents, the mark's middle ring |
| Coral | `#F15B42` | primary actions, the full stop in the wordmark |

Both themes are built from the same tokens in `src/styles/tokens.css`; dark mode
is `[data-theme="dark"]` on `<html>`, applied before first paint by an inline
script so the page never flashes. The theme follows the operating system until
the visitor picks one, after which their choice is remembered.

Typeface is **Figtree**, the closest widely available match to the geometric
sans on the brand sheet, with the Latin Extended subset for Croatian
diacritics. The mark is drawn as SVG in `src/components/Logo.jsx`: the two dark
rings use `currentColor` so it inverts with the theme, while the teal ring and
the coral dot stay fixed.

### Placeholders to fill in

Marked in the UI with a dashed border, and all in `src/i18n/{hr,en}.js` under
`about.contact`:

- **Address** — `about.contact.address`
- **Phone** — `about.contact.phone`
- **Email** — `about.contact.email` (currently `kontakt@ctri.hr`)
- Opening hours are set to Mon–Sat 08:00–20:00; if that is wrong, change
  `OPEN_HOUR`, `CLOSE_HOUR` and `OPEN_DAYS` in `src/lib/schedule.js`.
- Footer links for terms, privacy and accessibility point at `/about` until
  real documents exist.

---

## Security notes

- Passwords are hashed with **PBKDF2-SHA256, 210 000 iterations**, per-user
  salt, compared in constant time. Web Crypto only — no native dependencies.
- Sessions are HMAC-SHA256-signed tokens in an **httpOnly, SameSite=Lax**
  cookie, `Secure` over HTTPS, valid 14 days. Changing a password bumps a
  serial that invalidates every other session.
- Invite links are signed, expire in 14 days, and are single-use — issuing a new
  one or setting a password invalidates the previous link.
- Accounts lock for 15 minutes after 8 failed sign-ins.
- Unknown usernames still run a password comparison, so response timing does not
  reveal whether an account exists.
- Every input is trimmed and length-capped server-side; the client's validation
  is a convenience, not the check.

## Known limitations

- **Write concurrency.** Each collection is one JSON document read, modified and
  written back. Bookings re-check capacity against the freshest copy before
  committing, which closes the common case, but two writes landing in the same
  few milliseconds could still interleave. That is fine for a centre of this
  size; if it ever isn't, move `netlify/functions/_lib/store.js` to Postgres and
  add a unique constraint.
- **Time zone.** Slots are computed in the runtime's local time. Netlify
  functions run in UTC, so pin the site to `Europe/Zagreb` (`TZ` in
  Netlify's environment settings) if the Centre's hours must be exact.
- **No email.** By design, for now — see above.

## Layout

```
src/
  data/tools.json        the catalogue — edit here to change equipment
  i18n/{hr,en}.js        all copy, key-for-key identical
  lib/schedule.js        opening hours and slot maths (shared with the API)
  lib/tools.js           search, filtering, sorting
  pages/                 one file per route
  styles/tokens.css      the palette, both themes
netlify/functions/
  api.js                 every /api/* route
  _lib/                  crypto, storage, HTTP helpers, domain rules
scripts/test-api.mjs     API test suite
```
