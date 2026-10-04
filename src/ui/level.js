/* Level choice: three big buttons HELPPO / KESKITASO / VAIKEA, the remembered one preselected. OWNER: ui agent. */
import ART from '../art.js';
import { LEVELS } from '../content/prompts.js';
import { $ } from './dom.js';

let iconsDone = false;

export function renderLevel(sec, selected) {
  if (!iconsDone) {
    LEVELS.forEach((l) => { $('lvl-' + l).querySelector('.level-ico').innerHTML = ART.levelIcon(l, 'level-art'); });
    iconsDone = true;
  }
  $('levelSecName').textContent = sec.name;
  $('levelSecAr').textContent = sec.ar;
  LEVELS.forEach((l) => {
    const b = $('lvl-' + l);
    b.classList.toggle('selected', l === selected);
    b.setAttribute('aria-pressed', String(l === selected));
  });
  return $('lvl-' + selected);
}
