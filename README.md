# Status Board

One page that shows whether the services you care about are having trouble.

Live at https://hanshugli.github.io/statusboard/

## What it reads

Each service is read from the status feed it publishes about itself (most use a hosted status page with a summary feed; Slack and Google have their own). The page reads them straight from the browser, once a minute while it is open. There is no server.

It does **not** read Downdetector. Downdetector does not allow programs to read its pages, so each service only has a link that opens Downdetector for you.

## Your own services

"Choose services" lets you untick what you do not care about and add your own: a name and a web address. If a status feed is found at that address the board reads it. If not, the board checks that the website answers from your device, which does not prove that signing in works, and links to Downdetector.

What you add and untick is kept in your browser only. The list in `src/services.ts` is public, so nothing personal belongs there.

## Working on it

- `npm run dev` to work on it, `npm run check` for types and tests, `npm run build` for the site.
- `src/feeds.ts` reads the feeds and has the tests; `src/services.ts` is the list; `src/main.ts` is the page.
- Every push to `main` publishes through `.github/workflows/pages.yml`. `npm run ship` checks, releases, builds and pushes.
