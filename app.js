/* La Maison des Souhaits: interactive wishlist on top of assets/salon.jpg */
(() => {
  "use strict";
  const CFG = window.MDS_CONFIG || {};
  const SCENE = window.MDS_SCENE;
  const DEMO = !(CFG.supabaseUrl && CFG.supabaseAnonKey);
  const $ = (id) => document.getElementById(id);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touchOnly = matchMedia("(hover: none)").matches;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } },
  };

  let code = store.get("mds-code");
  let wishes = {}; // slot -> {who, what, url}

  /* ---------------- Data access ---------------- */
  async function rpc(fn, args) {
    const key = CFG.supabaseAnonKey;
    const headers = { "Content-Type": "application/json", apikey: key };
    if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key; // legacy JWT anon key
    let res;
    try {
      res = await fetch(CFG.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, {
        method: "POST", headers, body: JSON.stringify(args),
      });
    } catch (e) {
      throw Object.assign(new Error("network"), { kind: "net" });
    }
    if (!res.ok) {
      let msg = "";
      try { msg = (await res.json()).message || ""; } catch (e) { /* not JSON */ }
      const kind = msg.includes("code_invalide") ? "code" : msg.includes("deja_pris") ? "taken"
        : msg.includes("introuvable") ? "gone" : "net";
      throw Object.assign(new Error(msg || "HTTP " + res.status), { kind });
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  const demo = {
    load() {
      try { const d = JSON.parse(store.get("mds-demo") || "null"); if (d) return d; } catch (e) { /* ignore */ }
      return { 17: { who: "Lucie", what: "AirPods 4", url: "https://www.apple.com/fr/airpods-4/", note: "Avec réduction de bruit" },
               23: { who: "Hugo", what: "LEGO Technic", url: "https://www.lego.com/fr-fr/themes/technic" } };
    },
    save(d) { store.set("mds-demo", JSON.stringify(d)); },
  };

  // Sends the "précisions" field. If the database has not been updated yet
  // (supabase/2026-11-precisions.sql not run), saves the wish without it.
  async function withNote(fn, args, note) {
    try {
      await rpc(fn, { ...args, p_note: note || null });
    } catch (e) {
      if (e.kind === "net" && /could not find the function|PGRST202/i.test(e.message)) {
        await rpc(fn, args);
        if (note) setTimeout(() => toast("Souhait enregistré, mais pas les précisions : la base doit être mise à jour.", true), 50);
        return;
      }
      throw e;
    }
  }

  const api = {
    async check(c) { return DEMO ? true : rpc("check_family_code", { p_code: c }); },
    async list() {
      if (DEMO) return demo.load();
      const rows = await rpc("list_wishes", { p_code: code });
      const out = {};
      for (const r of rows || []) out[r.slot] = { who: r.who, what: r.what, url: r.url, note: r.note || "" };
      return out;
    },
    async add(slot, w) {
      if (DEMO) { const d = demo.load(); if (d[slot]) throw Object.assign(new Error(), { kind: "taken" }); d[slot] = w; demo.save(d); return; }
      await withNote("add_wish", { p_code: code, p_slot: slot, p_who: w.who, p_what: w.what, p_url: w.url || null }, w.note);
    },
    async update(slot, w) {
      if (DEMO) { const d = demo.load(); d[slot] = w; demo.save(d); return; }
      await withNote("update_wish", { p_code: code, p_slot: slot, p_who: w.who, p_what: w.what, p_url: w.url || null }, w.note);
    },
    async remove(slot) {
      if (DEMO) { const d = demo.load(); delete d[slot]; demo.save(d); return; }
      await rpc("delete_wish", { p_code: code, p_slot: slot });
    },
  };

  const safeUrl = (u) => (u && /^https?:\/\//i.test(u) ? u : null);
  const normalizeUrl = (u) => { u = (u || "").trim(); if (!u) return ""; return /^https?:\/\//i.test(u) ? u : "https://" + u; };

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg, bad) {
    const t = $("toast");
    t.textContent = msg; t.classList.toggle("bad", !!bad); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
  }

  /* ---------------- Rendering ---------------- */
  const PENCIL = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M11.7 1.3a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L5.6 13.4 2 14l.6-3.6z"/></svg>';

  function render() {
    const hits = $("hits");
    hits.textContent = "";
    const total = SCENE.gifts.length;
    let taken = 0;
    // Tags keep the same size relative to the gifts whatever the scene width
    const k = Math.min(1, Math.max(0.6, ($("hits").clientWidth || 1300) / 1300));
    SCENE.gifts.forEach((g, i) => {
      const w = wishes[i];
      const sz = Math.min(1, Math.max(0.55, g.w / 7.5)) * k;
      const ax = ((g.ax - g.x) / g.w) * 100 + "%";
      const ky = ((g.ay + 2.2 - g.y) / g.h) * 100;

      const slot = document.createElement("div");
      slot.className = "slot";
      Object.assign(slot.style, { position: "absolute", left: g.x + "%", top: g.y + "%", width: g.w + "%", height: g.h + "%" });
      slot.style.setProperty("--s", sz.toFixed(2));

      let el;
      if (w) {
        taken++;
        const url = safeUrl(w.url);
        el = document.createElement(url && !touchOnly ? "a" : "button");
        if (el.tagName === "A") { el.href = url; el.target = "_blank"; el.rel = "noopener"; }
        else { el.type = "button"; el.addEventListener("click", () => openDetail(i)); }
        el.setAttribute("aria-label", `${w.what}, souhaité par ${w.who}` + (url && !touchOnly ? ". Ouvrir l'article" : ""));

        const twine = document.createElement("span");
        twine.className = "twine"; twine.style.left = ax; twine.style.top = ky + "%";
        const tag = document.createElement("span");
        tag.className = "tag"; tag.style.left = ax; tag.style.top = `calc(${ky}% + ${(7 * sz).toFixed(1)}px)`;
        tag.style.setProperty("--rot", (i % 2 ? 5 : -5) + "deg"); tag.style.animationDelay = -(i * 0.7) + "s";
        const who = document.createElement("span"); who.className = "who"; who.textContent = w.who;
        const what = document.createElement("span"); what.className = "what"; what.textContent = w.what;
        const go = document.createElement("span"); go.className = "go"; go.textContent = url ? "Voir l'article ↗" : "Sans lien";
        tag.append(who, what);
        if (w.note) { const nt = document.createElement("span"); nt.className = "note"; nt.textContent = w.note; tag.append(nt); }
        tag.append(go);
        el.append(twine, tag);

        const edit = document.createElement("button");
        edit.type = "button"; edit.className = "edit"; edit.innerHTML = PENCIL;
        edit.setAttribute("aria-label", `Modifier le souhait de ${w.who}`);
        edit.style.left = `calc(${ax} + 22px)`; edit.style.top = ky + "%";
        edit.addEventListener("click", (e) => { e.stopPropagation(); openEdit(i); });
        slot.append(el, edit);
      } else {
        el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", "Cadeau libre : ajouter un souhait");
        const plus = document.createElement("span");
        plus.className = "plus"; plus.textContent = "+"; plus.style.left = ax; plus.style.top = ((g.ay - g.y) / g.h) * 100 + "%";
        el.append(plus);
        el.addEventListener("click", () => openAdd(i));
        slot.append(el);
      }
      el.classList.add("gift");
      Object.assign(el.style, { position: "absolute", inset: "0" });
      hits.append(slot);
    });
    const free = total - taken;
    const all = Object.keys(wishes).length, extra = all - taken;
    $("count").textContent = `${all} souhait${all > 1 ? "s" : ""} · ` +
      (free ? `${free} libre${free > 1 ? "s" : ""}` : "sapin complet");
    $("sack").hidden = extra < 1;
    $("sack-tag").textContent = `+${extra} souhait${extra > 1 ? "s" : ""}`;
    if (flashSlot !== null) {
      const el = $("hits").children[flashSlot];
      if (el) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 3400); }
      flashSlot = null;
    }
    if (!$("list").hidden) renderList();
  }

  /* ---------------- Free slot, list view ---------------- */
  const MAX_SLOT = 199;
  let flashSlot = null;
  function firstFreeSlot() {
    for (let i = 0; i <= MAX_SLOT; i++) if (!wishes[i]) return i;
    return -1;
  }
  const isOverflow = (i) => i >= SCENE.gifts.length;

  function renderList() {
    const body = $("list-body");
    body.textContent = "";
    const entries = Object.entries(wishes).map(([slot, w]) => ({ slot: +slot, ...w }));
    const n = entries.length;
    $("list-sub").textContent = n
      ? `${n} souhait${n > 1 ? "s" : ""}, classés par prénom.`
      : "";
    if (!n) {
      const p = document.createElement("p"); p.className = "list-empty";
      p.textContent = "Aucun souhait pour l'instant. Clique sur un cadeau au pied du sapin, ou sur « Ajouter un souhait ».";
      body.append(p); return;
    }
    const groups = new Map();
    for (const e of entries) {
      const key = e.who.trim().toLocaleLowerCase("fr");
      if (!groups.has(key)) groups.set(key, { name: e.who.trim(), items: [] });
      groups.get(key).items.push(e);
    }
    [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" })).forEach((g) => {
      const sec = document.createElement("section"); sec.className = "person";
      const h = document.createElement("h3"); h.textContent = g.name;
      const c = document.createElement("small"); c.textContent = `${g.items.length} souhait${g.items.length > 1 ? "s" : ""}`;
      h.append(c);
      const ul = document.createElement("ul");
      g.items.sort((a, b) => a.slot - b.slot).forEach((e) => {
        const li = document.createElement("li");
        const item = document.createElement("span"); item.className = "item"; item.textContent = e.what;
        const where = document.createElement("span"); where.className = "where";
        where.textContent = isOverflow(e.slot) ? "Dans la hotte" : "Sous le sapin";
        if (e.note) { const nt = document.createElement("span"); nt.className = "note"; nt.textContent = e.note; item.append(nt); }
        item.append(where);
        li.append(item);
        const url = safeUrl(e.url);
        if (url) {
          const a = document.createElement("a"); a.className = "go"; a.href = url; a.target = "_blank"; a.rel = "noopener";
          a.textContent = "Voir ↗"; a.setAttribute("aria-label", `Voir l'article : ${e.what}`);
          li.append(a);
        }
        const ed = document.createElement("button"); ed.type = "button"; ed.className = "ed"; ed.innerHTML = PENCIL;
        ed.setAttribute("aria-label", `Modifier : ${e.what}`);
        ed.addEventListener("click", () => openEdit(e.slot, "list"));
        li.append(ed);
        ul.append(li);
      });
      sec.append(h, ul);
      body.append(sec);
    });
  }
  function openList() {
    if (!DEMO && !code) return showGate();
    renderList();
    openOverlay("list", $("list-close"));
  }
  function openAddAnywhere(from) {
    if (!DEMO && !code) return showGate();
    const i = firstFreeSlot();
    if (i < 0) { toast("Le sapin et la hotte sont pleins. Libère un souhait pour en ajouter un.", true); return; }
    openAdd(i, from);
  }

  async function refresh(quiet) {
    if (!DEMO && !code) return;
    try {
      wishes = await api.list();
      render();
    } catch (e) {
      if (e.kind === "code") { logout(); showGate("Le code familial a changé. Entre le nouveau code."); }
      else if (!quiet) toast("Impossible de charger les souhaits. Vérifie ta connexion.", true);
    }
  }

  /* ---------------- Overlays ---------------- */
  let lastFocus = null;
  function openOverlay(id, focusEl) {
    lastFocus = document.activeElement;
    for (const o of ["gate", "modal", "detail", "list"]) $(o).hidden = o !== id;
    if (focusEl) setTimeout(() => focusEl.focus(), 30);
  }
  let returnTo = null;
  function closeOverlays() {
    $("modal").hidden = true; $("detail").hidden = true; $("list").hidden = true;
    if (returnTo === "list") { returnTo = null; openList(); return; }
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  // Wish form (add / edit)
  const form = $("wish");
  let mode = "add", cur = null;
  function resetForm() {
    form.reset(); $("wish-err").textContent = ""; $("confirm").hidden = true; $("save").disabled = false;
  }
  function openAdd(i, from) {
    if (!DEMO && !code) return showGate();
    mode = "add"; cur = i; resetForm(); returnTo = from || null;
    $("wish-title").textContent = "Mon souhait";
    $("wish-sub").textContent = isOverflow(i)
      ? "Tous les cadeaux du sapin sont pris : ce souhait ira dans la hotte, près de la cheminée."
      : "Il sera accroché à ce cadeau pour toute la famille.";
    $("free").hidden = true; $("save").textContent = "Terminer";
    const last = store.get("mds-name"); if (last) form.who.value = last;
    openOverlay("modal", last ? form.what : form.who);
  }
  function openEdit(i, from) {
    const w = wishes[i]; if (!w) return;
    mode = "edit"; cur = i; resetForm(); returnTo = from || null;
    $("wish-title").textContent = "Modifier le souhait";
    $("wish-sub").textContent = "Les changements sont visibles par toute la famille.";
    form.who.value = w.who; form.what.value = w.what; form.url.value = w.url || ""; form.note.value = w.note || "";
    $("free").hidden = false; $("save").textContent = "Enregistrer";
    openOverlay("modal", form.what);
  }
  function openDetail(i) {
    const w = wishes[i]; if (!w) return;
    cur = i;
    $("d-who").textContent = w.who; $("d-what").textContent = w.what;
    $("d-note").textContent = w.note || ""; $("d-note").hidden = !w.note;
    const url = safeUrl(w.url);
    $("d-link").hidden = !url; $("d-nolink").hidden = !!url;
    if (url) $("d-link").href = url;
    openOverlay("detail", url ? $("d-link") : $("d-close"));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const who = form.who.value.trim(), what = form.what.value.trim(), url = normalizeUrl(form.url.value), note = form.note.value.trim();
    if (!who) { $("wish-err").textContent = "Écris ton prénom."; form.who.focus(); return; }
    if (!what) { $("wish-err").textContent = "Écris le nom du cadeau."; form.what.focus(); return; }
    if (url && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url)) { $("wish-err").textContent = "Ce lien ne ressemble pas à une adresse web. Copie-le depuis la page de l'article."; form.url.focus(); return; }
    $("save").disabled = true; $("wish-err").textContent = "";
    try {
      if (mode === "add") await api.add(cur, { who, what, url, note });
      else await api.update(cur, { who, what, url, note });
      store.set("mds-name", who);
      if (mode === "add" && !isOverflow(cur) && returnTo !== "list") flashSlot = cur;
      closeOverlays();
      toast(mode === "add" ? "Souhait accroché au sapin" : "Souhait modifié");
      await refresh(true);
    } catch (err) {
      $("save").disabled = false;
      if (err.kind === "taken") { returnTo = null; closeOverlays(); toast("Quelqu'un vient de prendre ce cadeau. Choisis-en un autre.", true); refresh(true); }
      else if (err.kind === "gone") { closeOverlays(); toast("Ce souhait a été retiré entre-temps.", true); refresh(true); }
      else if (err.kind === "code") { logout(); showGate("Le code familial a changé. Entre le nouveau code."); }
      else $("wish-err").textContent = "Impossible d'enregistrer. Vérifie ta connexion et réessaie.";
    }
  });
  $("cancel").addEventListener("click", closeOverlays);
  $("free").addEventListener("click", () => { $("confirm").hidden = false; $("confirm-no").focus(); });
  $("confirm-no").addEventListener("click", () => { $("confirm").hidden = true; $("free").focus(); });
  $("confirm-yes").addEventListener("click", async () => {
    $("confirm-yes").disabled = true;
    try { await api.remove(cur); closeOverlays(); toast("Cadeau libéré"); await refresh(true); }
    catch (err) {
      if (err.kind === "code") { logout(); showGate(); }
      else $("wish-err").textContent = "Impossible de libérer ce cadeau. Réessaie.";
    } finally { $("confirm-yes").disabled = false; }
  });
  $("d-close").addEventListener("click", closeOverlays);
  $("d-edit").addEventListener("click", () => openEdit(cur));
  $("btn-list").addEventListener("click", openList);
  $("btn-add").addEventListener("click", () => openAddAnywhere());
  $("list-add").addEventListener("click", () => openAddAnywhere("list"));
  $("list-close").addEventListener("click", () => { returnTo = null; closeOverlays(); });
  $("sack").addEventListener("click", openList);
  for (const id of ["modal", "detail", "list"]) $(id).addEventListener("click", (e) => { if (e.target === $(id)) { if (id === "list") returnTo = null; closeOverlays(); } });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("list").hidden) returnTo = null;
    closeOverlays();
  });

  /* ---------------- Family code ---------------- */
  function showGate(msg) {
    $("gate-err").textContent = msg || "";
    openOverlay("gate", $("gate-code"));
  }
  function logout() { code = null; store.del("mds-code"); wishes = {}; render(); $("logout").hidden = true; }
  $("gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = $("gate-code").value.trim();
    if (!c) { $("gate-err").textContent = "Entre le code familial."; return; }
    const btn = e.target.querySelector("button"); btn.disabled = true;
    try {
      if (await api.check(c)) {
        code = c; store.set("mds-code", c); $("gate").hidden = true; $("gate-code").value = ""; $("logout").hidden = false;
        await refresh();
      } else $("gate-err").textContent = "Ce n'est pas le bon code.";
    } catch (err) { $("gate-err").textContent = "Impossible de vérifier le code. Vérifie ta connexion."; }
    finally { btn.disabled = false; }
  });
  $("logout").addEventListener("click", () => { logout(); showGate(); });

  /* ---------------- Ambience ---------------- */
  SCENE.twinkle.forEach(([x, y], i) => {
    const d = document.createElement("i");
    d.className = "tw"; d.style.left = x + "%"; d.style.top = y + "%";
    d.style.animationDelay = (-(i * 0.37) % 3).toFixed(2) + "s"; d.style.animationDuration = 2.2 + (i % 5) * 0.4 + "s";
    $("twinkles").append(d);
  });
  (() => {
    const c = $("snow"), x = c.getContext("2d");
    const flakes = [...Array(70)].map(() => ({ x: Math.random() * 276, y: Math.random() * 376, r: 0.6 + Math.random() * 1.8, s: 0.25 + Math.random() * 0.7, o: Math.random() * 6 }));
    function draw(t) {
      x.clearRect(0, 0, 276, 376);
      for (const p of flakes) {
        if (!reduceMotion) { p.y += p.s; p.x += Math.sin(t / 900 + p.o) * 0.25; if (p.y > 380) { p.y = -4; p.x = Math.random() * 276; } }
        x.globalAlpha = 0.55 + p.r * 0.2; x.fillStyle = "#fff"; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
      }
      x.clearRect(130, 0, 10, 376); x.clearRect(0, 182, 276, 10); // window mullions
      if (!reduceMotion && !document.hidden) requestAnimationFrame(draw);
    }
    draw(0);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !reduceMotion) requestAnimationFrame(draw); });
  })();

  /* Burlap sack ("hotte") drawn once on its canvas, lit by the fire on its right */
  (() => {
    const c = $("sack-canvas"), x = c.getContext("2d"), W = c.width, H = c.height;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // floor shadow
    const sh = x.createRadialGradient(W / 2, H - 22, 10, W / 2, H - 22, W * 0.48);
    sh.addColorStop(0, "rgba(0,0,0,.55)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = sh; x.beginPath(); x.ellipse(W / 2, H - 22, W * 0.48, 26, 0, 0, 7); x.fill();
    // gifts peeking out of the opening
    const box = (bx, by, bw, bh, a, col, rib) => {
      x.save(); x.translate(bx, by); x.rotate(a);
      x.fillStyle = col; x.fillRect(-bw / 2, -bh, bw, bh);
      x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(bw / 2 - 8, -bh, 8, bh);
      x.fillStyle = rib; x.fillRect(-6, -bh, 12, bh);
      x.beginPath(); x.ellipse(-12, -bh - 4, 13, 7, -0.4, 0, 7); x.ellipse(12, -bh - 4, 13, 7, 0.4, 0, 7); x.fill();
      x.restore();
    };
    box(140, 150, 90, 80, -0.25, "#7a1420", "#d8b25a");
    box(225, 140, 80, 95, 0.2, "#1d4a32", "#e9dcc4");
    box(185, 120, 60, 60, 0.05, "#d9cbb2", "#9e1622");
    // sack body
    const body = new Path2D();
    body.moveTo(110, 150);
    body.bezierCurveTo(40, 200, 20, 300, 50, 360);
    body.quadraticCurveTo(180, 395, 310, 360);
    body.bezierCurveTo(340, 300, 320, 200, 250, 150);
    body.quadraticCurveTo(180, 175, 110, 150);
    const g = x.createLinearGradient(30, 0, 330, 0);
    g.addColorStop(0, "#4a3220"); g.addColorStop(0.45, "#8a6a44"); g.addColorStop(0.85, "#c09060"); g.addColorStop(1, "#7a5232");
    x.fillStyle = g; x.fill(body);
    x.save(); x.clip(body);
    x.globalAlpha = 0.22; x.strokeStyle = "#2a1a0c"; x.lineWidth = 1;
    for (let i = 0; i < W; i += 5) { x.beginPath(); x.moveTo(i, 140); x.lineTo(i + 8, H); x.stroke(); }
    for (let j = 140; j < H; j += 5) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j + 3); x.stroke(); }
    x.globalAlpha = 1;
    for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "255,220,170" : "40,25,10"},${0.08 + rnd() * 0.1})`; x.fillRect(rnd() * W, 140 + rnd() * 260, 2, 2); }
    const sg = x.createRadialGradient(130, 260, 20, 160, 280, 220);
    sg.addColorStop(0, "rgba(0,0,0,0)"); sg.addColorStop(1, "rgba(0,0,0,.45)"); x.fillStyle = sg; x.fillRect(0, 0, W, H);
    x.restore();
    // folds
    x.strokeStyle = "rgba(30,18,8,.45)"; x.lineWidth = 3;
    [[120, 175, 95, 340], [180, 180, 175, 370], [245, 175, 275, 345]].forEach(([a, b, c2, d]) => { x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo((a + c2) / 2 + 12, (b + d) / 2, c2, d); x.stroke(); });
    // rope tie
    x.strokeStyle = "#d8b25a"; x.lineWidth = 7; x.lineCap = "round";
    x.beginPath(); x.moveTo(108, 168); x.quadraticCurveTo(180, 190, 252, 166); x.stroke();
    x.lineWidth = 5; x.beginPath(); x.moveTo(200, 182); x.quadraticCurveTo(215, 230, 205, 262); x.moveTo(206, 182); x.quadraticCurveTo(232, 220, 236, 250); x.stroke();
    x.fillStyle = "#b8903a"; x.beginPath(); x.arc(203, 182, 9, 0, 7); x.fill();
  })();

  /* ---------------- Start ---------------- */
  $("mode-note").textContent = DEMO
    ? "Mode démo : les souhaits restent sur cet appareil. Une fois Supabase branché, ils seront partagés avec toute la famille."
    : touchOnly
      ? "Les souhaits sont partagés avec toute la famille. Touche un cadeau pour voir le souhait, glisse pour voir toute la pièce."
      : "Les souhaits sont partagés avec toute la famille. Survole un cadeau pour voir le souhait, clique pour ouvrir l'article.";
  const sc = $("scroller"); sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
  render();
  if (DEMO) { refresh(); }
  else if (code) { $("logout").hidden = false; refresh(); }
  else showGate();
  setInterval(() => { if (!document.hidden) refresh(true); }, 30000);
  let resizeTimer;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(true); });
})();
