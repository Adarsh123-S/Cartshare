# CartShare

A collaborative shopping cart for dorms, office teams and travel groups. Create or join a room with a code, add items to a shared cart that updates live across browser tabs, watch an activity log, and print an audit-ready receipt.

## Features

- **Rooms** – enter your name and a room code (or click *Generate*) to create or join a room.
- **Shared cart** – add items (name, price, quantity), change quantities, remove items. Every item records who added it.
- **Live sync** – changes appear instantly in every other tab in the same room (via the browser `storage` event).
- **Delivery threshold tracker** – editable free-shipping goal (default $75) with a progress bar and "add $X more" message.
- **Participants list** – online/offline status and each person's contribution.
- **Activity log** – timestamped record of joins, leaves, adds, removes, quantity changes.
- **Printable receipt** – items, grand total, equal-split balances per person, full audit trail and signature line, styled with CSS `@media print`.
- **Responsive** – Bootstrap 5 grid + Flexbox; works on phones and desktops.

## Folder structure

```
cartshare/
├── index.html
├── css/style.css
├── js/app.js
├── assets/logo.svg
└── README.md
```

## Run locally

No build step needed.

1. Clone the repo and open the folder.
2. Serve it (recommended, so all browsers allow storage events):
   ```
   python3 -m http.server 8000
   ```
   then visit http://localhost:8000. (Double-clicking `index.html` also works in most browsers.)

## Simulate multiple users

1. Open the app in **two or more tabs** of the same browser (same address).
2. In each tab use a different name but the **same room code**.
3. Add or remove items in one tab and watch the others update. Use **Print receipt** to view the receipt.

> Note: sync works across tabs/windows of one browser profile, because data is kept in `localStorage`. Each tab remembers its own user via `sessionStorage`.

## Deploy

- **Netlify / Vercel:** drag-and-drop the folder or import the GitHub repo; no build command, publish directory is the root.
- **GitHub Pages:** Settings → Pages → deploy from the `main` branch, root folder.

## Submission checklist

- [ ] Repo pushed to GitHub with this README
- [ ] Live URL works
- [ ] Portal name format: `BatchID_FullName_CartShare`

## Tech

HTML5, CSS3 (Flexbox/Grid + Bootstrap 5.3), vanilla JavaScript, `localStorage`, `sessionStorage`, `storage` event, `@media print`.
