const MAX_SLOTS = 5;
const MIN_SLOTS = 2;

const slotsEl = document.getElementById("school-slots");
const addBtn = document.getElementById("add-slot");
const compareBtn = document.getElementById("compare-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

let ALL_SCHOOLS = [];
let slotCount = 0;
const selected = {}; // slotId -> {unitid, name}

fetch("/schools.json")
  .then(r => r.json())
  .then(data => {
    ALL_SCHOOLS = data;
    autoLoadFromURL();
  })
  .catch(() => { statusEl.textContent = "Could not load school list."; });

function searchSchools(q) {
  const lq = q.toLowerCase();
  return ALL_SCHOOLS.filter(s => s.name.toLowerCase().includes(lq)).slice(0, 12);
}

function createSlot() {
  if (slotCount >= MAX_SLOTS) return;
  const id = ++slotCount;

  const wrap = document.createElement("div");
  wrap.className = "slot";
  wrap.dataset.slot = id;
  wrap.innerHTML = `
    <div class="slot-wrap">
      <input type="text" placeholder="Search for a school…" autocomplete="off" />
      <div class="dropdown" id="dd-${id}" style="display:none"></div>
    </div>`;
  slotsEl.appendChild(wrap);

  const input = wrap.querySelector("input");
  const dd = wrap.querySelector(".dropdown");
  let debounce;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(debounce);
    if (selected[id]) { delete selected[id]; updateCompareBtn(); }
    if (q.length < 2) { dd.style.display = "none"; return; }
    debounce = setTimeout(() => {
      const results = searchSchools(q);
      if (!results.length) { dd.style.display = "none"; return; }
      dd.innerHTML = results.map(s =>
        `<div class="dropdown-item" data-unitid="${s.unitid}" data-name="${s.name}">
          ${s.name}
          <div class="sub">${s.city}, ${s.state}</div>
        </div>`
      ).join("");
      dd.style.display = "block";
      dd.querySelectorAll(".dropdown-item").forEach(item => {
        item.addEventListener("mousedown", () => {
          selected[id] = { unitid: item.dataset.unitid, name: item.dataset.name };
          input.value = item.dataset.name;
          dd.style.display = "none";
          updateCompareBtn();
        });
      });
    }, 150);
  });

  input.addEventListener("blur", () => setTimeout(() => dd.style.display = "none", 150));

  if (slotCount >= MAX_SLOTS) addBtn.style.display = "none";
  updateCompareBtn();
}

function updateCompareBtn() {
  const count = Object.keys(selected).length;
  compareBtn.disabled = count < MIN_SLOTS;
  compareBtn.textContent = count >= MIN_SLOTS ? `Compare ${count} schools` : "Compare";
}

addBtn.addEventListener("click", createSlot);

async function runComparison() {
  const unitids = Object.values(selected).map(s => s.unitid);
  history.pushState(null, "", "?unitids=" + unitids.join(","));
  statusEl.textContent = "Loading…";
  compareBtn.disabled = true;
  resultsEl.innerHTML = "";
  try {
    const res = await fetch(`/api/compare?unitids=${unitids.join(",")}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    render(data);
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    updateCompareBtn();
  }
}

function autoLoadFromURL() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("unitids");
  if (!raw) return;
  const unitids = raw.split(",").map(s => s.trim()).filter(Boolean).slice(0, MAX_SLOTS);
  if (unitids.length < MIN_SLOTS) return;

  const byUnitid = Object.fromEntries(ALL_SCHOOLS.map(s => [String(s.unitid), s]));

  // Add extra slots if needed
  while (slotCount < unitids.length) createSlot();

  unitids.forEach((uid, i) => {
    const school = byUnitid[uid];
    if (!school) return;
    const slotId = i + 1;
    selected[slotId] = { unitid: uid, name: school.name };
    const input = slotsEl.querySelector(`div[data-slot="${slotId}"] input`);
    if (input) input.value = school.name;
  });

  updateCompareBtn();
  runComparison();
}

compareBtn.addEventListener("click", runComparison);

const GROUPS = [
  { heading: "Admits and Graduation", fields: ["admission_rate", "yield_rate", "grad_rate_6yr"] },
  { heading: "Academics",             fields: ["act_avg", "sat_avg"] },
  { heading: "Enrollment",            fields: ["enrollment_total", "enrollment_ug"] },
  { heading: "Student characteristics", fields: ["pct_federal_loan", "pct_white", "pct_women"] },
  { heading: "Enrollment characteristics", fields: ["ug_pct_parttime", "ug_pct_age_24_under", "ug_pct_instate", "ug_pct_foreign", "ug_pct_distance"] },
  { heading: "Money",                 fields: ["grad_debt_median", "net_price", "tuition_in_state", "tuition_out_of_state"] },
];

function badgeStyle(ratio) {
  if (ratio == null) return "";
  // log scale: ratio=0 → t=0 (blue), ratio=9 (10x) → t=1 (red)
  const t = Math.min(1, Math.log(1 + ratio) / Math.log(10));
  const hue = Math.round(220 * (1 - t));
  return `background:hsl(${hue},70%,88%); color:hsl(${hue},55%,28%);`;
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (v > 0 && v < 1) return (v * 100).toFixed(1) + "%";
    return v.toLocaleString();
  }
  return v;
}

function renderPairRows(comparisons) {
  const byField = Object.fromEntries(comparisons.map(c => [c.field, c]));
  return GROUPS.map(group => {
    const rows = group.fields
      .map(f => byField[f])
      .filter(Boolean)
      .map(c => `
        <tr>
          <td>${c.label}</td>
          <td>${fmt(c.a)}</td>
          <td>${fmt(c.b)}</td>
          <td><span class="badge" style="${badgeStyle(c.ratio)}">${c.similarity}</span></td>
        </tr>`)
      .join("");
    if (!rows) return "";
    return `<tr class="group-header"><td colspan="4">${group.heading}</td></tr>${rows}`;
  }).join("");
}

function ncesLink(school) {
  return `<a href="https://nces.ed.gov/collegenavigator/?id=${school.unitid}" target="_blank" rel="noopener">${school.name}</a>`;
}

function renderPrograms(school) {
  if (!school.top_programs || !school.top_programs.length) return "";
  const rows = school.top_programs.map(p =>
    `<li>${p.label} <span class="prog-n">${p.n.toLocaleString()}</span></li>`
  ).join("");
  return `
    <div class="programs-card">
      <div class="programs-name">${ncesLink(school)}</div>
      <div class="programs-label">Top bachelor's degrees conferred</div>
      <ol>${rows}</ol>
    </div>`;
}

function render(data) {
  const programsHtml = data.schools.length
    ? `<div class="programs-row">${data.schools.map(renderPrograms).join("")}</div>`
    : "";

  const pairsHtml = data.pairs.map(pair => `
    <div class="pair-section">
      <h2>${ncesLink(pair.school_a)} vs. ${ncesLink(pair.school_b)}</h2>
      <table>
        <thead>
          <tr>
            <th>Characteristic</th>
            <th>${ncesLink(pair.school_a)}</th>
            <th>${ncesLink(pair.school_b)}</th>
            <th>Similarity</th>
          </tr>
        </thead>
        <tbody>
          ${renderPairRows(pair.comparisons)}
        </tbody>
      </table>
    </div>`).join("");

  resultsEl.innerHTML = programsHtml + pairsHtml;
}

createSlot();
createSlot();
