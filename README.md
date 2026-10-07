# Tiger Scout

Tiger Scout is Team 9072's completely local FRC match-scouting app. Scouts record matches,
generate QR codes, and pass those records to a collector device without venue
Wi-Fi, cellular data, accounts, or a backend server.

## Start the app

On Windows, right-click `Start-PitLink.ps1` and choose **Run with PowerShell**.
It finds an available local port automatically and opens the app there.

For development on a new workstation, install a current Node.js LTS release,
open this folder in a terminal, then run:

```text
npm ci
npm run dev
```

Use `npm run build` before publishing. Runtime secrets are not stored in this
repository; configure `TBA_API_KEY`, `MATCH13_API_KEY`, and `SYNC_TOKEN` again in
the hosting service when moving to a different host.

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

1. Open **Events** on the lead device, enter the event details and numeric team
   roster, then create the Event Setup QR.
2. Open **Events** on every scouting device and scan that QR. The event is saved,
   selected, and its team roster is preloaded without internet access.
3. Each scout chooses the event from the scouting dropdown, enters whole-number
   match and team numbers, and displays the resulting record QR.
4. The collector device scans every QR from the six scouts.
5. The dataset, rankings, charts, and team match histories update locally.
6. Export CSV for analysis or JSON for a full backup.

The Events tab also accepts setup QR screenshots and pasted setup payloads. Saved
event configurations can be selected again or reshared from the same tab.

On iPhone, the QR camera can switch between the back and front cameras. The
**Scan from screenshot** controls use the same full-resolution image decoder for
event setup QRs, scouting records, Match Prep packets, and device backups. Team
photo pickers use Apple's full camera/photo-library chooser instead of forcing a
specific lens, which improves compatibility with older phones such as iPhone SE.
If live video is blocked, **Take a QR photo** opens the native iPhone camera and
decodes the picture immediately, while **Choose QR photo or screenshot** imports
an existing image. Both routes work without granting continuous live-video access.

## Match Prep handoff

Match Prep mode can save either a scheduled match or a six-team manual matchup
to an offline catalog. Select each team and tap its autonomous starting position
on the field map, then add a short note for every robot. **Save & build compact
QR** creates one high-contrast code containing the six team numbers, each
alliance's predicted/minimum/maximum score, win probability, auto positions, and
team notes. It deliberately excludes scouting records, schedules, and analytics
so the code stays easy to scan. The receiving device scans it from the camera or
a saved image and adds the complete plan under **Match Prep → Saved preps**.

## Move to another workstation

The source ZIP contains the files needed to install, run, test, and publish the
app. It intentionally excludes `.git`, `node_modules`, generated builds, local
cache folders, and secret values. After extracting it, run `npm ci` and
`npm run dev`.

Browser data is separate from the source code. To move scouting records too,
export a JSON backup from Tiger Scout on the old device and import that backup on
the new device. Re-enter hosting secrets and any device-local API settings rather
than copying credential files.

## CRI 2026 preset

The September 2026 deployment prepares each device once for the Chesapeake
Robotics Icebreaker. It selects `CRI 2026`, saves The Blue Alliance event key
`2026vaale1`, clears a schedule left over from a different event, and keeps all
older scouting events intact. The home briefing includes the host's registered
32-robot roster, tournament date, venue, and official-schedule status.

CRI match sync uses the hosted `TBA_API_KEY` secret through the Site Worker, so
scouting phones do not need or receive the API key. Browser-supplied keys remain
available for other events, season-stat requests, and team-logo downloads.

## Team robot photos

Open a team from Data Readout and use **Pull from Blue Alliance** beside the
camera/photo picker. While online, Tiger Scout looks up that team in the season
selected under Settings, downloads its preferred robot photo when available,
resizes it, and saves it on the device for offline reference. The hosted Site
uses its protected TBA connection; local deployments can fall back to the TBA
API key saved in Settings.

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

The **Load competition test data** action replaces earlier demo records with a
simulated CRI dataset that follows the current scouting sheet: 0–15 BSP rates,
scoring time, calculated FUEL, tower results, intake and field access, separate
defense participation and rating, fouls, breakdowns, scout names, and notes.

## Data Readout

Team rankings focus on the highest recorded scoring flow rate (**Peak BSP**) and
average estimated points. The variance chart shows each leading team's standard
deviation in points; a lower bar means its match scoring has been more
predictable. Match13 XP, XP rank, tower rate, and consistency are hidden from this
readout to keep the competition view focused.

## Protected data editor

Open **Settings**, enter the initial editor password `Tigerbots`, and choose
**Unlock editor**. The Editor tab provides event filtering, search, and inline
editing for every scouting record. The password can be changed in Settings.

All libraries are bundled under `public/vendor`. Scouting, Match Prep handoff,
and QR transfer make no internet requests. Optional cloud synchronization only
runs when a user presses **Sync database**. Notes, Pre-Scouting, Compare, and
the Match13 settings card are currently hidden without deleting their saved
device data. Match13 XP replaces Statbotics EPA on Team 9072's home spotlight,
team profiles, Match Prep forecasts, and the six-team Match Prep QR packet. The
hosted Worker keeps `MATCH13_API_KEY` private and the app ignores Match13 data
when that service is unavailable.

## ChatGPT Sites hosting

Tiger Scout reuses the former Blackjack Move Lab Site. Its binding is recorded
in `.openai/hosting.json`; do not create a second Site for future deployments.
Run `npm run build` to produce its Worker and verified offline assets. The Sites
build plugin includes the hosting metadata and generated Drizzle migrations.
Sites manages the `DB` database; `SYNC_TOKEN` and `MATCH13_API_KEY` are private
runtime secrets, not part of the deployed browser code.

Opening the new address starts a separate device-local store. Export a JSON
backup from the old address and import it on the new one to bring scouting
records over. Team photos, downloaded logos, picklists, and preferences remain
in the old browser store and need to be saved or configured separately. The new
hosted database begins empty until Commander mode syncs imported records.

The current Tiger Scout Site is public. Open it online once before installing and
preparing it for offline use.

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
