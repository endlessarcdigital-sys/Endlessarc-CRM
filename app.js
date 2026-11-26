/* app.js - navigation, shared helpers, dashboard and backup page */

/* ---------- Settings you can change ---------- */
const CONFIG = {
  currencySymbol: "₹",
  leadSources: ["Instagram", "Facebook", "Website", "Referral", "Cold Call", "WhatsApp", "Other"]
};

/* ---------- Shared helpers (used by all modules) ---------- */
const Modules = {};   // each module registers itself here, e.g. Modules.leads = function(el){...}
function esc(s) {     // makes text safe to show on screen
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function money(n) { return CONFIG.currencySymbol + Number(n || 0).toLocaleString("en-IN"); }
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 3000);
}

/* ---------- Pages in the menu ---------- */
const PAGES = [
  { id: "dashboard", icon: "📊", title: "Dashboard" },
  { id: "leads", icon: "🎯", title: "Leads" },
  { id: "clients", icon: "🤝", title: "Clients" },
  { id: "followups", icon: "📞", title: "Follow-ups" },
  { id: "payments", icon: "💰", title: "Payments" },
  { id: "tasks", icon: "✅", title: "Daily Tasks" },
  { id: "services", icon: "📦", title: "Services & Packages" },
  { id: "backup", icon: "💾", title: "Backup & Restore" }
];

/* ---------- Placeholder for modules not built yet ---------- */
function comingSoon(page) {
  return function (el) {
    el.innerHTML = '<div class="card empty"><h2>' + esc(page.title) + '</h2><p>This section will be built in the next part.</p></div>';
  };
}
PAGES.forEach(p => { if (!Modules[p.id]) Modules[p.id] = comingSoon(p); });

/* ---------- Dashboard (basic version; charts come later) ---------- */
Modules.dashboard = async function (el) {
  const [leads, clients, payments, followups] = await Promise.all([
    DB.all("leads"), DB.all("clients"), DB.all("payments"), DB.all("followups")
  ]);
  const revenue = payments.filter(p => p.status === "Paid").reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = followups.filter(f => f.status === "Pending").length;
  el.innerHTML =
    '<div class="grid">' +
    stat("Total Leads", leads.length) + stat("Clients", clients.length) +
    stat("Revenue Received", money(revenue)) + stat("Pending Follow-ups", pending) +
    '</div><div class="card"><h2>Welcome to EndlessArc Digital CRM</h2>' +
    '<p>Your foundation is ready. Leads, clients, follow-ups, payments, tasks and services will be added in the next parts. Use <b>Backup &amp; Restore</b> regularly.</p></div>';
  function stat(label, value) {
    return '<div class="card stat"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
  }
};

/* ---------- Backup & Restore page ---------- */
Modules.backup = async function (el) {
  el.innerHTML =
    '<div class="grid">' +
    '<div class="card"><h2>Download Backup</h2><p>Saves all your CRM data into one file on your device. Do this weekly, and before clearing browser history.</p><button class="btn" id="btnExport">Download Backup</button></div>' +
    '<div class="card"><h2>Restore Backup</h2><p><b>Warning:</b> this replaces all current data with the data in the backup file.</p>' +
    '<input type="file" id="fileImport" accept=".json,application/json"></div></div>';

  document.getElementById("btnExport").onclick = async function () {
    const backup = await DB.exportAll();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "EndlessArc-CRM-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Backup downloaded");
  };

  document.getElementById("fileImport").onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const backup = JSON.parse(reader.result);
        if (!confirm("Replace ALL current data with this backup?")) { e.target.value = ""; return; }
        await DB.importAll(backup);
        toast("Backup restored successfully");
        e.target.value = "";
      } catch (err) { alert("Restore failed: " + err.message); e.target.value = ""; }
    };
    reader.readAsText(file);
  };
};

/* ---------- Navigation ---------- */
const nav = document.getElementById("nav");
nav.innerHTML = PAGES.map(p => '<a href="#' + p.id + '" data-id="' + p.id + '"><span>' + p.icon + '</span>' + p.title + '</a>').join("");

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
function closeMenu() { sidebar.classList.remove("open"); overlay.classList.remove("show"); }
document.getElementById("menuBtn").onclick = function () { sidebar.classList.add("open"); overlay.classList.add("show"); };
overlay.onclick = closeMenu;

async function route() {
  const id = (location.hash || "#dashboard").slice(1);
  const page = PAGES.find(p => p.id === id) || PAGES[0];
  document.getElementById("pageTitle").textContent = page.title;
  nav.querySelectorAll("a").forEach(a => a.classList.toggle("active", a.dataset.id === page.id));
  const view = document.getElementById("view");
  view.innerHTML = "";
  await Modules[page.id](view);
  closeMenu();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
/* route() is started from index.html after all module files have loaded */
