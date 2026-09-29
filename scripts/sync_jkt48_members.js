/**
 * Automated Sync Script for JKT48 Members
 * Checks for new generations / active members from official API and appends to all_members.json
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'jkt48', 'all_members.json');
const STATIC_DIR = path.join(__dirname, '..', 'jkt48', 'static', 'members');

function isSameMember(name1, name2) {
  const n1 = String(name1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const n2 = String(name2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

async function fetchAllActiveMembers() {
  let page = 1;
  const members = [];
  while (true) {
    try {
      const res = await fetch(`https://mypage48.com/api/members?page=${page}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) break;
      const json = await res.json();
      const list = json.data || [];
      members.push(...list);
      if (!json.meta || page >= json.meta.last_page) break;
      page++;
    } catch (err) {
      console.warn(`[Sync] Warning on page ${page}:`, err.message);
      break;
    }
  }
  return members;
}

async function downloadImage(url, destPath) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

async function main() {
  console.log('[Sync] Reading current all_members.json...');
  if (!fs.existsSync(DB_PATH)) {
    console.error('[Sync] all_members.json not found!');
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const existingMembers = db.members || [];
  console.log(`[Sync] Current recorded members: ${existingMembers.length}`);

  console.log('[Sync] Fetching active members from official API...');
  const activeMembers = await fetchAllActiveMembers();
  console.log(`[Sync] Fetched ${activeMembers.length} active members from API.`);

  if (!activeMembers.length) {
    console.log('[Sync] No members fetched from API or API offline. Skipping.');
    return;
  }

  const newMembers = activeMembers.filter(apiMember => {
    return !existingMembers.some(existing => isSameMember(existing.name, apiMember.name));
  });

  if (!newMembers.length) {
    console.log('[Sync] All active members are already recorded in all_members.json. Database is up-to-date!');
    return;
  }

  console.log(`[Sync] Found ${newMembers.length} NEW member(s) to add!`);
  fs.mkdirSync(STATIC_DIR, { recursive: true });

  let nextId = existingMembers.length ? Math.max(...existingMembers.map(m => m.id || 0)) + 1 : 1;

  for (const m of newMembers) {
    const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    let pictureFilename = `${slug}.jpg`;

    const imgUrl = m.img || m.img_medium || m.img_small;
    if (imgUrl) {
      try {
        console.log(`[Sync] Downloading picture for ${m.name}...`);
        const dest = path.join(STATIC_DIR, pictureFilename);
        await downloadImage(imgUrl, dest);
      } catch (e) {
        console.warn(`[Sync] Failed to download picture for ${m.name}:`, e.message);
        pictureFilename = 'default.jpg';
      }
    }

    const newRecord = {
      id: nextId++,
      slug,
      name: m.name,
      generation: parseInt(m.generation, 10) || 15,
      graduated: false,
      trainee: m.member_type === 'TRAINEE' || Boolean(m.trainee),
      team: m.team || (m.member_type === 'TRAINEE' || Boolean(m.trainee) ? 'TRAINEE' : 'DREAM'),
      picture: pictureFilename,
      image_url: `https://raw.githubusercontent.com/nzl404/databases/master/jkt48/static/members/${pictureFilename}`
    };

    console.log(`[Sync] Added: Gen ${newRecord.generation} - ${newRecord.name} (Trainee: ${newRecord.trainee})`);
    existingMembers.push(newRecord);
  }

  db.total = existingMembers.length;
  db.total_graduated = existingMembers.filter(m => m.graduated).length;
  db.total_active = existingMembers.filter(m => !m.graduated).length;
  db.updated_at = new Date().toISOString();

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + '\n');
  console.log(`[Sync] Successfully updated all_members.json! New total: ${db.total}`);
}

main().catch(err => {
  console.error('[Sync] Fatal error:', err);
  process.exit(1);
});
