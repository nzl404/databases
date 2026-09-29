# Centralized Databases Repository

Public dataset repository providing structured data for bot services, APIs, and web applications.

## Directory Structure

### Islamic (`islamic/`)
- [asmaulhusna.json](islamic/asmaulhusna.json) — 99 Asmaul Husna with Arabic script, Latin transliteration, and Indonesian translations.
- [doaharian.json](islamic/doaharian.json) — Daily Islamic prayers and invocations.
- [ayatkursi.json](islamic/ayatkursi.json) — Ayat Kursi in Arabic, Latin transliteration, and meaning.
- [bacaansholat.json](islamic/bacaansholat.json) — Complete Salah recitations and guides.
- [niatsholat.json](islamic/niatsholat.json) — Intentions (Niyyah) for obligatory and sunnah prayers.
- [wirid.json](islamic/wirid.json) — Post-prayer dhikr and wirid recitations.
- [tahlil.json](islamic/tahlil.json) — Complete Tahlil sequence and readings.

### JKT48 (`jkt48/`)
- **[all_members.json](jkt48/all_members.json)** — Complete historical dataset of **249 JKT48 members (Generation 1 to Generation 14)**, containing 58 active members and 191 graduated alumni. Schema:
  - `id`: Unique identifier
  - `slug`: Member URL slug
  - `name`: Full member name
  - `generation`: Debut generation number (1–14)
  - `graduated`: Boolean flag indicating graduation status
  - `trainee`: Boolean flag indicating trainee status
  - `team`: Team assignment (`DREAM`, `LOVE`, `PASSION`, `TRAINEE`, `EX-MEMBER`)
  - `picture`: Local filename in `static/members/`
  - `image_url`: Raw CDN URL to member photo
- **[member.json](jkt48/member.json)** — Dataset of all 58 currently active members categorized across Team Dream (12), Team Love (13), Team Passion (15), and Trainee (18). Includes full profile metadata, birth dates, zodiac signs, social media handles, and jikoshoukai catchphrases.
- **`static/members/`** — Optimized WebP/JPG photo assets for all 249 members.

### Media (`asupan/`)
- [cecan.json](asupan/cecan.json) — Curated photo dataset.

---

## Automated Member Synchronization

This repository includes automated maintenance scripts located in `scripts/`:

1. **`scripts/sync_member_json.js`**:
   - Synchronizes `jkt48/member.json` and updates `all_members.json` with active status.
   - Detects newly graduated members and updates team rosters.
   - Preserves manual graduation overrides via `KNOWN_GRADUATED_NAMES`.

2. **`scripts/sync_jkt48_members.js`**:
   - Checks upstream sources for new debut generations (e.g., Gen 15+).
   - Downloads official photo assets into `jkt48/static/members/`.
   - Automatically appends new member records into `jkt48/all_members.json`.

---

## Usage Example

To fetch the datasets directly in web or backend applications:

```javascript
// Fetch complete member dataset (active and alumni)
const response = await fetch('https://raw.githubusercontent.com/nzl404/databases/master/jkt48/all_members.json');
const data = await response.json();
console.log(`Total Records: ${data.total}`);

// Fetch active members with detailed metadata
const activeResponse = await fetch('https://raw.githubusercontent.com/nzl404/databases/master/jkt48/member.json');
const activeData = await activeResponse.json();
console.log(`Active Members: ${activeData.total}`);
```
