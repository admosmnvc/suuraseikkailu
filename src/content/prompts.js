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
  'game-0': 'Puhkaise ilmapallot!',
  'game-1': 'Napauta lumihiutaleita!',
  'game-2': 'Poksauta kuplat!',
  'game-3': 'Sytytä kristallilyhdyt!',
  'game-4': 'Kerää hedelmät koriin!',
  'game-5': 'Napauta taivasta!',
  'game-6': 'Koristele kruunu!',
  'game-7': 'Sytytä palatsin valot!',
  'test-fi': 'Hei! Tämä on suomen puheääni.'
};

export const PRAISE_IDS = ['praise-1', 'praise-2', 'praise-3', 'praise-4', 'praise-5'];
export const GAME_COUNT = 8;
export function gameId(index) { return 'game-' + index; }
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
   'name' has no file: the parent's recording of the child's name, played after praise. */
export const RECORDABLE = [
  { group: 'Shahada', id: 'shahada-1', label: 'Shahada, rivi 1' },
  { group: 'Shahada', id: 'shahada-2', label: 'Shahada, rivi 2' },
  { group: 'Lapsen nimi', id: 'name', label: 'Lapsen nimi (kuuluu kehujen jälkeen)' },
  { group: 'Kehotteet', id: 'turn-1', label: PROMPTS['turn-1'] },
  { group: 'Kehotteet', id: 'turn-all', label: PROMPTS['turn-all'] },
  { group: 'Kehut', id: 'praise-1', label: PROMPTS['praise-1'] },
  { group: 'Kehut', id: 'praise-2', label: PROMPTS['praise-2'] },
  { group: 'Kehut', id: 'praise-3', label: PROMPTS['praise-3'] },
  { group: 'Kehut', id: 'praise-4', label: PROMPTS['praise-4'] },
  { group: 'Kehut', id: 'praise-5', label: PROMPTS['praise-5'] },
  { group: 'Kehut', id: 'gem', label: PROMPTS['gem'] },
  { group: 'Juhla', id: 'finale-shahada', label: PROMPTS['finale-shahada'] },
  { group: 'Juhla', id: 'finale-fatiha', label: PROMPTS['finale-fatiha'] },
  { group: 'Juhla', id: 'finale-ikhlas', label: PROMPTS['finale-ikhlas'] },
  { group: 'Juhla', id: 'finale-kawthar', label: PROMPTS['finale-kawthar'] },
  { group: 'Juhla', id: 'sticker', label: PROMPTS['sticker'] },
  { group: 'Muut kehotteet', id: 'welcome', label: PROMPTS['welcome'] },
  { group: 'Muut kehotteet', id: 'next', label: PROMPTS['next'] },
  ...Array.from({ length: GAME_COUNT }, (_, i) => ({ group: 'Pelit', id: gameId(i), label: PROMPTS[gameId(i)] })),
  ...DATA.sections.flatMap((sec) => sec.lines.map((line, i) => (
    { group: 'Merkitykset', id: meaningId(sec.id, i), label: sec.name + ', rivi ' + (i + 1) + ': ' + line.fi })))
];

/* Every pre-generated voice file (used by tools/make_voices.py via tools/list-clips.mjs). */
export function allVoiceClips() {
  const list = Object.keys(PROMPTS).map((id) => ({ id, lang: 'fi', text: PROMPTS[id], file: 'audio/fi/' + id + '.mp3' }));
  DATA.sections.forEach((sec) => {
    sec.lines.forEach((line, i) => {
      list.push({ id: meaningId(sec.id, i), lang: 'fi', text: line.fi, file: 'audio/fi/' + meaningId(sec.id, i) + '.mp3' });
      if (line.rec) list.push({ id: line.rec, lang: 'ar', text: line.tts || line.ar, file: line.audio });
    });
  });
  return list;
}
