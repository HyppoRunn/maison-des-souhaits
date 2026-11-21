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
      return { 17: { who: "Lucie", what: "AirPods 4", url: "https://www.apple.com/fr/airpods-4/" },
               23: { who: "Hugo", what: "LEGO Technic", url: "https://www.lego.com/fr-fr/themes/technic" } };
    },
    save(d) { store.set("mds-demo", JSON.stringify(d)); },
  };

  const api = {
    async check(c) { return DEMO ? true : rpc("check_family_code", { p_code: c }); },
    async list() {
      if (DEMO) return demo.load();
      const rows = await rpc("list_wishes", { p_code: code });
      const out = {};
      for (const r of rows || []) out[r.slot] = { who: r.who, what: r.what, url: r.url };
      return out;
    },
    async add(slot, w) {
      if (DEMO) { const d = demo.load(); if (d[slot]) throw Object.assign(new Error(), { kind: "taken" }); d[slot] = w; demo.save(d); return; }
      await rpc("add_wish", { p_code: code, p_slot: slot, p_who: w.who, p_what: w.what, p_url: w.url || null });
    },
    async update(slot, w) {
      if (DEMO) { const d = demo.load(); d[slot] = w; demo.save(d); return; }
      await rpc("update_wish", { p_code: code, p_slot: slot, p_who: w.who, p_what: w.what, p_url: w.url || null });
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
    SCENE.gifts.forEach((g, i) => {
      const w = wishes[i];
      const sz = Math.min(1, Math.max(0.55, g.w / 7.5));
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
        tag.append(who, what, go);
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
    $("count").textContent = `${taken} souhait${taken > 1 ? "s" : ""} · ${free} cadeau${free > 1 ? "x" : ""} libre${free > 1 ? "s" : ""}`;
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
    for (const o of ["gate", "modal", "detail"]) $(o).hidden = o !== id;
    if (focusEl) setTimeout(() => focusEl.focus(), 30);
  }
  function closeOverlays() {
    $("modal").hidden = true; $("detail").hidden = true;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  // Wish form (add / edit)
  const form = $("wish");
  let mode = "add", cur = null;
  function resetForm() {
    form.reset(); $("wish-err").textContent = ""; $("confirm").hidden = true; $("save").disabled = false;
  }
  function openAdd(i) {
    if (!DEMO && !code) return showGate();
    mode = "add"; cur = i; resetForm();
    $("wish-title").textContent = "Mon souhait";
    $("wish-sub").textContent = "Il sera accroché à ce cadeau pour toute la famille.";
    $("free").hidden = true; $("save").textContent = "Terminer";
    const last = store.get("mds-name"); if (last) form.who.value = last;
    openOverlay("modal", last ? form.what : form.who);
  }
  function openEdit(i) {
    const w = wishes[i]; if (!w) return;
    mode = "edit"; cur = i; resetForm();
    $("wish-title").textContent = "Modifier le souhait";
    $("wish-sub").textContent = "Les changements sont visibles par toute la famille.";
    form.who.value = w.who; form.what.value = w.what; form.url.value = w.url || "";
    $("free").hidden = false; $("save").textContent = "Enregistrer";
    openOverlay("modal", form.what);
  }
  function openDetail(i) {
    const w = wishes[i]; if (!w) return;
    cur = i;
    $("d-who").textContent = w.who; $("d-what").textContent = w.what;
    const url = safeUrl(w.url);
    $("d-link").hidden = !url; $("d-nolink").hidden = !!url;
    if (url) $("d-link").href = url;
    openOverlay("detail", url ? $("d-link") : $("d-close"));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const who = form.who.value.trim(), what = form.what.value.trim(), url = normalizeUrl(form.url.value);
    if (!who) { $("wish-err").textContent = "Écris ton prénom."; form.who.focus(); return; }
    if (!what) { $("wish-err").textContent = "Écris le nom du cadeau."; form.what.focus(); return; }
    if (url && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url)) { $("wish-err").textContent = "Ce lien ne ressemble pas à une adresse web. Copie-le depuis la page de l'article."; form.url.focus(); return; }
    $("save").disabled = true; $("wish-err").textContent = "";
    try {
      if (mode === "add") await api.add(cur, { who, what, url });
      else await api.update(cur, { who, what, url });
      store.set("mds-name", who);
      closeOverlays();
      toast(mode === "add" ? "Souhait accroché au sapin" : "Souhait modifié");
      await refresh(true);
    } catch (err) {
      $("save").disabled = false;
      if (err.kind === "taken") { closeOverlays(); toast("Quelqu'un vient de prendre ce cadeau. Choisis-en un autre.", true); refresh(true); }
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
  for (const id of ["modal", "detail"]) $(id).addEventListener("click", (e) => { if (e.target === $(id)) closeOverlays(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlays(); });

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

  /* ---------------- Start ---------------- */
  $("mode-note").textContent = DEMO
    ? "Mode démo : les souhaits restent sur cet appareil. Une fois Supabase branché, ils seront partagés avec toute la famille."
    : "Les souhaits sont partagés avec toute la famille. Survole un cadeau pour voir le souhait, clique pour ouvrir l'article.";
  const sc = $("scroller"); sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
  render();
  if (DEMO) { refresh(); }
  else if (code) { $("logout").hidden = false; refresh(); }
  else showGate();
  setInterval(() => { if (!document.hidden) refresh(true); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(true); });
})();
