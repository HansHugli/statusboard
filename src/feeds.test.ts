import assert from "node:assert/strict";
import { test } from "node:test";
import { pastedReports, reportsPage, slug } from "./services.ts";
import { RANK, ago, plain, readGoogle, readSlack, readStatuspage, siteAddress, summaryFeed, webAddress } from "./feeds.ts";

// Every feed below is made up, in the shape the real ones have.

test("a status page with nothing wrong reads as fine", () => {
  const report = readStatuspage({
    status: { indicator: "none", description: "All Systems Operational" },
    components: [{ name: "Website", status: "operational" }, { name: "Group", status: "degraded_performance", group: true }],
    incidents: [],
    scheduled_maintenances: [{ name: "Next week", status: "scheduled" }],
  });
  assert.deepEqual(report, { level: "ok", summary: "All Systems Operational", incidents: [], parts: [] });
  // Some hosts leave the lists out when they are empty
  assert.equal(readStatuspage({ status: { indicator: "none", description: "" }, components: [] }).summary, "All systems operational");
});

test("a status page with trouble gives the level, the parts hit and the latest word on each incident", () => {
  const report = readStatuspage({
    status: { indicator: "major", description: "Partial System Outage" },
    components: [{ name: "Sign-in", status: "partial_outage" }, { name: "Website", status: "operational" }],
    incidents: [{
      name: "Sign-in is failing for some people",
      status: "identified",
      updated_at: "2030-01-02T10:00:00Z",
      shortlink: "https://stspg.example/abc",
      incident_updates: [{ body: "We have <b>found</b> the cause\nand are **fixing** it." }, { body: "Looking into it." }],
    }],
  });
  assert.equal(report.level, "major");
  assert.deepEqual(report.parts, ["Sign-in: partial outage"]);
  assert.deepEqual(report.incidents, [{ title: "Sign-in is failing for some people", state: "identified", updated: "2030-01-02T10:00:00Z", text: "We have found the cause and are fixing it.", url: "https://stspg.example/abc" }]);
  assert.equal(readStatuspage({ status: { indicator: "critical", description: "Down" } }).level, "down");
});

test("planned work under way shows as maintenance, not trouble", () => {
  const report = readStatuspage({
    status: { indicator: "none", description: "All Systems Operational" },
    scheduled_maintenances: [{ name: "Database move", status: "in_progress", updated_at: "2030-01-02T10:00:00Z", incident_updates: [{ body: "Started." }] }],
  });
  assert.equal(report.level, "maintenance");
  assert.equal(report.incidents[0]!.state, "planned work under way");
});

test("something that is not a status feed is refused", () => {
  assert.throws(() => readStatuspage("<html>"));
  assert.throws(() => readStatuspage({ status: { indicator: "purple" } }));
  assert.throws(() => readStatuspage({ page: {} }));
  assert.throws(() => readSlack({ status: "maybe" }));
  assert.throws(() => readGoogle({}, "https://status.example/"));
});

test("Slack's feed: fine when nothing is open, worse for an outage than for an incident", () => {
  assert.deepEqual(readSlack({ status: "ok", active_incidents: [] }), { level: "ok", summary: "No open issues", incidents: [], parts: [] });
  const one = { title: "Messages are slow", type: "incident", status: "active", date_updated: "2030-01-02T10:00:00-08:00", url: "https://status.example/1", services: ["Messaging"], notes: [{ body: "We are looking." }] };
  const report = readSlack({ status: "active", active_incidents: [one, { ...one, title: "Calls", services: ["Messaging", "Calls"] }] });
  assert.equal(report.level, "minor");
  assert.equal(report.summary, "2 open issues");
  assert.deepEqual(report.parts, ["Messaging", "Calls"]);
  assert.equal(report.incidents[0]!.text, "We are looking.");
  assert.equal(readSlack({ status: "active", active_incidents: [{ ...one, type: "outage" }] }).level, "major");
  assert.equal(readSlack({ status: "active", active_incidents: [{ ...one, type: "maintenance" }] }).level, "maintenance");
});

test("Google's feed: only incidents with no end are open", () => {
  const over = { external_desc: "Old trouble", begin: "2030-01-01T00:00:00+00:00", end: "2030-01-01T02:00:00+00:00", status_impact: "SERVICE_OUTAGE" };
  assert.equal(readGoogle([over], "https://status.example/").level, "ok");
  const open = { external_desc: "Storage is slow in one region", status_impact: "SERVICE_DISRUPTION", uri: "incidents/abc", most_recent_update: { when: "2030-01-02T10:00:00+00:00", text: "# Update\nMitigation is under way." }, affected_products: [{ title: "Storage" }, { title: "Storage" }] };
  const report = readGoogle([over, open, { ...open, status_impact: "SERVICE_OUTAGE" }], "https://status.example/");
  assert.equal(report.level, "major");
  assert.equal(report.summary, "2 open incidents");
  assert.deepEqual(report.parts, ["Storage"]);
  assert.deepEqual(report.incidents[0], { title: "Storage is slow in one region", state: "disruption", updated: "2030-01-02T10:00:00+00:00", text: "Update Mitigation is under way.", url: "https://status.example/incidents/abc" });
});

test("feed text becomes plain words, and only web addresses are kept as links", () => {
  assert.equal(plain("  <p>Hello</p>\n\n<script>x</script> there  "), "Hello x there");
  assert.equal(plain("a".repeat(400)).length, 280);
  assert.equal(plain(42), "");
  assert.equal(webAddress("javascript:alert(1)"), "");
  assert.equal(webAddress("https://status.example/x"), "https://status.example/x");
  assert.equal(webAddress(undefined), "");
});

test("times read as how long ago", () => {
  const now = Date.parse("2030-01-02T12:00:00Z");
  assert.equal(ago("2030-01-02T11:59:50Z", now), "just now");
  assert.equal(ago("2030-01-02T11:40:00Z", now), "20 min ago");
  assert.equal(ago("2030-01-02T11:00:00Z", now), "1 hour ago");
  assert.equal(ago("2029-12-28T12:00:00Z", now), "5 days ago");
  assert.equal(ago("", now), "");
  assert.equal(ago("soon", now), "");
});

test("an address someone types is made whole or refused", () => {
  assert.equal(siteAddress("bank.example"), "https://bank.example/");
  assert.equal(siteAddress(" https://www.bank.example/login "), "https://www.bank.example/login");
  assert.equal(siteAddress("not an address"), null);
  assert.equal(siteAddress("localhost"), null);
  assert.equal(siteAddress(""), null);
  assert.equal(summaryFeed("https://status.bank.example/history?page=2"), "https://status.bank.example/api/v2/summary.json");
});

test("levels sort worst first", () => {
  assert.deepEqual(["ok", "minor", "down", "unknown", "major", "maintenance"].sort((a, b) => RANK[a as keyof typeof RANK] - RANK[b as keyof typeof RANK]), ["down", "major", "minor", "maintenance", "unknown", "ok"]);
});

test("a Downdetector page is worked out from a name, or taken as pasted", () => {
  assert.equal(slug("Example Bank"), "example-bank");
  assert.equal(slug("  Smith & Sons' Co.  "), "smith-and-sons-co");
  assert.equal(reportsPage("Example Bank"), "https://downdetector.com/status/example-bank/");
  assert.equal(reportsPage("???"), "");
  assert.equal(pastedReports("downdetector.com/status/example-bank/"), "https://downdetector.com/status/example-bank/");
  assert.equal(pastedReports("https://downdetector.co.uk/status/example/"), "https://downdetector.co.uk/status/example/");
  assert.equal(pastedReports("https://notdowndetector.com/x"), null);
  assert.equal(pastedReports("https://downdetector.com.evil.example/x"), null);
});
