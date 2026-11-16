// Reading the status feeds that services publish about themselves. No screen code here:
// each reader takes what a feed sent and gives back the same plain report.

export type Level = "ok" | "maintenance" | "minor" | "major" | "down" | "unknown";
/** Worst first, for sorting. */
export const RANK: Record<Level, number> = { down: 0, major: 1, minor: 2, maintenance: 3, unknown: 4, ok: 5 };

export interface Incident {
  title: string;
  /** Where the service says it is with it, such as "investigating". */
  state: string;
  /** When it was last updated, as the feed gave it; empty when it did not say. */
  updated: string;
  /** The latest update in the service's own words, cut short. */
  text: string;
  url: string;
}
export interface Report {
  level: Level;
  summary: string;
  incidents: Incident[];
  /** The parts of the service that are not working as usual. */
  parts: string[];
}

type Bag = Record<string, unknown>;
function bag(value: unknown): Bag {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not the feed expected");
  return value as Bag;
}
function list(value: unknown): Bag[] {
  return Array.isArray(value) ? value.filter((v): v is Bag => !!v && typeof v === "object" && !Array.isArray(v)) : [];
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
/** Plain words from a feed's text: no tags, no markdown marks, one line, cut to a length. */
export function plain(value: unknown, most = 280): string {
  const words = text(value).replace(/<[^>]*>/g, " ").replace(/[#*_`>]+/g, " ").replace(/\s+/g, " ").trim();
  return words.length > most ? words.slice(0, most - 1).trimEnd() + "…" : words;
}
/** A link is kept only if it is an ordinary web address. */
export function webAddress(value: unknown, base?: string): string {
  try {
    const url = new URL(text(value), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}
function words(code: unknown): string {
  return text(code).replace(/_/g, " ").toLowerCase();
}

const INDICATOR: Record<string, Level> = { none: "ok", minor: "minor", major: "major", critical: "down", maintenance: "maintenance" };
/** The summary feed of a hosted status page (the kind most services use). */
export function readStatuspage(json: unknown): Report {
  const feed = bag(json);
  const status = bag(feed.status);
  const indicator = INDICATOR[text(status.indicator)];
  if (!indicator) throw new Error("not the feed expected");
  const parts = list(feed.components)
    .filter((c) => c.group !== true && text(c.status) !== "" && text(c.status) !== "operational")
    .map((c) => `${text(c.name)}: ${words(c.status)}`);
  const incidents = list(feed.incidents).map((i): Incident => ({
    title: plain(i.name, 160),
    state: words(i.status),
    updated: text(i.updated_at),
    text: plain(list(i.incident_updates)[0]?.body),
    url: webAddress(i.shortlink),
  }));
  const works = list(feed.scheduled_maintenances)
    .filter((m) => text(m.status) === "in_progress" || text(m.status) === "verifying")
    .map((m): Incident => ({
      title: plain(m.name, 160),
      state: "planned work under way",
      updated: text(m.updated_at),
      text: plain(list(m.incident_updates)[0]?.body),
      url: webAddress(m.shortlink),
    }));
  const level = indicator === "ok" && works.length ? "maintenance" : indicator;
  return { level, summary: plain(status.description, 120) || (level === "ok" ? "All systems operational" : "Trouble reported"), incidents: [...incidents, ...works], parts };
}

/** Slack's own feed: a list of what is open now. */
export function readSlack(json: unknown): Report {
  const feed = bag(json);
  if (feed.status !== "ok" && feed.status !== "active") throw new Error("not the feed expected");
  const open = list(feed.active_incidents);
  const kinds = open.map((i) => text(i.type));
  const level: Level = !open.length ? "ok" : kinds.includes("outage") ? "major" : kinds.every((k) => k === "maintenance") ? "maintenance" : "minor";
  const incidents = open.map((i): Incident => ({
    title: plain(i.title, 160),
    state: words(i.status) || words(i.type),
    updated: text(i.date_updated),
    text: plain(list(i.notes)[0]?.body),
    url: webAddress(i.url),
  }));
  const parts = [...new Set(open.flatMap((i) => (Array.isArray(i.services) ? i.services.filter((s): s is string => typeof s === "string") : [])))];
  return { level, summary: open.length ? `${open.length} open ${open.length === 1 ? "issue" : "issues"}` : "No open issues", incidents, parts };
}

const IMPACT: Record<string, Level> = { SERVICE_OUTAGE: "major", SERVICE_DISRUPTION: "minor", SERVICE_INFORMATION: "minor" };
/** Google's feeds (Cloud and Workspace): every incident of late; the ones with no end are open. */
export function readGoogle(json: unknown, page: string): Report {
  if (!Array.isArray(json)) throw new Error("not the feed expected");
  const open = list(json).filter((i) => !text(i.end));
  let level: Level = "ok";
  for (const i of open) {
    const one = IMPACT[text(i.status_impact)] ?? "minor";
    if (RANK[one] < RANK[level]) level = one;
  }
  const incidents = open.map((i): Incident => {
    const latest = i.most_recent_update && typeof i.most_recent_update === "object" ? (i.most_recent_update as Bag) : {};
    return {
      title: plain(i.external_desc, 160),
      state: words(i.status_impact).replace(/^service /, ""),
      updated: text(latest.when) || text(i.modified),
      text: plain(latest.text),
      url: webAddress(i.uri, page),
    };
  });
  const parts = [...new Set(open.flatMap((i) => list(i.affected_products).map((p) => text(p.title)).filter(Boolean)))].slice(0, 8);
  return { level, summary: open.length ? `${open.length} open ${open.length === 1 ? "incident" : "incidents"}` : "No open incidents", incidents, parts };
}

/** How long ago, in a few words. Empty when the time cannot be read. */
export function ago(when: string, now: number): string {
  const then = Date.parse(when);
  if (!when || Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** What someone typed as a web address, made whole; null when it is not one. */
export function siteAddress(typed: string): string | null {
  const trimmed = typed.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const whole = /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
  try {
    const url = new URL(whole);
    return url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}
/** Where a hosted status page keeps its summary feed, given any address on that page's site. */
export function summaryFeed(address: string): string {
  return new URL("/api/v2/summary.json", address).href;
}
