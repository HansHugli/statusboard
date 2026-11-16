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
}

function hosted(id: string, name: string, group: string, page: string): Service {
  return { id, name, group, kind: "statuspage", feed: new URL("/api/v2/summary.json", page).href, page };
}
function link(id: string, name: string, group: string, page: string): Service {
  return { id, name, group, kind: "link", page };
}

export const SERVICES: readonly Service[] = [
  hosted("claude", "Claude", "AI", "https://status.claude.com/"),
  hosted("openai", "OpenAI", "AI", "https://status.openai.com/"),

  hosted("github", "GitHub", "Building software", "https://www.githubstatus.com/"),
  hosted("npm", "npm", "Building software", "https://status.npmjs.org/"),
  hosted("docker", "Docker", "Building software", "https://www.dockerstatus.com/"),
  hosted("python", "Python packages", "Building software", "https://status.python.org/"),
  hosted("bitbucket", "Bitbucket", "Building software", "https://bitbucket.status.atlassian.com/"),
  hosted("vercel", "Vercel", "Building software", "https://www.vercel-status.com/"),
  hosted("netlify", "Netlify", "Building software", "https://www.netlifystatus.com/"),
  hosted("twilio", "Twilio", "Building software", "https://status.twilio.com/"),

  hosted("cloudflare", "Cloudflare", "Cloud", "https://www.cloudflarestatus.com/"),
  { id: "gcloud", name: "Google Cloud", group: "Cloud", kind: "google", feed: "https://status.cloud.google.com/incidents.json", page: "https://status.cloud.google.com/" },
  hosted("digitalocean", "DigitalOcean", "Cloud", "https://status.digitalocean.com/"),
  link("aws", "Amazon Web Services", "Cloud", "https://health.aws.amazon.com/health/status"),
  link("azure", "Microsoft Azure", "Cloud", "https://azure.status.microsoft/"),

  { id: "gworkspace", name: "Google Workspace", group: "Work", kind: "google", feed: "https://www.google.com/appsstatus/dashboard/incidents.json", page: "https://www.google.com/appsstatus/dashboard/" },
  { id: "slack", name: "Slack", group: "Work", kind: "slack", feed: "https://slack-status.com/api/v2.0.0/current", page: "https://slack-status.com/" },
  hosted("zoom", "Zoom", "Work", "https://www.zoomstatus.com/"),
  hosted("dropbox", "Dropbox", "Work", "https://status.dropbox.com/"),
  hosted("atlassian", "Atlassian", "Work", "https://status.atlassian.com/"),
  hosted("notion", "Notion", "Work", "https://www.notion-status.com/"),
  hosted("figma", "Figma", "Work", "https://status.figma.com/"),
  hosted("linkedin", "LinkedIn", "Work", "https://www.linkedin-status.com/"),
  link("m365", "Microsoft 365", "Work", "https://status.cloud.microsoft/"),

  hosted("discord", "Discord", "Social and play", "https://discordstatus.com/"),
  hosted("reddit", "Reddit", "Social and play", "https://www.redditstatus.com/"),
  hosted("twitch", "Twitch", "Social and play", "https://status.twitch.com/"),
  hosted("epic", "Epic Games", "Social and play", "https://status.epicgames.com/"),
  link("apple", "Apple services", "Social and play", "https://www.apple.com/support/systemstatus/"),
  link("playstation", "PlayStation Network", "Social and play", "https://status.playstation.com/"),
  link("xbox", "Xbox", "Social and play", "https://support.xbox.com/xbox-live-status"),

  hosted("shopify", "Shopify", "Shops and payments", "https://www.shopifystatus.com/"),
  hosted("square", "Square", "Shops and payments", "https://www.issquareup.com/"),
  hosted("coinbase", "Coinbase", "Shops and payments", "https://status.coinbase.com/"),
];

/** Where to look for what other people are reporting. Opened by the person, never read by the board. */
export function reportsLink(name: string): string {
  return `https://downdetector.com/search/?q=${encodeURIComponent(name)}`;
}
