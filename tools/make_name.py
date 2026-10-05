#!/usr/bin/env python3
"""Suuraseikkailu: say a child's name with the app's Finnish voice, for the parent to import on the device.

The name is played after praise ("Hienoa! <Nimi>!"). A child's name is personal data: the file is written
OUTSIDE the project folder (never into public/ or the repository) and nothing is logged to tools/voices.json.

  python3 tools/make_name.py "Aisha"                         # -> ../suuraseikkailu-nimet/aisha.mp3
  python3 tools/make_name.py "Aisha" --out ~/Desktop/aisha.mp3
  python3 tools/make_name.py "Aisha" --say "Aaisha"          # spelling for the voice only
  ELEVENLABS_API_KEY=... python3 tools/make_name.py "Aisha" --provider elevenlabs --yes

Same provider, voice and settings as tools/make_voices.py (default: the provider of its last run), the same
trim / loudness (-18.4 LUFS) / MP3 format and validation. ElevenLabs spends credits only with --yes.
"""
import argparse
import asyncio
import re
import shutil
import sys
import tempfile
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_voices as mv  # noqa: E402

DEFAULT_DIR = mv.ROOT.parent / 'suuraseikkailu-nimet'
NAME_MAX = 40


def slug(name):
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-') or 'nimi'


def check_out(path):
    path = Path(path).expanduser().resolve()
    if path.is_relative_to(mv.ROOT.resolve()):
        sys.exit(f'Refusing to write a name inside the project ({mv.ROOT}): names must never be committed.')
    if path.suffix.lower() != '.mp3':
        sys.exit('--out must end with .mp3')
    return path


def name_clip(name, say=None, template='{name}!'):
    name = ' '.join(name.split())
    if not name or len(name) > NAME_MAX:
        sys.exit(f'Give a name of 1-{NAME_MAX} characters.')
    text = template.format(name=name)
    # SAY_ID-style override for the spoken text only; the id never matches a prompt id
    clip = {'id': 'name', 'lang': 'fi', 'text': text, 'file': None}
    return clip, (template.format(name=say) if say else None)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('name')
    ap.add_argument('--out', help=f'output .mp3 (default {DEFAULT_DIR}/<name>.mp3, must be outside the project)')
    ap.add_argument('--say', help='how the voice should spell the name (displayed name unchanged)')
    ap.add_argument('--template', default='{name}!', help="text around the name (default '{name}!')")
    mv.add_voice_args(ap)
    args = ap.parse_args(argv)

    clip, say = name_clip(args.name, args.say, args.template)
    out = check_out(args.out or DEFAULT_DIR / f'{slug(args.name)}.mp3')
    provider = args.provider or mv.last_provider()
    eleven = mv.eleven_from_args(args)
    target = mv.recitation_target()[0]
    if say:
        clip['text'] = say                    # only the TTS input; the file name keeps the real name
    mv.log(f'Provider: {provider}')
    if not mv.gate(mv.estimate([clip], provider, eleven), args, eleven):
        return 0
    with tempfile.TemporaryDirectory() as tmp:
        asyncio.run(mv.make_all([clip], target, 1, provider, eleven, tmp, {'name': 'name.mp3'}))
        stats = mv.measure(Path(tmp) / 'name.mp3')
        problems = mv.validate(stats, target)
        if problems:
            sys.exit('FAILED: ' + ', '.join(problems))
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(Path(tmp) / 'name.mp3', out)
    mv.log(f'OK: {out}  ({stats["duration_s"]} s, {stats["lufs"]} LUFS). Import it on the device as this '
           "child's name recording; do not add it to the project.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
