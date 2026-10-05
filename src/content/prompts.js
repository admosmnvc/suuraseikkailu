/* Suuraseikkailu spoken clips (FROZEN contract: ids and texts are shared by the app,
   the voice generator tools/make_voices.py and the recording UI).

   Every clip id maps to a file by convention:
     Finnish clip  <id>  -> audio/fi/<id>.mp3
     Shahada line  i     -> audio/shahada-<i>.mp3   (see data.js lines[].audio / lines[].rec)
   Playback order for a clip: parent recording (IndexedDB, same id) -> MP3 file -> device speech (text below).
   The text is also always shown on screen. */
import DATA from './data.js';

/* Static Finnish prompts. Keep texts short, warm, spoken by a cheerful teacher. */
export const PROMPTS = {
  'welcome': 'Hei! Mitä opitaan tänään?',
  'listen': 'Kuuntele tarkkaan.',
  'turn-1': 'Nyt sinun vuorosi! Sano perässä.',
  'turn-all': 'Nyt sinun vuorosi! Sano kaikki alusta asti.',
  'praise-1': 'Hienoa!',
  'praise-2': 'Mahtavaa!',
  'praise-3': 'Upeaa!',
  'praise-4': 'Loistavaa!',
  'praise-5': 'Hyvin sanottu!',
  'gem': 'Sait jalokiven kruunuun!',
  'next': 'Jatketaan!',
  'finale-shahada': 'Mahtavaa! Osaat koko Shahadan!',
  'finale-fatiha': 'Mahtavaa! Osaat koko Al-Fatihan!',
  'finale-ikhlas': 'Mahtavaa! Osaat koko Al-Ikhlasin!',
  'finale-kawthar': 'Mahtavaa! Osaat koko Al-Kawtharin!',
  'sticker': 'Sait uuden tarran!',
  /* v3: start, profiles, levels */
  'cover': 'Tervetuloa Suuraseikkailuun!',
  'who': 'Kuka pelaa tänään?',
  'ask-name': 'Kirjoita lapsen nimi.',
  'ask-theme': 'Valitse: tyttö vai poika?',
  'pick-level': 'Valitse taso!',
  'level-easy': 'Helppo! Sana kerrallaan.',
  'level-medium': 'Keskitaso! Kaksi sanaa kerrallaan.',
  'level-hard': 'Vaikea! Koko rivi kerrallaan.',
  /* v3: boy reward (girl reward = 'gem') */
  'rocket-part': 'Raketti sai uuden osan!',
  'rocket-launch': 'Kolme, kaksi, yksi... Raketti lähtee!',
  /* v3 minigames: 6 per theme, index order fixed */
  'game-boy-0': 'Vaihda auton renkaat!',
  'game-boy-1': 'Pese auto puhtaaksi!',
  'game-boy-2': 'Tankkaa auto täyteen!',
  'game-boy-3': 'Vihreä valo, kaasua!',
  'game-boy-4': 'Aja kilpaa ja kerää tähdet!',
  'game-boy-5': 'Pysäköi auto ruutuun!',
  'game-girl-0': 'Harjaa hevosen harja!',
  'game-girl-1': 'Ruoki eläimet!',
  'game-girl-2': 'Kylvetä koiranpentu!',
  'game-girl-3': 'Koristele kakku!',
  'game-girl-4': 'Kasvata kukkaniitty!',
  'game-girl-5': 'Sytytä moskeijan valot!',
  'test-fi': 'Hei! Tämä on suomen puheääni.'
};

export const PRAISE_IDS = ['praise-1', 'praise-2', 'praise-3', 'praise-4', 'praise-5'];
export const THEMES = ['girl', 'boy'];
export const LEVELS = ['easy', 'medium', 'hard'];
export const LEVEL_NAMES = { easy: 'HELPPO', medium: 'KESKITASO', hard: 'VAIKEA' };
export const GAME_COUNT = 6; /* per theme */
export function gameId(theme, index) { return 'game-' + theme + '-' + index; }
export function levelId(level) { return 'level-' + level; }
export function finaleId(sectionId) { return 'finale-' + sectionId; }
/* "Mitä tämä tarkoittaa?" -> the line's Finnish translation (lines[].fi). */
export function meaningId(sectionId, lineIndex) { return 'mean-' + sectionId + '-' + lineIndex; }

/* Text of any Finnish clip id (static prompt or meaning clip). */
export function promptText(id) {
  if (Object.prototype.hasOwnProperty.call(PROMPTS, id)) return PROMPTS[id];
  const m = /^mean-([a-z]+)-(\d+)$/.exec(id || '');
  if (m) {
    const sec = DATA.sections.find((s) => s.id === m[1]);
    const line = sec && sec.lines[Number(m[2])];
    return line ? line.fi : '';
  }
  return '';
}

/* Clips a parent can replace with an own recording (settings "Omat äänitykset"): every spoken clip.
   The child's name is recorded per child in settings ("Lapset"): clip id 'name-<childId>' (no file; device speech of
   the name is the fallback), played after praise. */
export const RECORDABLE = [
  { group: 'Shahada', id: 'shahada-1', label: 'Shahada, rivi 1' },
  { group: 'Shahada', id: 'shahada-2', label: 'Shahada, rivi 2' },
  { group: 'Kehotteet', id: 'turn-1', label: PROMPTS['turn-1'] },
  { group: 'Kehotteet', id: 'turn-all', label: PROMPTS['turn-all'] },
  { group: 'Kehut', id: 'praise-1', label: PROMPTS['praise-1'] },
  { group: 'Kehut', id: 'praise-2', label: PROMPTS['praise-2'] },
  { group: 'Kehut', id: 'praise-3', label: PROMPTS['praise-3'] },
  { group: 'Kehut', id: 'praise-4', label: PROMPTS['praise-4'] },
  { group: 'Kehut', id: 'praise-5', label: PROMPTS['praise-5'] },
  { group: 'Kehut', id: 'gem', label: PROMPTS['gem'] },
  { group: 'Kehut', id: 'rocket-part', label: PROMPTS['rocket-part'] },
  { group: 'Juhla', id: 'finale-shahada', label: PROMPTS['finale-shahada'] },
  { group: 'Juhla', id: 'finale-fatiha', label: PROMPTS['finale-fatiha'] },
  { group: 'Juhla', id: 'finale-ikhlas', label: PROMPTS['finale-ikhlas'] },
  { group: 'Juhla', id: 'finale-kawthar', label: PROMPTS['finale-kawthar'] },
  { group: 'Juhla', id: 'sticker', label: PROMPTS['sticker'] },
  { group: 'Juhla', id: 'rocket-launch', label: PROMPTS['rocket-launch'] },
  { group: 'Muut kehotteet', id: 'welcome', label: PROMPTS['welcome'] },
  { group: 'Muut kehotteet', id: 'next', label: PROMPTS['next'] },
  ...['cover', 'who', 'pick-level', 'level-easy', 'level-medium', 'level-hard'].map((id) => ({ group: 'Muut kehotteet', id, label: PROMPTS[id] })),
  ...THEMES.flatMap((t) => Array.from({ length: GAME_COUNT }, (_, i) => (
    { group: t === 'boy' ? 'Pelit (poika)' : 'Pelit (tyttö)', id: gameId(t, i), label: PROMPTS[gameId(t, i)] }))),
  ...DATA.sections.flatMap((sec) => sec.lines.map((line, i) => (
    { group: 'Merkitykset', id: meaningId(sec.id, i), label: sec.name + ', rivi ' + (i + 1) + ': ' + line.fi })))
];

/* Every pre-generated voice file (used by tools/make_voices.py via tools/list-clips.mjs).
   v3: Shahada chunk clips (HELPPO/KESKITASO) come from src/content/words.js (lang 'ar', teacher voice). */
export function allVoiceClips(extra) {
  const list = Object.keys(PROMPTS).filter((id) => id !== 'ask-name').map((id) => ({ id, lang: 'fi', text: PROMPTS[id], file: 'audio/fi/' + id + '.mp3' }));
  (extra || []).forEach((c) => list.push(c));
  DATA.sections.forEach((sec) => {
    sec.lines.forEach((line, i) => {
      list.push({ id: meaningId(sec.id, i), lang: 'fi', text: line.fi, file: 'audio/fi/' + meaningId(sec.id, i) + '.mp3' });
      if (line.rec) list.push({ id: line.rec, lang: 'ar', text: line.tts || line.ar, file: line.audio });
    });
  });
  return list;
}
