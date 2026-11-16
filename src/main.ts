import { RANK, ago, readGoogle, readSlack, readStatuspage, siteAddress, summaryFeed, webAddress, type Level, type Report } from "./feeds.ts";
import { SERVICES, reportsLink, type Service } from "./services.ts";

declare const __VERSION__: string;

const HIDDEN_KEY = "statusboard.hidden.v1";
const OWN_KEY = "statusboard.own.v1";
const EVERY = 60_000;
const PATIENCE = 12_000;

/** A service someone added for themselves. Kept in their browser only. */
interface Own {
  id: string;
  name: string;
  address: string;
  kind: "statuspage" | "site";
}
/** What the last check of a service found. */
interface Seen {
  report?: Report;
  /** Why it could not be read. */
  failed?: string;
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
}
const boardEl = el("board");
const headlineEl = el("headline");
const checkButton = el<HTMLButtonElement>("check");
const chooserEl = el("chooser");
const picksEl = el("picks");
const nameInput = el<HTMLInputElement>("own-name");
const addressInput = el<HTMLInputElement>("own-address");
const addButton = el<HTMLButtonElement>("own-add");
const noteEl = el("own-note");

// Browser storage that never throws (private windows, blocked site data)
function load(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function keep(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* the board works on without remembering */
  }
}
function loadOwn(): Own[] {
  const saved = load(OWN_KEY);
  if (!Array.isArray(saved)) return [];
  return saved.filter((o): o is Own => !!o && typeof o.id === "string" && typeof o.name === "string" && o.name.trim() !== "" && typeof o.address === "string" && webAddress(o.address) !== "" && (o.kind === "statuspage" || o.kind === "site")).slice(0, 60);
}
function loadHidden(): Set<string> {
  const saved = load(HIDDEN_KEY);
  return new Set(Array.isArray(saved) ? saved.filter((s): s is string => typeof s === "string") : []);
}

let own = loadOwn();
const hidden = loadHidden();
const seen = new Map<string, Seen>();
let running = false;
let checkedAt = 0;

function services(): Service[] {
  const mine = own.map((o): Service => ({ id: o.id, name: o.name, group: "Mine", kind: o.kind, feed: o.kind === "statuspage" ? summaryFeed(o.address) : undefined, page: o.address, own: true }));
  return [...mine, ...SERVICES];
}
function shown(): Service[] {
  return services().filter((s) => !hidden.has(s.id));
}

// ---- checking ----

async function fetchJson(address: string): Promise<unknown> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), PATIENCE);
  try {
    const answer = await fetch(address, { cache: "no-store", signal: stop.signal });
    if (!answer.ok) throw new Error(`The feed answered ${answer.status}.`);
    return (await answer.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}
/** Whether a website answers at all from this device. Says nothing about whether signing in works. */
async function answers(address: string): Promise<boolean> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), PATIENCE);
  try {
    await fetch(address, { mode: "no-cors", cache: "no-store", credentials: "omit", signal: stop.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
async function check(service: Service): Promise<Seen> {
  if (!navigator.onLine) return { failed: "This device is offline." };
  try {
    if (service.kind === "site") {
      return (await answers(service.page))
        ? { report: { level: "ok", summary: "Its website answers from this device. That does not prove signing in works.", incidents: [], parts: [] } }
        : { report: { level: "major", summary: "No answer from its website from this device.", incidents: [], parts: [] } };
    }
    const json = await fetchJson(service.feed ?? "");
    const report = service.kind === "slack" ? readSlack(json) : service.kind === "google" ? readGoogle(json, service.page) : readStatuspage(json);
    return { report };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return { failed: timedOut ? "Its status feed did not answer in time." : "Its status feed could not be read just now." };
  }
}
async function checkAll(): Promise<void> {
  if (running) return;
  running = true;
  checkButton.disabled = true;
  render();
  await Promise.all(shown().filter((s) => s.kind !== "link").map(async (service) => {
    seen.set(service.id, await check(service));
    render();
  }));
  checkedAt = Date.now();
  running = false;
  checkButton.disabled = false;
  render();
}

// ---- drawing ----

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag);
  if (cls) made.className = cls;
  if (text) made.textContent = text;
  return made;
}
function outside(text: string, address: string): HTMLAnchorElement {
  const a = h("a", "", text);
  a.href = address;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
const BADGE: Record<Level, string> = { ok: "✓ Fine", maintenance: "● Planned work", minor: "▲ Minor trouble", major: "◆ Major trouble", down: "■ Down", unknown: "? Not read" };
function badge(service: Service, level: Level | "wait" | "link"): string {
  if (level === "wait") return "… Checking";
  if (level === "link") return "No feed";
  if (service.kind === "site") return level === "ok" ? "✓ Answers" : "◆ No answer";
  return BADGE[level];
}
function levelOf(service: Service): Level | "wait" | "link" {
  if (service.kind === "link") return "link";
  const found = seen.get(service.id);
  return !found ? "wait" : found.report ? found.report.level : "unknown";
}
function card(service: Service, full: boolean): HTMLElement {
  const level = levelOf(service);
  const found = seen.get(service.id);
  const box = h("article", `svc lvl-${level}`);
  const name = h("div", "name");
  name.append(h("h3", "", service.name), h("span", "group", service.group), h("span", "badge", badge(service, level)));
  box.append(name);
  const says = found?.failed ?? (full || service.kind === "site" ? found?.report?.summary : "");
  if (says) box.append(h("p", "sum", says));
  if (full && found?.report) {
    if (found.report.parts.length) {
      const parts = h("ul", "parts");
      for (const part of found.report.parts.slice(0, 10)) parts.append(h("li", "", part));
      if (found.report.parts.length > 10) parts.append(h("li", "", `and ${found.report.parts.length - 10} more`));
      box.append(parts);
    }
    for (const incident of found.report.incidents.slice(0, 4)) {
      const inc = h("div", "inc");
      inc.append(h("strong", "", incident.title || "Incident"));
      const when = ago(incident.updated, Date.now());
      inc.append(h("span", "meta", [incident.state, when && `updated ${when}`].filter(Boolean).join(", ")));
      if (incident.text) inc.append(h("p", "", incident.text));
      if (incident.url) inc.append(outside("Read the incident", incident.url));
      box.append(inc);
    }
  }
  const links = h("div", "links");
  links.append(outside(service.kind === "site" ? "Open its website" : "Its status page", service.page), outside("Reports on Downdetector", reportsLink(service.name)));
  box.append(links);
  return box;
}
function section(title: string, list: Service[], full: boolean, why = ""): HTMLElement {
  const box = h("section");
  box.append(h("h2", "", `${title} (${list.length})`));
  if (why) box.append(h("p", "why", why));
  const cards = h("div", full ? "cards" : "rows");
  for (const service of list) cards.append(card(service, full));
  box.append(cards);
  return box;
}
function render(): void {
  const all = shown();
  const by = (wanted: (level: Level | "wait" | "link") => boolean): Service[] => all.filter((s) => wanted(levelOf(s)));
  const rank = (s: Service): number => RANK[levelOf(s) as Level];
  const trouble = by((l) => l === "down" || l === "major" || l === "minor" || l === "maintenance").sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const unread = by((l) => l === "unknown");
  const fine = by((l) => l === "ok" || l === "wait");
  const links = by((l) => l === "link");
  const read = all.length - links.length;
  const bad = trouble.filter((s) => levelOf(s) !== "maintenance").length;

  boardEl.textContent = "";
  const top = h("section");
  top.append(h("h2", "", `Trouble now (${trouble.length})`));
  if (trouble.length) {
    const cards = h("div", "cards");
    for (const service of trouble) cards.append(card(service, true));
    top.append(cards);
  } else {
    top.append(h("p", "calm", !all.length ? "No services chosen. Use Choose services to pick some." : running && !checkedAt ? "Checking…" : "Nothing reports trouble."));
  }
  boardEl.append(top);
  if (unread.length) boardEl.append(section("Could not be read", unread, false));
  if (fine.length) boardEl.append(section("Fine", fine, false));
  if (links.length) boardEl.append(section("No feed to read", links, false, "These publish nothing a page may read, so the board only links to them."));

  const time = checkedAt ? new Date(checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  headlineEl.className = bad ? "trouble" : "";
  headlineEl.textContent = !checkedAt
    ? `Checking ${read} ${read === 1 ? "service" : "services"}…`
    : `${bad ? `${bad} of ${read} ${bad === 1 ? "reports" : "report"} trouble` : read ? `All ${read} read are fine`.replace("All 1 read are", "The 1 read is") : "Nothing to read"}${unread.length ? `, ${unread.length} could not be read` : ""}. Checked at ${time}.`;
  if (checkedAt && !bad && unread.length) headlineEl.textContent = `${read - unread.length} of ${read} are fine, ${unread.length} could not be read. Checked at ${time}.`;
  document.title = bad ? `(${bad}) Status Board` : "Status Board";
}

// ---- choosing ----

function saveChoices(): void {
  keep(HIDDEN_KEY, [...hidden]);
  keep(OWN_KEY, own);
}
function drawPicks(): void {
  picksEl.textContent = "";
  let group = "";
  for (const service of services()) {
    if (service.group !== group) {
      group = service.group;
      picksEl.append(h("h4", "", group));
    }
    const row = h("div", "pick");
    const label = h("label");
    const box = h("input");
    box.type = "checkbox";
    box.checked = !hidden.has(service.id);
    box.addEventListener("change", () => {
      if (box.checked) hidden.delete(service.id);
      else hidden.add(service.id);
      saveChoices();
      render();
      if (box.checked && service.kind !== "link" && !seen.has(service.id)) void check(service).then((found) => (seen.set(service.id, found), render()));
    });
    label.append(box, document.createTextNode(service.name));
    row.append(label);
    if (service.own) {
      const remove = h("button", "btn", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => {
        own = own.filter((o) => o.id !== service.id);
        hidden.delete(service.id);
        seen.delete(service.id);
        saveChoices();
        drawPicks();
        render();
      });
      row.append(remove);
    }
    picksEl.append(row);
  }
}
async function addOwn(): Promise<void> {
  const name = nameInput.value.trim();
  const address = siteAddress(addressInput.value);
  if (!name) return void (noteEl.textContent = "Give it a name.");
  if (!address) return void (noteEl.textContent = "That does not look like a web address. Try something like www.example.com.");
  addButton.disabled = true;
  noteEl.textContent = "Looking for a status feed there…";
  let kind: Own["kind"] = "site";
  let first: Seen | null = null;
  try {
    first = { report: readStatuspage(await fetchJson(summaryFeed(address))) };
    kind = "statuspage";
  } catch {
    /* no feed there: watch the website instead */
  }
  const added: Own = { id: "own-" + Date.now().toString(36), name, address, kind };
  own = [...own, added];
  saveChoices();
  nameInput.value = "";
  addressInput.value = "";
  addButton.disabled = false;
  noteEl.textContent = kind === "statuspage"
    ? `Added ${name}. It publishes a status feed, so the board reads it.`
    : `Added ${name}. There is no status feed at that address, so the board checks that the website answers and links to Downdetector for reports.`;
  drawPicks();
  const service = services().find((s) => s.id === added.id);
  if (service) seen.set(added.id, first ?? (await check(service)));
  render();
}

el<HTMLButtonElement>("choose").addEventListener("click", () => {
  noteEl.textContent = "";
  drawPicks();
  chooserEl.hidden = false;
});
el<HTMLButtonElement>("chooser-close").addEventListener("click", () => {
  chooserEl.hidden = true;
});
addButton.addEventListener("click", () => void addOwn());
for (const input of [nameInput, addressInput]) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void addOwn();
  });
}
checkButton.addEventListener("click", () => void checkAll());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") chooserEl.hidden = true;
});

// Check again every minute while the page is in view, and on coming back to it
setInterval(() => {
  if (document.visibilityState === "visible") void checkAll();
}, EVERY);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - checkedAt > EVERY) void checkAll();
});
window.addEventListener("online", () => void checkAll());

el("version").textContent = `Status Board ${__VERSION__}`;
void checkAll();
