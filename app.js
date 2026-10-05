/* =====================================================
   RiseHand - Donasi Bencana Alam
   ISI BAGIAN INI SAJA:
   ===================================================== */
const CONFIG = {
  // Tempel URL Web App dari Apps Script (berakhiran /exec)
  API_URL: "https://script.google.com/macros/s/AKfycbxV1b76J773vy3R6oXvdIIqhVfbhyUcghzQuNPp-rRC4BmGa7ZB4jy-OU8_lEopkCJx/exec",

  // Info rekening yang tampil setelah donatur mengirim form
  BANK: { nama: "Bank BRI", rekening: "0000 0000 0000", atasNama: "Yayasan RiseHand Peduli" },

  // Nomor WhatsApp admin untuk konfirmasi (format 62..., tanpa +)
  WHATSAPP: "6281234567890"
};
/* ===================================================== */

(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const ICONS = { Banjir: "🌊", Gempa: "🏚️", Longsor: "⛰️", "Gunung Berapi": "🌋", Kekeringan: "☀️", Lainnya: "🤝" };
  const TONES = {
    Banjir: ["#1d4e89", "#0b2545"], Gempa: ["#8a5a2b", "#3b2410"], Longsor: ["#4d7a3a", "#1f3315"],
    "Gunung Berapi": ["#c0392b", "#4a1410"], Kekeringan: ["#d99a1e", "#5a3b05"], Lainnya: ["#f15a29", "#5a1c09"]
  };

  const DEMO = {
    ok: true,
    campaigns: [
      { id: "K001", judul: "Bantu Korban Banjir Bandang", kategori: "Banjir", lokasi: "Demak, Jawa Tengah", deskripsi: "Ratusan keluarga kehilangan rumah dan perlengkapan. Dana untuk makanan, air bersih, selimut, dan obat-obatan.", target: 150000000, terkumpul: 62500000, donatur: 214, gambar: "" },
      { id: "K002", judul: "Darurat Gempa Bumi", kategori: "Gempa", lokasi: "Cianjur, Jawa Barat", deskripsi: "Ribuan warga mengungsi di tenda darurat. Bantuan tenda, logistik, layanan kesehatan, dan pendampingan anak.", target: 250000000, terkumpul: 171000000, donatur: 530, gambar: "" },
      { id: "K003", judul: "Tanah Longsor di Perbukitan", kategori: "Longsor", lokasi: "Tana Toraja, Sulawesi Selatan", deskripsi: "Akses jalan terputus dan warga terisolasi. Donasi untuk evakuasi, dapur umum, dan hunian sementara.", target: 100000000, terkumpul: 28000000, donatur: 97, gambar: "" },
      { id: "K004", judul: "Erupsi Gunung Berapi", kategori: "Gunung Berapi", lokasi: "Lumajang, Jawa Timur", deskripsi: "Abu vulkanik menutup permukiman. Bantuan masker, air bersih, pengungsian, dan pakan ternak.", target: 120000000, terkumpul: 44000000, donatur: 143, gambar: "" },
      { id: "K005", judul: "Air Bersih untuk Daerah Kekeringan", kategori: "Kekeringan", lokasi: "Gunungkidul, DI Yogyakarta", deskripsi: "Sumur warga mengering. Dana untuk pengiriman air bersih, tandon, dan sumur bor komunal.", target: 80000000, terkumpul: 19500000, donatur: 61, gambar: "" },
      { id: "K006", judul: "Pemulihan Pascabencana Gabungan", kategori: "Lainnya", lokasi: "Seluruh Indonesia", deskripsi: "Dana siaga yang disalurkan cepat ke titik bencana baru tanpa menunggu kampanye khusus.", target: 200000000, terkumpul: 87000000, donatur: 302, gambar: "" }
    ],
    donors: [
      { nama: "Rina Aprilia", nominal: 250000, pesan: "Semoga cepat pulih semuanya.", kampanye: "K001", waktu: new Date(Date.now() - 3600e3).toISOString() },
      { nama: "Hamba Allah", nominal: 1000000, pesan: "", kampanye: "K002", waktu: new Date(Date.now() - 5 * 3600e3).toISOString() },
      { nama: "Budi Santoso", nominal: 100000, pesan: "Kuat ya, saudaraku!", kampanye: "K003", waktu: new Date(Date.now() - 26 * 3600e3).toISOString() },
      { nama: "Komunitas Peduli", nominal: 500000, pesan: "Dari kami untuk kalian.", kampanye: "K004", waktu: new Date(Date.now() - 50 * 3600e3).toISOString() }
    ]
  };

  const state = { campaigns: [], donors: [], filter: "Semua", demo: false };

  /* ---------- Utils ---------- */
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rupiah = (n) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
  const compact = (n) => {
    n = Number(n) || 0;
    if (n >= 1e9) return "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
    if (n >= 1e6) return "Rp " + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
    return rupiah(n);
  };
  const timeAgo = (iso) => {
    const t = new Date(iso).getTime();
    if (!t) return "";
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "baru saja";
    if (s < 3600) return Math.floor(s / 60) + " menit lalu";
    if (s < 86400) return Math.floor(s / 3600) + " jam lalu";
    return Math.floor(s / 86400) + " hari lalu";
  };
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function toast(msg, type) {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "toast show " + (type || "");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 4200);
  }

  /* ---------- Reveal on scroll ---------- */
  let io = null;
  function setupReveal() {
    if (!("IntersectionObserver" in window) || reduced) {
      $$(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
          $$("[data-count]", e.target).forEach(runCounter);
          if (e.target.matches("[data-count]")) runCounter(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    observeAll();
  }
  function observeAll() {
    $$(".reveal:not(.in)").forEach((el) => {
      if (io) return io.observe(el);
      el.classList.add("in");
      $$("[data-count]", el).forEach(runCounter);
    });
  }

  function runCounter(el) {
    if (el.dataset.done === "1") return;
    el.dataset.done = "1";
    const to = Number(el.dataset.count) || 0;
    const fmt = el.dataset.fmt;
    const show = (v) => (el.textContent = fmt === "money" ? compact(v) : Math.round(v).toLocaleString("id-ID") + (el.dataset.suffix || ""));
    if (reduced) return show(to);
    const dur = 1400, t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      show(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- Render ---------- */
  function renderStats() {
    const c = state.campaigns;
    const total = c.reduce((a, x) => a + x.terkumpul, 0);
    const donors = c.reduce((a, x) => a + x.donatur, 0);
    const places = new Set(c.map((x) => x.lokasi).filter(Boolean)).size;
    const data = [
      { k: c.length, l: "Kampanye Aktif", f: "" },
      { k: donors, l: "Donasi Terverifikasi", f: "" },
      { k: total, l: "Dana Terkumpul", f: "money" },
      { k: places, l: "Lokasi Terbantu", f: "" }
    ];
    $("#statsGrid").innerHTML = data.map((s, i) =>
      `<div class="stat reveal" style="--d:${i * 90}ms"><b data-count="${s.k}" data-fmt="${s.f}">0</b><span>${s.l}</span><i></i></div>`).join("");
    $("#heroTotal").dataset.count = total;
    $("#heroTotal").dataset.fmt = "money";
    $("#heroTotal").dataset.done = "0";
    runCounter($("#heroTotal"));
    $("#heroDonors").textContent = donors.toLocaleString("id-ID");
  }

  function renderFilters() {
    const cats = ["Semua"].concat(Array.from(new Set(state.campaigns.map((c) => c.kategori))));
    if (!cats.includes(state.filter)) state.filter = "Semua";
    $("#filters").innerHTML = cats.map((c) =>
      `<button type="button" class="chip${c === state.filter ? " on" : ""}" data-cat="${esc(c)}" aria-pressed="${c === state.filter}">${esc(c)}</button>`).join("");
  }

  function thumb(c) {
    const tone = TONES[c.kategori] || TONES.Lainnya;
    const img = safeUrl(c.gambar);
    return `<div class="thumb" style="background:linear-gradient(135deg,${tone[0]},${tone[1]})">
      <span class="thumb-ico" aria-hidden="true">${ICONS[c.kategori] || ICONS.Lainnya}</span>
      ${img ? `<img src="${esc(img)}" alt="${esc(c.judul)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
      <em>${esc(c.kategori)}</em></div>`;
  }

  function renderCampaigns() {
    const list = state.campaigns.filter((c) => state.filter === "Semua" || c.kategori === state.filter);
    const grid = $("#causeGrid");
    if (!list.length) {
      grid.innerHTML = `<p class="empty">Belum ada kampanye pada kategori ini. Pilih kategori lain atau lihat semua kampanye.</p>`;
      return;
    }
    grid.innerHTML = list.map((c, i) => {
      const pct = c.target > 0 ? Math.min(100, Math.round((c.terkumpul / c.target) * 100)) : 0;
      return `<article class="cause reveal" style="--d:${(i % 3) * 100}ms">
        ${thumb(c)}
        <div class="cause-body">
          <p class="loc">📍 ${esc(c.lokasi || "Indonesia")}</p>
          <h3>${esc(c.judul)}</h3>
          <p class="desc">${esc(c.deskripsi)}</p>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progres donasi ${pct} persen"><span style="--w:${pct}%"></span></div>
          <div class="meta"><span><b>${compact(c.terkumpul)}</b> terkumpul</span><span>${pct}%</span></div>
          <div class="meta sm"><span>Target ${compact(c.target)}</span><span>${c.donatur.toLocaleString("id-ID")} donatur</span></div>
          <button type="button" class="btn btn-primary block" data-donate="${esc(c.id)}">Donasi Sekarang <span aria-hidden="true">»</span></button>
        </div></article>`;
    }).join("");
    observeAll();
  }

  function renderDonors() {
    const box = $("#donorList");
    if (!state.donors.length) {
      box.innerHTML = `<p class="empty">Belum ada donasi terverifikasi. Jadilah donatur pertama.</p>`;
      return;
    }
    const names = Object.fromEntries(state.campaigns.map((c) => [c.id, c.judul]));
    box.innerHTML = state.donors.slice(0, 6).map((d, i) =>
      `<div class="donor reveal" style="--d:${i * 70}ms">
        <div class="av" aria-hidden="true">${esc((d.nama || "?").trim().charAt(0).toUpperCase())}</div>
        <div><p><b>${esc(d.nama)}</b> berdonasi <b class="or">${rupiah(d.nominal)}</b></p>
        <small>${esc(names[d.kampanye] || "Kampanye")} · ${timeAgo(d.waktu)}</small>
        ${d.pesan ? `<q>${esc(d.pesan)}</q>` : ""}</div></div>`).join("");
    observeAll();
  }

  function fillSelect() {
    $("#fCampaign").innerHTML = state.campaigns.map((c) => `<option value="${esc(c.id)}">${esc(c.judul)}</option>`).join("");
  }

  function renderAll() {
    renderStats(); renderFilters(); renderCampaigns(); renderDonors(); fillSelect();
    observeAll();
  }

  /* ---------- Data ---------- */
  async function load(silent) {
    try {
      let data;
      if (!CONFIG.API_URL) {
        data = DEMO; state.demo = true;
      } else {
        const res = await fetch(CONFIG.API_URL, { method: "GET", redirect: "follow" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        data = await res.json();
        state.demo = false;
      }
      if (!data.ok) throw new Error(data.error || "Data tidak valid");
      state.campaigns = data.campaigns || [];
      state.donors = data.donors || [];
      $("#demoNote").hidden = !state.demo;
      $("#loadError").hidden = true;
      renderAll();
    } catch (err) {
      console.error(err);
      if (!state.campaigns.length) {
        $("#causeGrid").innerHTML = "";
        $("#loadError").hidden = false;
        $("#loadErrorMsg").textContent = "Data belum bisa dimuat: " + err.message + ". Periksa API_URL di app.js dan pengaturan deploy Apps Script.";
      } else if (!silent) toast("Gagal memperbarui data.", "err");
    } finally {
      $("#skeleton").hidden = true;
    }
  }

  /* ---------- Modal & Form ---------- */
  const modal = $("#modal");
  let lastFocus = null;

  function openModal(id) {
    if (!state.campaigns.length) return toast("Kampanye belum tersedia.", "err");
    lastFocus = document.activeElement;
    $("#step1").hidden = false; $("#step2").hidden = true;
    $("#donateForm").reset();
    $$(".err-msg").forEach((e) => (e.textContent = ""));
    if (id) $("#fCampaign").value = id;
    $$(".amt").forEach((b) => b.classList.remove("on"));
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("lock");
    setTimeout(() => $("#fCampaign").focus(), 60);
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lock");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function setErr(id, msg) { $("#e-" + id).textContent = msg || ""; }

  function validate() {
    let ok = true;
    const nama = $("#fName").value.trim();
    const kontak = $("#fContact").value.trim();
    const nominal = Number($("#fAmount").value);
    setErr("name", ""); setErr("contact", ""); setErr("amount", "");
    if (nama.length < 2) { setErr("name", "Isi nama minimal 2 huruf."); ok = false; }
    const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kontak);
    const isPhone = /^(\+?62|0)8[0-9]{7,12}$/.test(kontak.replace(/[\s-]/g, ""));
    if (!isMail && !isPhone) { setErr("contact", "Isi nomor WhatsApp (08…) atau email yang valid."); ok = false; }
    if (!nominal || nominal < 10000) { setErr("amount", "Nominal minimal Rp 10.000."); ok = false; }
    return ok;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    const btn = $("#submitBtn");
    const payload = {
      kampanye: $("#fCampaign").value,
      nama: $("#fName").value.trim(),
      kontak: $("#fContact").value.trim(),
      nominal: Number($("#fAmount").value),
      pesan: $("#fMsg").value.trim(),
      anonim: $("#fAnon").checked
    };
    btn.disabled = true; btn.classList.add("busy");
    try {
      if (CONFIG.API_URL) {
        const res = await fetch(CONFIG.API_URL, {
          method: "POST", redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" }, // hindari preflight CORS
          body: JSON.stringify(payload)
        });
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || "Gagal mengirim donasi.");
      }
      showStep2(payload);
      load(true);
    } catch (err) {
      console.error(err);
      toast(err.message || "Gagal mengirim. Coba lagi.", "err");
    } finally {
      btn.disabled = false; btn.classList.remove("busy");
    }
  }

  function showStep2(p) {
    const c = state.campaigns.find((x) => x.id === p.kampanye);
    $("#sumAmount").textContent = rupiah(p.nominal);
    $("#sumCampaign").textContent = c ? c.judul : "";
    $("#bankName").textContent = CONFIG.BANK.nama;
    $("#bankNo").textContent = CONFIG.BANK.rekening;
    $("#bankOwner").textContent = CONFIG.BANK.atasNama;
    const text = `Halo, saya ${p.nama}. Saya sudah transfer ${rupiah(p.nominal)} untuk "${c ? c.judul : ""}". Berikut bukti transfernya.`;
    $("#waBtn").href = "https://wa.me/" + CONFIG.WHATSAPP + "?text=" + encodeURIComponent(text);
    $("#step1").hidden = true; $("#step2").hidden = false;
    $("#step2 h3").focus();
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast(label + " disalin.", "ok");
    } catch (e) {
      const t = document.createElement("textarea");
      t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); toast(label + " disalin.", "ok"); } catch (x) { toast("Salin manual: " + text); }
      t.remove();
    }
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    setupReveal();

    // Header
    const header = $("#header");
    const onScroll = () => header.classList.toggle("stuck", window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const menuBtn = $("#menuBtn"), nav = $("#nav");
    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open);
    });
    $$("#nav a").forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }));

    // Active nav link
    const sections = $$("main section[id]");
    if ("IntersectionObserver" in window) {
      const so = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) $$("#nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
      }), { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach((s) => so.observe(s));
    }

    // Delegated clicks
    document.addEventListener("click", (e) => {
      const d = e.target.closest("[data-donate]");
      if (d) { e.preventDefault(); openModal(d.dataset.donate || ""); return; }
      const f = e.target.closest(".chip");
      if (f) { state.filter = f.dataset.cat; renderFilters(); renderCampaigns(); return; }
      if (e.target.closest("[data-close]")) closeModal();
      const cp = e.target.closest("[data-copy]");
      if (cp) copyText($(cp.dataset.copy).textContent.replace(/\s/g, ""), "Nomor rekening");
    });

    $("#retryBtn").addEventListener("click", () => { $("#loadError").hidden = true; load(); });

    // Modal
    document.addEventListener("keydown", (e) => {
      if (!modal.classList.contains("open")) return;
      if (e.key === "Escape") closeModal();
      if (e.key === "Tab") { // focus trap
        const f = $$("button, input, select, textarea, a[href]", modal).filter((x) => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    $$(".amt").forEach((b) => b.addEventListener("click", () => {
      $("#fAmount").value = b.dataset.v;
      $$(".amt").forEach((x) => x.classList.toggle("on", x === b));
      setErr("amount", "");
    }));
    $("#fAmount").addEventListener("input", () => {
      $$(".amt").forEach((x) => x.classList.toggle("on", x.dataset.v === $("#fAmount").value));
    });
    $("#donateForm").addEventListener("submit", submit);

    $("#year").textContent = new Date().getFullYear();
    load();
    setInterval(() => { if (!document.hidden && CONFIG.API_URL) load(true); }, 60000);
  });
})();
