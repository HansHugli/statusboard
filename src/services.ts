// The services the board knows from the start. Each one publishes a feed that a web page
// is allowed to read, except the "link" ones, which only get links.
//
// Nothing personal belongs in this list: the repository is public. Services someone adds
// for themselves are kept in their own browser only.

export type Kind = "statuspage" | "slack" | "google" | "site" | "link";
export interface Service {
  id: string;
  name: string;
  group: string;
  kind: Kind;
  /** The feed to read, for the kinds that have one. */
  feed?: string;
  /** The page a person opens: the service's own status page, or its website. */
  page: string;
  /** Added by the person using the board. */
  own?: boolean;
  /** The service's page on Downdetector, opened by the person and never read by the board. Left out when not known. */
  reports?: string;
}

/** A name as Downdetector writes it in an address: "Example Bank" becomes "example-bank". */
export function slug(name: string): string {
  return name.toLowerCase().replace(/&/g, " and ").replace(/['\u2019.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
/** A service's page on Downdetector, from its name there. Empty when the name gives nothing to go on. */
export function reportsPage(name: string): string {
  const part = slug(name);
  return part ? `https://downdetector.com/status/${part}/` : "";
}
/** What someone pasted as a Downdetector page: kept only if it is an address on a Downdetector site. */
export function pastedReports(typed: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(typed.trim()) ? typed.trim() : "https://" + typed.trim());
    return /^(www\.)?downdetector\.(com|[a-z]{2,3}|com?\.[a-z]{2})$/i.test(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}
// The last word is the service's name on Downdetector, where it is known. None of these could be
// checked by program (Downdetector does not allow it), so a wrong one is fixed here by hand.
function hosted(id: string, name: string, group: string, page: string, on = ""): Service {
  return { id, name, group, kind: "statuspage", feed: new URL("/api/v2/summary.json", page).href, page, reports: reportsPage(on) };
}
function link(id: string, name: string, group: string, page: string, on = ""): Service {
  return { id, name, group, kind: "link", page, reports: reportsPage(on) };
}

export const SERVICES: readonly Service[] = [
  hosted("claude", "Claude", "AI", "https://status.claude.com/", "claude-ai"),
  hosted("openai", "OpenAI", "AI", "https://status.openai.com/", "openai"),

  hosted("github", "GitHub", "Building software", "https://www.githubstatus.com/", "github"),
  hosted("npm", "npm", "Building software", "https://status.npmjs.org/"),
  hosted("docker", "Docker", "Building software", "https://www.dockerstatus.com/", "docker"),
  hosted("python", "Python packages", "Building software", "https://status.python.org/"),
  hosted("bitbucket", "Bitbucket", "Building software", "https://bitbucket.status.atlassian.com/", "bitbucket"),
  hosted("vercel", "Vercel", "Building software", "https://www.vercel-status.com/", "vercel"),
  hosted("netlify", "Netlify", "Building software", "https://www.netlifystatus.com/", "netlify"),
  hosted("twilio", "Twilio", "Building software", "https://status.twilio.com/", "twilio"),

  hosted("cloudflare", "Cloudflare", "Cloud", "https://www.cloudflarestatus.com/", "cloudflare"),
  { id: "gcloud", name: "Google Cloud", group: "Cloud", kind: "google", feed: "https://status.cloud.google.com/incidents.json", page: "https://status.cloud.google.com/", reports: reportsPage("google-cloud") },
  hosted("digitalocean", "DigitalOcean", "Cloud", "https://status.digitalocean.com/", "digitalocean"),
  link("aws", "Amazon Web Services", "Cloud", "https://health.aws.amazon.com/health/status", "aws-amazon-web-services"),
  link("azure", "Microsoft Azure", "Cloud", "https://azure.status.microsoft/", "windows-azure"),

  { id: "gworkspace", name: "Google Workspace", group: "Work", kind: "google", feed: "https://www.google.com/appsstatus/dashboard/incidents.json", page: "https://www.google.com/appsstatus/dashboard/", reports: reportsPage("google-workspace") },
  { id: "slack", name: "Slack", group: "Work", kind: "slack", feed: "https://slack-status.com/api/v2.0.0/current", page: "https://slack-status.com/", reports: reportsPage("slack") },
  hosted("zoom", "Zoom", "Work", "https://www.zoomstatus.com/", "zoom"),
  hosted("dropbox", "Dropbox", "Work", "https://status.dropbox.com/", "dropbox"),
  hosted("atlassian", "Atlassian", "Work", "https://status.atlassian.com/", "atlassian"),
  hosted("notion", "Notion", "Work", "https://www.notion-status.com/", "notion"),
  hosted("figma", "Figma", "Work", "https://status.figma.com/", "figma"),
  hosted("linkedin", "LinkedIn", "Work", "https://www.linkedin-status.com/", "linkedin"),
  link("m365", "Microsoft 365", "Work", "https://status.cloud.microsoft/", "microsoft-365"),

  hosted("discord", "Discord", "Social and play", "https://discordstatus.com/", "discord"),
  hosted("reddit", "Reddit", "Social and play", "https://www.redditstatus.com/", "reddit"),
  hosted("twitch", "Twitch", "Social and play", "https://status.twitch.com/", "twitch"),
  hosted("epic", "Epic Games", "Social and play", "https://status.epicgames.com/", "epic-games-store"),
  link("apple", "Apple services", "Social and play", "https://www.apple.com/support/systemstatus/"),
  link("playstation", "PlayStation Network", "Social and play", "https://status.playstation.com/", "playstation-network"),
  link("xbox", "Xbox", "Social and play", "https://support.xbox.com/xbox-live-status", "xbox-live"),

  hosted("shopify", "Shopify", "Shops and payments", "https://www.shopifystatus.com/", "shopify"),
  hosted("square", "Square", "Shops and payments", "https://www.issquareup.com/", "square"),
  hosted("coinbase", "Coinbase", "Shops and payments", "https://status.coinbase.com/", "coinbase"),
];
