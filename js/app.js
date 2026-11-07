/* CartShare – collaborative shared cart
 * Data lives in localStorage (shared by all tabs of the same origin).
 * The current user lives in sessionStorage (so each tab can be a different person).
 * Other tabs are notified through the "storage" event.
 */
(() => {
  'use strict';

  const ROOM_PREFIX = 'cartshare:room:';
  const SESSION_KEY = 'cartshare:session';
  const ONLINE_MS = 25000;
  const HEARTBEAT_MS = 8000;
  const LOG_LIMIT = 100;

  const $ = (id) => document.getElementById(id);
  const money = (n) => '$' + Number(n).toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const timeStr = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let me = null;      // { name, room }
  let heartbeat = null;

  /* ---------- storage helpers ---------- */
  const roomKey = (code) => ROOM_PREFIX + code;

  function emptyRoom() {
    return { items: [], log: [], members: {}, threshold: 75, created: Date.now() };
  }

  function loadRoom(code) {
    try {
      const raw = localStorage.getItem(roomKey(code));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveRoom(code, room) {
    try { localStorage.setItem(roomKey(code), JSON.stringify(room)); }
    catch (e) { alert('Could not save – browser storage is full or blocked.'); }
  }

  /* read -> modify -> write -> render */
  function mutate(fn) {
    if (!me) return;
    const room = loadRoom(me.room) || emptyRoom();
    fn(room);
    room.members[me.name] = Date.now();
    if (room.log.length > LOG_LIMIT) room.log = room.log.slice(-LOG_LIMIT);
    saveRoom(me.room, room);
    render(room);
  }

  function addLog(room, text) {
    room.log.push({ t: Date.now(), who: me.name, text });
  }

  /* ---------- join / leave ---------- */
  function showView(inRoom) {
    $('joinView').classList.toggle('d-none', inRoom);
    $('roomView').classList.toggle('d-none', !inRoom);
  }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }

  function enterRoom(name, code) {
    me = { name, room: code };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(me)); } catch (e) {}
    const existing = loadRoom(code);
    mutate((room) => {
      const alreadyIn = Object.prototype.hasOwnProperty.call(room.members, name) && existing;
      addLog(room, existing ? (alreadyIn ? 'rejoined the room' : 'joined the room') : 'created the room');
    });
    $('roomLabel').textContent = code;
    $('meLabel').textContent = name;
    showView(true);
    startHeartbeat();
  }

  function leaveRoom() {
    if (!me) return;
    mutate((room) => {
      addLog(room, 'left the room');
      delete room.members[me.name];
    });
    // mutate() re-adds the member after fn; remove again.
    const room = loadRoom(me.room);
    if (room) { delete room.members[me.name]; saveRoom(me.room, room); }
    clearInterval(heartbeat);
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    me = null;
    showView(false);
  }

  function startHeartbeat() {
    clearInterval(heartbeat);
    heartbeat = setInterval(() => {
      if (!me) return;
      const room = loadRoom(me.room);
      if (!room) return;
      room.members[me.name] = Date.now();
      saveRoom(me.room, room);
      render(room);
    }, HEARTBEAT_MS);
  }

  /* ---------- rendering ---------- */
  function render(room) {
    if (!room || !me) return;
    renderThreshold(room);
    renderCart(room);
    renderMembers(room);
    renderLog(room);
  }

  function total(room) {
    return room.items.reduce((s, i) => s + i.price * i.qty, 0);
  }

  function renderThreshold(room) {
    const t = total(room);
    const goal = Number(room.threshold) || 75;
    const pct = Math.min(100, (t / goal) * 100);
    $('totalLabel').textContent = 'Cart total: ' + money(t);
    if (document.activeElement !== $('thresholdInput')) $('thresholdInput').value = goal;
    const bar = $('progressBar');
    bar.style.width = pct + '%';
    bar.classList.toggle('bg-success', t >= goal);
    const msg = $('thresholdMsg');
    if (t >= goal) {
      msg.textContent = '🎉 Free shipping unlocked!';
      msg.className = 'small mt-2 mb-0 text-success fw-semibold';
    } else {
      msg.textContent = `Add ${money(goal - t)} more to unlock free shipping.`;
      msg.className = 'small mt-2 mb-0 text-muted';
    }
  }

  function renderCart(room) {
    const has = room.items.length > 0;
    $('cartEmpty').classList.toggle('d-none', has);
    $('cartTable').classList.toggle('d-none', !has);
    $('cartBody').innerHTML = room.items.map((i) => `
      <tr>
        <td>${esc(i.name)}</td>
        <td><span class="badge text-bg-light border">${esc(i.addedBy)}</span></td>
        <td class="text-end">${money(i.price)}</td>
        <td class="qty-btns text-nowrap">
          <button class="btn btn-sm btn-outline-secondary" data-act="dec" data-id="${i.id}" aria-label="Decrease quantity">−</button>
          <span class="mx-1">${i.qty}</span>
          <button class="btn btn-sm btn-outline-secondary" data-act="inc" data-id="${i.id}" aria-label="Increase quantity">+</button>
        </td>
        <td class="text-end">${money(i.price * i.qty)}</td>
        <td class="text-end"><button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${i.id}" aria-label="Remove ${esc(i.name)}">✕</button></td>
      </tr>`).join('');
  }

  function renderMembers(room) {
    const now = Date.now();
    const names = Object.keys(room.members).sort();
    $('memberList').innerHTML = names.map((n) => {
      const online = now - room.members[n] < ONLINE_MS;
      const spent = room.items.filter((i) => i.addedBy === n).reduce((s, i) => s + i.price * i.qty, 0);
      return `<li class="d-flex justify-content-between py-1">
        <span><span class="member-dot" style="background:${online ? '#198754' : '#adb5bd'}"></span>${esc(n)}${n === me.name ? ' (you)' : ''}</span>
        <span class="text-muted small">${money(spent)}</span></li>`;
    }).join('') || '<li class="text-muted">No one here yet.</li>';
  }

  function renderLog(room) {
    $('logList').innerHTML = room.log.slice().reverse().map((l) =>
      `<li><strong>${esc(l.who)}</strong> ${esc(l.text)}<time>${timeStr(l.t)}</time></li>`).join('');
  }

  /* ---------- receipt ---------- */
  function buildReceipt() {
    const room = loadRoom(me.room);
    if (!room) return;
    const t = total(room);
    const rows = room.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.addedBy)}</td>
      <td class="num">${money(i.price)}</td><td class="num">${i.qty}</td><td class="num">${money(i.price * i.qty)}</td></tr>`).join('');

    const per = {};
    room.items.forEach((i) => { per[i.addedBy] = (per[i.addedBy] || 0) + i.price * i.qty; });
    const people = Object.keys(per).sort();
    const share = people.length ? t / people.length : 0;
    const splitRows = people.map((n) => {
      const diff = per[n] - share;
      return `<tr><td>${esc(n)}</td><td class="num">${money(per[n])}</td><td class="num">${money(share)}</td>
        <td class="num">${diff >= 0 ? 'is owed ' + money(diff) : 'owes ' + money(-diff)}</td></tr>`;
    }).join('');

    const logRows = room.log.map((l) =>
      `<tr><td>${new Date(l.t).toLocaleString()}</td><td>${esc(l.who)}</td><td>${esc(l.text)}</td></tr>`).join('');

    $('receipt').innerHTML = `
      <h1>CartShare Receipt</h1>
      <div class="meta">Room ${esc(me.room)} &middot; Printed ${new Date().toLocaleString()} by ${esc(me.name)}</div>
      <h2>Items</h2>
      <table><thead><tr><th>Item</th><th>Added by</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Total</th></tr></thead>
        <tbody>${rows}
        <tr class="grand"><td colspan="4">GRAND TOTAL</td><td class="num">${money(t)}</td></tr></tbody></table>
      <p>Free-shipping goal: ${money(room.threshold)} &mdash; ${t >= room.threshold ? 'reached' : 'not reached'}</p>
      <h2>Expense split (equal shares among contributors)</h2>
      <table><thead><tr><th>Person</th><th class="num">Added</th><th class="num">Fair share</th><th class="num">Balance</th></tr></thead>
        <tbody>${splitRows}</tbody></table>
      <h2>Audit trail</h2>
      <table><thead><tr><th>Time</th><th>Who</th><th>Action</th></tr></thead><tbody>${logRows}</tbody></table>
      <div class="sig">Signed: ______________________ &nbsp; Date: ______________</div>`;
  }

  /* ---------- event wiring ---------- */
  $('genCode').addEventListener('click', () => { $('roomCode').value = genCode(); });

  $('joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('userName').value.trim();
    const code = $('roomCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const err = $('joinError');
    if (!name || !code) {
      err.textContent = 'Please enter both your name and a room code.';
      err.classList.remove('d-none');
      return;
    }
    err.classList.add('d-none');
    enterRoom(name, code);
  });

  $('leaveBtn').addEventListener('click', leaveRoom);

  $('copyCode').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(me.room);
      $('copyCode').textContent = 'Copied!';
    } catch (e) {
      $('copyCode').textContent = me.room;
    }
    setTimeout(() => { $('copyCode').textContent = 'Copy code'; }, 1500);
  });

  $('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('itemName').value.trim();
    const price = parseFloat($('itemPrice').value);
    const qty = Math.max(1, parseInt($('itemQty').value, 10) || 1);
    if (!name || !(price > 0)) {
      (name ? $('itemPrice') : $('itemName')).focus();
      return;
    }
    mutate((room) => {
      room.items.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, price, qty, addedBy: me.name });
      addLog(room, `added ${qty} × ${name} (${money(price)})`);
    });
    $('addForm').reset();
    $('itemQty').value = 1;
    $('itemName').focus();
  });

  $('cartBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    mutate((room) => {
      const idx = room.items.findIndex((i) => i.id === id);
      if (idx < 0) return;
      const item = room.items[idx];
      if (act === 'del') {
        room.items.splice(idx, 1);
        addLog(room, `removed ${item.name}`);
      } else if (act === 'inc') {
        item.qty += 1;
        addLog(room, `increased ${item.name} to ${item.qty}`);
      } else if (act === 'dec') {
        if (item.qty <= 1) { room.items.splice(idx, 1); addLog(room, `removed ${item.name}`); }
        else { item.qty -= 1; addLog(room, `decreased ${item.name} to ${item.qty}`); }
      }
    });
  });

  $('thresholdInput').addEventListener('change', () => {
    const v = parseFloat($('thresholdInput').value);
    if (!(v > 0)) return;
    mutate((room) => {
      if (room.threshold !== v) { room.threshold = v; addLog(room, `set the free-shipping goal to ${money(v)}`); }
    });
  });

  $('printBtn').addEventListener('click', () => {
    buildReceipt();
    window.print();
  });

  /* Real-time sync: fires in OTHER tabs whenever this room's data changes */
  window.addEventListener('storage', (e) => {
    if (!me || e.key !== roomKey(me.room)) return;
    const room = e.newValue ? JSON.parse(e.newValue) : null;
    if (room) render(room);
  });

  window.addEventListener('beforeunload', () => {
    if (!me) return;
    const room = loadRoom(me.room);
    if (room) { room.members[me.name] = 0; saveRoom(me.room, room); }
  });

  /* Restore session after a reload in the same tab */
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (saved && saved.name && saved.room) {
      me = saved;
      $('roomLabel').textContent = me.room;
      $('meLabel').textContent = me.name;
      showView(true);
      mutate(() => {});
      startHeartbeat();
    }
  } catch (e) {}
})();
