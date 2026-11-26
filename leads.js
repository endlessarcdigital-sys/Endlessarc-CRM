/* leads.js - Leads Management module. Loads after app.js */
(function () {
  const STATUSES = ["New", "Contacted", "Interested", "Follow-up", "Converted", "Not Interested"];
  const SOURCES = CONFIG.leadSources;
  const filters = { search: "", status: "", source: "", due: "" };

  function today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function fmtDate(s) { if (!s) return "—"; const p = s.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function options(list, selected, placeholder) {
    return (placeholder !== undefined ? '<option value="">' + placeholder + "</option>" : "") +
      list.map(x => "<option" + (x === selected ? " selected" : "") + ">" + esc(x) + "</option>").join("");
  }
  function isActive(l) { return l.status !== "Converted" && l.status !== "Not Interested"; }

  Modules.leads = async function (el) {
    el.innerHTML =
      '<div class="toolbar">' +
      '<input type="search" id="lSearch" placeholder="Search name, phone, email, location, notes..." value="' + esc(filters.search) + '">' +
      '<select id="lStatus">' + options(STATUSES, filters.status, "All statuses") + "</select>" +
      '<select id="lSource">' + options(SOURCES, filters.source, "All sources") + "</select>" +
      '<select id="lDue"><option value="">Any follow-up date</option>' +
      '<option value="overdue"' + (filters.due === "overdue" ? " selected" : "") + ">Overdue</option>" +
      '<option value="today"' + (filters.due === "today" ? " selected" : "") + ">Due today</option></select>" +
      '<button class="btn" id="lAdd">+ Add Lead</button></div>' +
      '<div class="count" id="lCount"></div><div id="lList"></div>';

    const bind = (id, key, ev) => document.getElementById(id).addEventListener(ev, e => { filters[key] = e.target.value; draw(); });
    bind("lSearch", "search", "input"); bind("lStatus", "status", "change");
    bind("lSource", "source", "change"); bind("lDue", "due", "change");
    document.getElementById("lAdd").onclick = () => openForm(null);

    document.getElementById("lList").addEventListener("click", async function (e) {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const lead = await DB.get("leads", btn.dataset.id);
      if (!lead) return;
      if (btn.dataset.act === "edit") openForm(lead);
      if (btn.dataset.act === "delete") {
        if (confirm('Delete lead "' + lead.businessName + '"? This cannot be undone.')) {
          await DB.remove("leads", lead.id); toast("Lead deleted"); draw();
        }
      }
    });
    draw();
  };

  async function draw() {
    const all = await DB.all("leads");
    const t = today(), q = filters.search.trim().toLowerCase();
    const list = all.filter(l => {
      if (filters.status && l.status !== filters.status) return false;
      if (filters.source && l.source !== filters.source) return false;
      if (filters.due === "overdue" && !(l.nextFollowUp && l.nextFollowUp < t && isActive(l))) return false;
      if (filters.due === "today" && !(l.nextFollowUp === t && isActive(l))) return false;
      if (q) {
        const hay = [l.businessName, l.contactPerson, l.phone, l.email, l.location, l.category, l.service, l.notes].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    document.getElementById("lCount").textContent = "Showing " + list.length + " of " + all.length + " leads";
    const box = document.getElementById("lList");
    if (!list.length) {
      box.innerHTML = '<div class="card empty">' + (all.length ? "No leads match your search or filters." : 'No leads yet. Click <b>+ Add Lead</b> to add your first one.') + "</div>";
      return;
    }
    box.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Business</th><th>Contact</th><th>Source</th><th>Service</th><th>Status</th><th>Next Follow-up</th><th>Actions</th></tr></thead><tbody>' +
      list.map(l => {
        const overdue = l.nextFollowUp && l.nextFollowUp < t && isActive(l);
        return "<tr>" +
          '<td class="name" data-label="Business">' + esc(l.businessName) + "<small>" + esc(l.category) + (l.location ? " · " + esc(l.location) : "") + "</small></td>" +
          '<td data-label="Contact"><span>' + esc(l.contactPerson) + '<small><a href="tel:' + esc(l.phone) + '">' + esc(l.phone) + "</a></small>" + (l.email ? "<small>" + esc(l.email) + "</small>" : "") + "</span></td>" +
          '<td data-label="Source">' + esc(l.source) + "</td>" +
          '<td data-label="Service">' + (esc(l.service) || "—") + "</td>" +
          '<td data-label="Status"><span class="badge st-' + esc(l.status) + '">' + esc(l.status) + "</span></td>" +
          '<td data-label="Next Follow-up"' + (overdue ? ' class="overdue"' : "") + ">" + fmtDate(l.nextFollowUp) + (overdue ? " (overdue)" : "") + "</td>" +
          '<td data-label="Actions"><div class="act"><button class="btn ghost sm" data-act="edit" data-id="' + l.id + '">Edit</button>' +
          '<button class="btn danger sm" data-act="delete" data-id="' + l.id + '">Delete</button></div></td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  async function openForm(lead) {
    const isEdit = !!lead;
    const l = lead || { status: "New", source: "Instagram" };
    const services = (await DB.all("services")).map(s => s.name).filter(Boolean);
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML =
      '<div class="modal"><h2>' + (isEdit ? "Edit Lead" : "Add New Lead") + '</h2><form id="lForm" novalidate><div class="form-grid">' +
      field("Business Name *", '<input name="businessName" required value="' + esc(l.businessName) + '">') +
      field("Contact Person *", '<input name="contactPerson" required value="' + esc(l.contactPerson) + '">') +
      field("Phone *", '<input name="phone" type="tel" required value="' + esc(l.phone) + '">') +
      field("Email", '<input name="email" type="email" value="' + esc(l.email) + '">') +
      field("Location", '<input name="location" value="' + esc(l.location) + '">') +
      field("Business Category", '<input name="category" placeholder="e.g. Restaurant, Salon, Clinic" value="' + esc(l.category) + '">') +
      field("Lead Source", '<select name="source">' + options(SOURCES, l.source) + "</select>") +
      field("Service Interested In", '<input name="service" list="svcList" value="' + esc(l.service) + '"><datalist id="svcList">' + services.map(s => '<option value="' + esc(s) + '">').join("") + "</datalist>") +
      field("Lead Status", '<select name="status">' + options(STATUSES, l.status) + "</select>") +
      field("Next Follow-up Date", '<input name="nextFollowUp" type="date" value="' + esc(l.nextFollowUp) + '">') +
      field("Notes", '<textarea name="notes">' + esc(l.notes) + "</textarea>", true) +
      '</div><div class="row"><button type="button" class="btn ghost" id="lCancel">Cancel</button><button type="submit" class="btn">' + (isEdit ? "Save Changes" : "Add Lead") + "</button></div></form></div>";
    document.body.appendChild(bg);

    function close() { bg.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    bg.querySelector("#lCancel").onclick = close;
    bg.addEventListener("mousedown", e => { if (e.target === bg) close(); });
    bg.querySelector("[name=businessName]").focus();

    bg.querySelector("#lForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target), data = {};
      fd.forEach((v, k) => data[k] = String(v).trim());
      if (!data.businessName) return alert("Please enter the business name.");
      if (!data.contactPerson) return alert("Please enter the contact person.");
      if (!data.phone) return alert("Please enter the phone number.");
      if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return alert("Please enter a valid email address.");
      if (isEdit) { await DB.update("leads", lead.id, data); toast("Lead updated"); }
      else { await DB.add("leads", data); toast("Lead added"); }
      close(); draw();
    });
  }
  function field(label, input, full) { return '<div class="field' + (full ? " full" : "") + '"><label>' + label + "</label>" + input + "</div>"; }
})();
