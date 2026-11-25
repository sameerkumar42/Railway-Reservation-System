class Ticket {
  constructor(id, name, trainId, status) {
    this.id = id; this.name = name; this.trainId = trainId; this.status = status;
  }
}

class Train {
  constructor(id, src, dest, dep, fare, capacity) {
    Object.assign(this, { id, src, dest, dep, fare, capacity });
    this.confirmed = [];   // confirmed tickets
    this.waiting = [];     // waiting queue (FIFO)
  }
}

class Railway {
  constructor(out) {
    this.out = out;        // out(message, type) type: ok | err | info
    this.graph = {};       // stations and routes
    this.trains = {};
    this.tickets = {};     // hash map: ticket id -> ticket
    this.counter = 100;
  }

  addRoute(a, b) {
    (this.graph[a] ||= []).push(b);
    (this.graph[b] ||= []).push(a);
  }

  load(text) {             // railway.txt: id,src,dest,dep,fare,capacity
    text.trim().split("\n").forEach(line => {
      const p = line.trim().split(",");
      if (p.length < 6) return;
      this.trains[p[0]] = new Train(p[0], p[1], p[2], p[3], +p[4], +p[5]);
      this.addRoute(p[1], p[2]);
    });
    this.restore();
  }

  save() {
    try {
      localStorage.setItem("rr_data", JSON.stringify({ counter: this.counter, tickets: Object.values(this.tickets) }));
    } catch (e) {}
  }

  restore() {
    try {
      const d = JSON.parse(localStorage.getItem("rr_data"));
      if (!d) return;
      this.counter = d.counter;
      d.tickets.forEach(k => {
        const t = this.trains[k.trainId];
        if (!t) return;
        this.tickets[k.id] = k;
        (k.status === "confirmed" ? t.confirmed : t.waiting).push(k);
      });
    } catch (e) {}
  }

  stations() { return Object.keys(this.graph); }

  stationName(s) {         // case-insensitive match
    return this.stations().find(x => x.toLowerCase() === s.toLowerCase());
  }

  sorted(key) {            // sorting: fare, departure time or id
    const f = { fare: (a, b) => a.fare - b.fare, dep: (a, b) => a.dep.localeCompare(b.dep), id: (a, b) => a.id.localeCompare(b.id) };
    return Object.values(this.trains).sort(f[key] || f.id);
  }

  stats() {
    const ts = Object.values(this.trains);
    return {
      trains: ts.length,
      confirmed: ts.reduce((s, t) => s + t.confirmed.length, 0),
      waiting: ts.reduce((s, t) => s + t.waiting.length, 0),
      free: ts.reduce((s, t) => s + (t.capacity - t.confirmed.length), 0)
    };
  }

  findPath(from, to) {     // BFS shortest path in the graph
    const parent = { [from]: null }, q = [from];
    while (q.length) {
      const cur = q.shift();
      if (cur === to) {
        const path = [];
        for (let c = to; c !== null; c = parent[c]) path.unshift(c);
        return path;
      }
      for (const nx of this.graph[cur] || [])
        if (!(nx in parent)) { parent[nx] = cur; q.push(nx); }
    }
    return null;
  }

  searchRoute(from, to) {
    const a = this.stationName(from), b = this.stationName(to);
    if (!a || !b) return this.out("Station not found.", "err");
    const path = this.findPath(a, b);
    if (!path) return this.out(`No route from ${a} to ${b}`, "err");
    this.out(`Route found: ${path.join(" -> ")}`, "ok");
    for (let i = 0; i < path.length - 1; i++) {
      const t = Object.values(this.trains).find(x =>
        (x.src === path[i] && x.dest === path[i + 1]) || (x.dest === path[i] && x.src === path[i + 1]));
      if (t) this.out(`  ${t.id}: ${path[i]} to ${path[i + 1]}, Rs.${t.fare}, departs ${t.dep}`, "info");
    }
  }

  book(tid, name) {
    const t = this.trains[tid];
    if (!t) return this.out(`Train ${tid} not found.`, "err");
    if (!name) return this.out("Enter passenger name.", "err");
    const k = new Ticket("TKT" + (++this.counter), name, tid, "confirmed");
    this.tickets[k.id] = k;
    if (t.confirmed.length < t.capacity) {
      t.confirmed.push(k);
      this.out(`Ticket booked: ${k.id} | ${name} | Train ${tid}`, "ok");
    } else {
      k.status = "waiting";
      t.waiting.push(k);
      this.out("Train full. Passenger added to waiting queue.", "info");
    }
    this.save();
  }

  cancel(id) {
    const k = this.tickets[id];
    if (!k) return this.out(`Ticket ${id} not found.`, "err");
    delete this.tickets[id];
    const t = this.trains[k.trainId];
    if (k.status === "confirmed") {
      t.confirmed = t.confirmed.filter(x => x !== k);
      this.out("Ticket cancelled.", "ok");
      const n = t.waiting.shift();            // FIFO transfer
      if (n) {
        n.status = "confirmed";
        t.confirmed.push(n);
        this.out(`Seat allocated to ${n.name} from waiting queue.`, "ok");
      }
    } else {
      t.waiting = t.waiting.filter(x => x !== k);
      this.out("Waiting ticket cancelled.", "ok");
    }
    this.save();
  }

  search(id) {
    const k = this.tickets[id];
    if (k) this.out(`Found: ${k.id} | ${k.name} | Train ${k.trainId} | ${k.status}`, "ok");
    else this.out(`Ticket ${id} not found.`, "err");
  }
}

// ================= UI =================
const DEFAULT_DATA = "T101,Delhi,Mumbai,06:00,1500,1\nT102,Delhi,Jaipur,08:30,600,2";
let railway, sortKey = "id";
const $ = id => document.getElementById(id);
const up = id => $(id).value.trim().toUpperCase();

function toast(msg, type) {
  const d = document.createElement("div");
  d.className = "toast " + type;
  d.textContent = msg;
  $("toasts").appendChild(d);
  setTimeout(() => d.remove(), 3000);
}

function run(fn) {
  const box = $("output");
  box.innerHTML = "";
  let first = true;
  railway.out = (msg, type = "info") => {
    const line = document.createElement("div");
    line.className = "line " + type;
    line.textContent = msg;
    box.appendChild(line);
    if (first) { toast(msg, type); first = false; }
  };
  fn();
  render();
}

function render() {
  const s = railway.stats();
  $("sTrains").textContent = s.trains;
  $("sConfirmed").textContent = s.confirmed;
  $("sWaiting").textContent = s.waiting;
  $("sFree").textContent = s.free;

  $("trainsBody").innerHTML = railway.sorted(sortKey).map(t => {
    const pct = Math.round(t.confirmed.length / t.capacity * 100);
    const full = t.confirmed.length >= t.capacity;
    return `<tr><td><b>${t.id}</b></td><td>${t.src} → ${t.dest}</td><td>${t.dep}</td><td>Rs.${t.fare}</td>
      <td><div class="bar"><div class="fill ${full ? "full" : ""}" style="width:${pct}%"></div></div>${t.confirmed.length}/${t.capacity}</td>
      <td>${t.waiting.length}</td><td><span class="badge ${full ? "red" : "green"}">${full ? "Full" : "Available"}</span></td></tr>`;
  }).join("");

  const ks = Object.values(railway.tickets);
  $("ticketsBody").innerHTML = ks.length ? ks.map(k =>
    `<tr><td><b>${k.id}</b></td><td>${k.name}</td><td>${k.trainId}</td>
     <td><span class="badge ${k.status === "confirmed" ? "green" : "orange"}">${k.status}</span></td>
     <td><button class="mini" onclick="cancelById('${k.id}')">Cancel</button></td></tr>`).join("")
    : `<tr><td colspan="5" class="empty">No tickets yet</td></tr>`;
}

function bookTicket()   { run(() => railway.book($("trainSelect").value, $("name").value.trim())); $("name").value = ""; }
function searchTicket() { run(() => railway.search(up("ticketId"))); }
function cancelTicket() { run(() => railway.cancel(up("ticketId"))); }
function cancelById(id) { run(() => railway.cancel(id)); }
function searchRoute()  { run(() => railway.searchRoute($("from").value.trim(), $("to").value.trim())); }
function changeSort()   { sortKey = $("sortSelect").value; render(); }
function resetData()    { if (confirm("Delete all tickets?")) { localStorage.removeItem("rr_data"); location.reload(); } }

async function init() {
  let text = DEFAULT_DATA;
  try { const r = await fetch("railway.txt"); if (r.ok) text = await r.text(); } catch (e) {}
  railway = new Railway(() => {});
  railway.load(text);
  $("trainSelect").innerHTML = Object.values(railway.trains)
    .map(t => `<option value="${t.id}">${t.id}: ${t.src} → ${t.dest} (Rs.${t.fare})</option>`).join("");
  $("stations").innerHTML = railway.stations().map(s => `<option value="${s}">`).join("");
  render();
}
if (typeof document !== "undefined") init();
if (typeof module !== "undefined") module.exports = { Railway };