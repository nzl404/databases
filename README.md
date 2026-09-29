# Centralized Databases Repository

Public datasets repository for bot features, tools, and web applications.

## Repository Structure

### 🕌 Islamic (`islamic/`)
- [asmaulhusna.json](islamic/asmaulhusna.json) — 99 Asmaul Husna with Arabic, Latin, and Indonesian translations.
- [doaharian.json](islamic/doaharian.json) — Collection of daily Islamic prayers.
- [ayatkursi.json](islamic/ayatkursi.json) — Ayat Kursi Arabic text, Latin transliteration, and meaning.
- [bacaansholat.json](islamic/bacaansholat.json) — Complete Salah recitations and guides.
- [niatsholat.json](islamic/niatsholat.json) — Niyyah (intentions) for compulsory and sunnah prayers.
- [wirid.json](islamic/wirid.json) — Post-prayer dhikr and wirid recitations.
- [tahlil.json](islamic/tahlil.json) — Complete Tahlil sequence and readings.

### 🌸 JKT48 (`jkt48/`)
- **[all_members.json](jkt48/all_members.json)** — Complete dataset of **249 JKT48 members (Generation 1 to Generation 14)**, including both active members and graduated alumni. Each record contains:
  - `id`: Sequential ID
  - `slug`: URL/ID slug
  - `name`: Full member name
  - `generation`: Debut generation (1–14)
  - `graduated`: Boolean graduation status
  - `trainee`: Trainee status
  - `picture`: Relative photo filename
  - `image_url`: Direct raw CDN URL to member photo
- **[member.json](jkt48/member.json)** — Detailed dataset of active members with social links, jikoshoukai, and team groupings (used by bots and OshiMatch).
- **`static/members/`** — Optimized WebP/JPG photo assets for all 249 members.

### 📸 Media & Asupan (`asupan/`)
- [cecan.json](asupan/cecan.json) — Curated aesthetic photo dataset.

---

## ⚡ Automated JKT48 Member Sync

This repository includes an automated sync script (`scripts/sync_jkt48_members.js`):
- **Schedule**: Runs automatically every week (checks official API).
- **Execution**: Can be executed on-demand via `node scripts/sync_jkt48_members.js`.
- **Sync Logic**: Checks official API endpoints for newly debuted members or new generations (e.g. Gen 15+), automatically downloads their photos into `jkt48/static/members/`, appends new records to `all_members.json`, and commits back to `master`.

---

## 🌐 Usage in Web & Vercel Applications

To consume the latest dataset in frontend apps (e.g., Vercel, Node.js, static sites):

```javascript
// Fetch complete 249 members dataset (Gen 1-14+)
const response = await fetch('https://raw.githubusercontent.com/nzl404/databases/master/jkt48/all_members.json');
const data = await response.json();
console.log(`Total Members: ${data.total}`);
```
