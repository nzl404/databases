/**
 * Automated JKT48 Member Scraper & Sync Engine
 * Synchronizes active members, teams, metadata (including jikoshoukai),
 * automatically removes graduated members, and adds new generation members.
 */

const fs = require('fs');
const path = require('path');

const MEMBER_JSON_PATH = path.join(__dirname, '..', 'jkt48', 'member.json');
const ALL_MEMBERS_PATH = path.join(__dirname, '..', 'jkt48', 'all_members.json');
const STATIC_DIR = path.join(__dirname, '..', 'jkt48', 'static', 'members');

function normalizeName(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getZodiac(month, day) {
  if (!month || !day) return '';
  const dates = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  const signs = [
    'Capricorn', 'Aquarius', 'Pisces', 'Aries', 'Taurus', 'Gemini',
    'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius'
  ];
  return day < dates[month - 1] ? signs[month - 1] : signs[month % 12];
}

async function fetchAllActiveMembers() {
  let page = 1;
  const members = [];
  while (true) {
    try {
      const res = await fetch(`https://mypage48.com/api/members?page=${page}&limit=30`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
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
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return false;
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
    return true;
  } catch (e) {
    console.warn(`[Sync] Failed to download image from ${url}:`, e.message);
    return false;
  }
}

async function syncMembers() {
  console.log('[Sync] Starting JKT48 Member Database synchronization...');

  if (!fs.existsSync(MEMBER_JSON_PATH)) {
    console.error(`[Sync] member.json not found at ${MEMBER_JSON_PATH}`);
    process.exit(1);
  }

  const memberData = JSON.parse(fs.readFileSync(MEMBER_JSON_PATH, 'utf8'));
  const currentMembers = memberData.members || [];
  console.log(`[Sync] Current recorded active members in member.json: ${currentMembers.length}`);

  let allMembersData = null;
  if (fs.existsSync(ALL_MEMBERS_PATH)) {
    allMembersData = JSON.parse(fs.readFileSync(ALL_MEMBERS_PATH, 'utf8'));
  }

  console.log('[Sync] Fetching live active members from official upstream...');
  const activeApiMembers = await fetchAllActiveMembers();
  console.log(`[Sync] Fetched ${activeApiMembers.length} active members from upstream API.`);

  if (!activeApiMembers.length) {
    console.warn('[Sync] Upstream API returned empty list or is unreachable. Aborting sync.');
    return { changed: false };
  }

  let hasChanged = false;
  const activeApiNormNames = new Set(activeApiMembers.map(m => normalizeName(m.name)));

  // 1. DETECT GRADUATED / RESIGNED MEMBERS
  const remainingMembers = [];
  const removedMembers = [];

  for (const m of currentMembers) {
    // Keep JKT48_VIRTUAL without checking theater API
    if (m.team === 'JKT48_VIRTUAL') {
      remainingMembers.push(m);
      continue;
    }

    const norm = normalizeName(m.name);
    // Check if still in official active list
    const isStillActive = activeApiNormNames.has(norm) ||
      Array.from(activeApiNormNames).some(apiNorm => apiNorm.includes(norm) || norm.includes(apiNorm));

    if (!isStillActive) {
      console.log(`[Sync] [GRADUATED] Member "${m.name}" (${m.team}) is no longer in active roster. Removing.`);
      removedMembers.push(m.name);
      hasChanged = true;

      // Also update all_members.json if available
      if (allMembersData && allMembersData.members) {
        const found = allMembersData.members.find(am => normalizeName(am.name) === norm);
        if (found) {
          found.graduated = true;
          found.team = 'EX-MEMBER';
        }
      }
    } else {
      remainingMembers.push(m);
    }
  }

  // 2. DETECT NEW MEMBERS (e.g. Gen 15, New Trainees)
  const currentMemberNormNames = new Set(remainingMembers.map(m => normalizeName(m.name)));
  const newMembers = activeApiMembers.filter(apiM => {
    const norm = normalizeName(apiM.name);
    return !currentMemberNormNames.has(norm) &&
      !Array.from(currentMemberNormNames).some(curNorm => curNorm.includes(norm) || norm.includes(curNorm));
  });

  if (newMembers.length > 0) {
    console.log(`[Sync] [NEW] Found ${newMembers.length} new member(s) to add!`);
    hasChanged = true;
    fs.mkdirSync(STATIC_DIR, { recursive: true });

    let maxId = remainingMembers.reduce((max, m) => Math.max(max, m.id || 0), 0);

    for (const newM of newMembers) {
      maxId++;
      const name = String(newM.name || '').trim();
      const nickname = String(newM.nick_name || newM.nickname || name.split(' ')[0] || '').trim();
      const team = String(newM.member_type || newM.team || 'TRAINEE').toUpperCase().trim();
      const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const slug = `${baseSlug}-${maxId}`;

      let birthDay = 0, birthMonth = 0, birthYear = 0, birthdayKey = '';
      if (newM.birthdate) {
        const parts = newM.birthdate.split('-');
        if (parts.length === 3) {
          birthYear = parseInt(parts[0], 10) || 0;
          birthMonth = parseInt(parts[1], 10) || 0;
          birthDay = parseInt(parts[2], 10) || 0;
          birthdayKey = `${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
        }
      }

      const zodiac = getZodiac(birthMonth, birthDay);
      const photoUrl = newM.picture || '';

      // Socials
      let twitter = '', instagram = '', tiktok = '';
      if (newM.socials) {
        twitter = (newM.socials.twitter || '').replace(/^@/, '');
        instagram = (newM.socials.instagram || '').replace(/^@/, '');
        tiktok = (newM.socials.tiktok || '').replace(/^@/, '');
      }

      const newMemberObj = {
        id: maxId,
        code,
        slug,
        name,
        nickname,
        team,
        birth_place: newM.birthplace || '',
        birth_date: newM.birthdate || '',
        birth_day: birthDay,
        birth_month: birthMonth,
        birth_year: birthYear,
        birthday_key: birthdayKey,
        height_cm: parseInt(newM.height, 10) || 0,
        blood_type: newM.blood_type || '',
        zodiac,
        photo: photoUrl,
        photo_1: photoUrl,
        photo_2: photoUrl,
        photo_3: '',
        twitter,
        instagram,
        tiktok,
        youtube: '',
        detail_url: `https://jkt48.com/member/detail?member=${slug}&type=${team}`,
        jikoshoukai: '',
        jikoshoukai_source: ''
      };

      remainingMembers.push(newMemberObj);
      console.log(`[Sync] Successfully added new member: ${name} (${team})`);

      // Add to all_members.json and download photo
      if (allMembersData && allMembersData.members) {
        const photoFilename = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.webp`;
        const destPhotoPath = path.join(STATIC_DIR, photoFilename);
        if (photoUrl) {
          await downloadImage(photoUrl, destPhotoPath);
        }

        allMembersData.members.push({
          id: allMembersData.members.length + 1,
          slug: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name,
          generation: parseInt(newM.generation, 10) || 15,
          graduated: false,
          trainee: team === 'TRAINEE',
          team,
          picture: photoFilename
        });
      }
    }
  }

  // 3. RECOMPUTE TEAM COUNTS AND TOTAL
  const teamCounts = { DREAM: 0, LOVE: 0, PASSION: 0, TRAINEE: 0, JKT48_VIRTUAL: 0 };
  remainingMembers.forEach(m => {
    if (teamCounts[m.team] !== undefined) {
      teamCounts[m.team]++;
    } else {
      teamCounts[m.team] = 1;
    }
  });

  // Sort members cleanly by team order, then by name
  const teamOrder = { DREAM: 1, LOVE: 2, PASSION: 3, TRAINEE: 4, JKT48_VIRTUAL: 5 };
  remainingMembers.sort((a, b) => {
    const oA = teamOrder[a.team] || 99;
    const oB = teamOrder[b.team] || 99;
    if (oA !== oB) return oA - oB;
    return a.name.localeCompare(b.name);
  });

  const finalMemberData = {
    updated_at: new Date().toISOString(),
    total: remainingMembers.length,
    team_counts: teamCounts,
    members: remainingMembers
  };

  // Write changes if any or if formatting needed
  fs.writeFileSync(MEMBER_JSON_PATH, JSON.stringify(finalMemberData, null, 2) + '\n');
  if (allMembersData) {
    fs.writeFileSync(ALL_MEMBERS_PATH, JSON.stringify(allMembersData, null, 2) + '\n');
  }

  console.log(`[Sync] Finished. Total active: ${finalMemberData.total}, Counts:`, finalMemberData.team_counts);
  return {
    changed: hasChanged,
    total: finalMemberData.total,
    team_counts: finalMemberData.team_counts,
    removed: removedMembers,
    added: newMembers.map(m => m.name)
  };
}

if (require.main === module) {
  syncMembers().catch(err => {
    console.error('[Sync] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { syncMembers };
