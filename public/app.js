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
  .then(data => { ALL_SCHOOLS = data; })
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

compareBtn.addEventListener("click", async () => {
  const unitids = Object.values(selected).map(s => s.unitid);
  statusEl.textContent = "Fetching IPEDS data…";
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
});

function badgeStyle(ratio) {
  if (ratio == null) return "";
  const t = Math.min(1, Math.log(1 + ratio) / Math.log(10));
  const hue = Math.round(220 * (1 - t));
  return `background:hsl(${hue},70%,88%); color:hsl(${hue},55%,28%);`;
}

function similarityLabel(ratio) {
  if (ratio == null) return "—";
  if (ratio === 0) return "identical";
  const mult = 1 + ratio;
  if (mult >= 2) return `~${mult >= 10 ? Math.round(mult) : (Math.round(mult * 10) / 10)}x`;
  return `+${Math.round(ratio * 100)}%`;
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (v > 0 && v < 1) return (v * 100).toFixed(1) + "%";
    return v.toLocaleString();
  }
  return v;
}

function render(data) {
  resultsEl.innerHTML = data.pairs.map(pair => `
    <div class="pair-section">
      <h2>${pair.school_a.name} vs. ${pair.school_b.name}</h2>
      <table>
        <thead>
          <tr>
            <th>Characteristic</th>
            <th>${pair.school_a.name}</th>
            <th>${pair.school_b.name}</th>
            <th>Similarity</th>
          </tr>
        </thead>
        <tbody>
          ${pair.comparisons.map(c => `
            <tr>
              <td>${c.label}</td>
              <td>${fmt(c.a)}</td>
              <td>${fmt(c.b)}</td>
              <td><span class="badge" style="${badgeStyle(c.ratio)}">${similarityLabel(c.ratio)}</span></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`).join("");
}

createSlot();
createSlot();
