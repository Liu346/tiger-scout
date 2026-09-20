# Tiger Scout

Tiger Scout is Team 9072's completely local FRC match-scouting app. Scouts record matches,
generate QR codes, and pass those records to a collector device without venue
Wi-Fi, cellular data, accounts, or a backend server.

## Start the app

On Windows, right-click `Start-PitLink.ps1` and choose **Run with PowerShell**.
It finds an available local port automatically and opens the app there.

You can also open `index.html` directly to preview the interface. Use the local
server for camera scanning and offline installation because browsers restrict
those features on `file://` pages.

## Install on iPhone

1. Host Tiger Scout at an HTTPS address and open it in Safari on the iPhone.
2. Tap Safari's **Share** button.
3. Choose **Add to Home Screen**, then tap **Add**.
4. Open Tiger Scout from its new Home Screen icon once while online.

After that first load, the app opens full-screen and its scouting, QR, dataset,
picklist, and editor features work offline. iOS requires HTTPS for camera access
and service-worker installation; a computer's `localhost` address is not
reachable as `localhost` from an iPhone.

## Event workflow

1. Open and install Tiger Scout on each device before arriving at the venue.
2. Each scout records a robot's match and displays the resulting QR.
3. The collector device scans every QR from the six scouts.
4. The dataset, rankings, charts, and team match histories update locally.
5. Export CSV for analysis or JSON for a full backup.

## Match Prep handoff

Match Prep mode can save either a scheduled match or a six-team manual matchup
to an offline catalog. A saved prep includes both alliances, projected scores,
win chance, event, and timestamp. Use **Save & show QR**, then scan the code on
another Tiger Scout device from its Scan tab. The imported prep appears under
**Match Prep → Saved preps** even when the receiving device does not have the
original scouting dataset.

## CRI 2026 preset

The September 2026 deployment prepares each device once for the Chesapeake
Robotics Icebreaker. It selects `CRI 2026`, saves The Blue Alliance event key
`2026vaale1`, clears a schedule left over from a different event, and keeps all
older scouting events intact. The home briefing includes the host's registered
32-robot roster, tournament date, venue, and official-schedule status.

CRI match sync uses the hosted `TBA_API_KEY` secret through the Site Worker, so
scouting phones do not need or receive the API key. Browser-supplied keys remain
available for other events, season-stat requests, and team-logo downloads.

## Fuel flow scouting

AUTO and TELEOP use a 0–15 BSP (balls per second) slider with a live fuel stream.
The visual keeps ball travel speed constant and changes only the spacing between
balls. Every stream is synchronized at equal intervals, so denser streams
represent higher rates without implying faster shots.
Enter the total seconds spent scoring into an active HUB for each phase. The app
estimates scored fuel as flow rate × seconds, rounded to whole balls, for the
existing score graphs and rankings. A nonzero flow rate requires scoring time.
Historical fuel counts are preserved. New rates, durations, and the separate
**Played defense** checkbox are included in QR transfers, backups, and exports.
The editor can change rates and durations and recalculates their estimates.

## Protected data editor

Open **Settings**, enter the initial editor password `Tigerbots`, and choose
**Unlock editor**. The Editor tab provides event filtering, search, and inline
editing for every scouting record. The password can be changed in Settings.

All libraries are bundled under `public/vendor`. Scouting, Match Prep handoff,
and QR transfer make no internet requests. Optional cloud synchronization only
runs when a user presses **Sync database**. Notes, Pre-Scouting, Compare, and
the Statbotics settings card are currently hidden without deleting their saved
device data.

## ChatGPT Sites hosting

Tiger Scout reuses the former Blackjack Move Lab Site. Its binding is recorded
in `.openai/hosting.json`; do not create a second Site for future deployments.
Run `npm run build` to produce its Worker and verified offline assets. The Sites
build plugin includes the hosting metadata and generated Drizzle migrations.
Sites manages the `DB` database; `SYNC_TOKEN` is a private runtime secret, not
part of the deployed browser code.

Opening the new address starts a separate device-local store. Export a JSON
backup from the old address and import it on the new one to bring scouting
records over. Team photos, downloaded logos, picklists, and preferences remain
in the old browser store and need to be saved or configured separately. The new
hosted database begins empty until Commander mode syncs imported records.

Access is private to the Site owner until explicitly shared. Open the new Site
online and sign in before installing and preparing it for offline use.

## Alternative direct Cloudflare D1 hosting

The repository includes a D1 schema and Worker API. To activate it:

1. Run `npx wrangler d1 create tiger-scout`.
2. Put the returned database ID in `wrangler.toml`.
3. Run `npx wrangler d1 execute tiger-scout --remote --file=./schema.sql`.
4. Run `npx wrangler secret put SYNC_TOKEN` and enter a private team token.
5. Run `npx wrangler deploy`.

Enter the same team token under **Settings → Cloud database** on each device.
Local scouting remains fully usable when the venue has no connection; sync can
be run later when internet access returns.
