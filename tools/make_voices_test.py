#!/usr/bin/env python3
"""Unit tests for the ElevenLabs path of tools/make_voices.py and tools/make_name.py, with a fake HTTP layer
(no API key, no network, no credits). Run: python3 -m unittest tools/make_voices_test.py -v"""
import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_name  # noqa: E402
import make_voices as mv  # noqa: E402

KEY = 'sk_test_DO_NOT_LEAK_1234567890'


class FakeHTTP:
    """Records every request; answers from a queue of (status, body) (default: a real tone MP3)."""

    def __init__(self, mp3, answers=None):
        self.mp3, self.answers, self.calls = mp3, list(answers or []), []

    def __call__(self, method, url, headers, data=None, timeout=60):
        self.calls.append({'method': method, 'url': url, 'headers': dict(headers),
                           'body': json.loads(data) if data else None})
        if url.endswith('/user/subscription'):
            return 200, json.dumps({'character_limit': 100000, 'character_count': 1000}).encode()
        if self.answers:
            return self.answers.pop(0)
        return 200, self.mp3


class ElevenTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        mp3 = cls.tmp / 'tone.mp3'          # stands in for ElevenLabs' mp3_44100_128 answer
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1.2',
                        '-af', 'volume=-12dB', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', str(mp3)], check=True)
        cls.mp3 = mp3.read_bytes()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def setUp(self):
        self.out = io.StringIO()
        self.env = mock.patch.dict(os.environ, {mv.ELEVEN_KEY_ENV: KEY})
        self.env.start()
        self.sleep = mock.patch.object(mv, 'SLEEP', lambda s: None)
        self.sleep.start()

    def tearDown(self):
        self.env.stop()
        self.sleep.stop()
        self.assertNotIn(KEY, self.out.getvalue(), 'the API key must never be printed')

    def run_quiet(self, fn, *a):
        with contextlib.redirect_stdout(self.out), contextlib.redirect_stderr(self.out):
            return fn(*a)

    # ---- request building
    def test_request(self):
        url, headers, body = mv.eleven_request('Hienoa!', dict(mv.ELEVEN), KEY)
        self.assertEqual(url, 'https://api.elevenlabs.io/v1/text-to-speech/YSabzCJMvEHDduIDMdwV?output_format=mp3_44100_128')
        self.assertEqual(headers['xi-api-key'], KEY)
        self.assertEqual(headers['Accept'], 'audio/mpeg')
        b = json.loads(body)
        self.assertEqual(b['text'], 'Hienoa!')
        self.assertEqual(b['model_id'], 'eleven_multilingual_v2')
        self.assertEqual(b['seed'], 7)
        self.assertEqual(set(b['voice_settings']), {'stability', 'similarity_boost', 'style', 'use_speaker_boost', 'speed'})
        self.assertNotIn('language_code', b)
        _, _, body2 = mv.eleven_request('x', {**mv.ELEVEN, 'model_id': 'eleven_flash_v2_5', 'language_code': 'fi'}, KEY)
        self.assertEqual(json.loads(body2)['language_code'], 'fi')

    def test_cli_settings(self):
        ap = __import__('argparse').ArgumentParser()
        mv.add_voice_args(ap)
        e = mv.eleven_from_args(ap.parse_args(['--stability', '0.5', '--style', '0.6', '--model', 'eleven_v3']))
        self.assertEqual((e['stability'], e['style'], e['model_id'], e['voice_id']),
                         (0.5, 0.6, 'eleven_v3', 'YSabzCJMvEHDduIDMdwV'))

    def test_say_text(self):
        c = {'id': 'intro-title', 'lang': 'fi', 'text': 'Suuraseikkailu!'}
        self.assertEqual(mv.say_text(c), 'Suuuuraseikkailuu!')
        c = {'id': 'x', 'lang': 'fi', 'text': 'Upeaa! Osaat koko Al-Fatihan!'}
        self.assertEqual(mv.say_text(c, 'edge'), 'Upeeaa! Osaat koko Alfaatihan!')
        self.assertEqual(mv.say_text(c, 'elevenlabs'), 'Upeaa! Osaat koko Alfaatihan!')

    # ---- retries / errors
    def test_retry_then_ok(self):
        fake = FakeHTTP(self.mp3, [(429, b'{"detail":"busy"}'), (503, b'oops')])
        with mock.patch.object(mv, 'HTTP', fake):
            self.run_quiet(mv.eleven_synth, 'Hei!', dict(mv.ELEVEN), self.tmp / 'a.mp3', KEY)
        self.assertEqual(len(fake.calls), 3)
        self.assertEqual((self.tmp / 'a.mp3').read_bytes(), self.mp3)

    def test_auth_error_redacted(self):
        fake = FakeHTTP(self.mp3, [(401, ('{"detail":"invalid api key ' + KEY + '"}').encode())])
        with mock.patch.object(mv, 'HTTP', fake), self.assertRaises(mv.ElevenError) as cm:
            self.run_quiet(mv.eleven_synth, 'Hei!', dict(mv.ELEVEN), self.tmp / 'b.mp3', KEY)
        self.assertNotIn(KEY, str(cm.exception))
        self.assertEqual(len(fake.calls), 1, 'no retry on 401')

    def test_not_mp3(self):
        with mock.patch.object(mv, 'HTTP', FakeHTTP(b'<html>' * 400)), self.assertRaises(mv.ElevenError):
            self.run_quiet(mv.eleven_synth, 'Hei!', dict(mv.ELEVEN), self.tmp / 'c.mp3', KEY)

    # ---- keys: Edge keys unchanged, ElevenLabs keys follow every setting
    def test_keys(self):
        v = json.loads(mv.VOICES_JSON.read_text(encoding='utf-8'))
        clips = {c['id']: c for c in mv.list_clips()}
        for e in v['clips']:
            if e['id'] in clips and e.get('provider', 'edge') == 'edge':
                cfg = e.get('settings') or {'provider': 'edge', 'voice': e['voice'], 'rate': e['rate'], 'pitch': e['pitch']}
                self.assertEqual(mv.clip_key(clips[e['id']], v['target_lufs'], cfg), e['key'], e['id'])
        c = clips['praise-1']
        k1 = mv.clip_key(c, -18.4, mv.voice_cfg(c, 'elevenlabs'))
        self.assertEqual(k1, mv.clip_key(c, -18.4, mv.voice_cfg(c, 'elevenlabs')))
        self.assertNotEqual(k1, mv.clip_key(c, -18.4, mv.voice_cfg(c, 'elevenlabs', {**mv.ELEVEN, 'style': 0.5})))
        self.assertNotEqual(k1, mv.clip_key(c, -18.4, mv.voice_cfg(c, 'edge')))

    # ---- full runs in a sandbox (temp public/, voices.json, data.js)
    def sandbox(self):
        box = Path(tempfile.mkdtemp(dir=self.tmp))
        (box / 'public' / 'audio' / 'fi').mkdir(parents=True)
        data = box / 'data.js'
        data.write_text(mv.DATA_JS.read_text(encoding='utf-8'), encoding='utf-8')
        clips = [{'id': 'praise-1', 'lang': 'fi', 'text': 'Hienoa!', 'file': 'audio/fi/praise-1.mp3'},
                 {'id': 'intro-title', 'lang': 'fi', 'text': 'Suuraseikkailu!', 'file': 'audio/fi/intro-title.mp3'}]
        patches = [mock.patch.object(mv, 'PUBLIC', box / 'public'), mock.patch.object(mv, 'VOICES_JSON', box / 'voices.json'),
                   mock.patch.object(mv, 'DATA_JS', data), mock.patch.object(mv, 'SAMPLES_DIR', box / 'samples'),
                   mock.patch.object(mv, 'list_clips', lambda: clips)]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        return box, data

    def main(self, *argv):
        with mock.patch.object(sys, 'argv', ['make_voices.py', *argv]):
            self.run_quiet(mv.main)

    def test_estimate_without_yes_sends_nothing(self):
        box, data = self.sandbox()
        fake = FakeHTTP(self.mp3)
        with mock.patch.object(mv, 'HTTP', fake):
            self.main('--provider', 'elevenlabs')
        self.assertEqual(fake.calls, [])
        out = self.out.getvalue()
        self.assertIn('2 clip(s), 25 characters = about 25 credits', out)   # 'Hienoa!' + 'Suuuuraseikkailuu!'
        self.assertIn('Add --yes', out)
        self.assertFalse((box / 'voices.json').exists())
        self.assertEqual(list((box / 'public' / 'audio' / 'fi').iterdir()), [])

    def test_run_with_yes_then_skip_and_credit(self):
        box, data = self.sandbox()
        fake = FakeHTTP(self.mp3)
        with mock.patch.object(mv, 'HTTP', fake):
            self.main('--provider', 'elevenlabs', '--yes')
        tts = [c for c in fake.calls if '/text-to-speech/' in c['url']]
        self.assertEqual(sorted(c['body']['text'] for c in tts), ['Hienoa!', 'Suuuuraseikkailuu!'])
        v = json.loads((box / 'voices.json').read_text(encoding='utf-8'))
        self.assertEqual(v['provider'], 'elevenlabs')
        self.assertTrue(all(e['provider'] == 'elevenlabs' and abs(e['lufs'] + 18.4) <= 0.5 for e in v['clips']))
        self.assertNotIn(KEY, (box / 'voices.json').read_text(encoding='utf-8'))
        self.assertIn('"' + mv.ELEVEN_CREDIT + '"', data.read_text(encoding='utf-8'))
        self.assertNotIn('Microsoft Edge -puheääni Noora', data.read_text(encoding='utf-8'))
        # second run: nothing changed -> no request; default provider = the last one
        fake2 = FakeHTTP(self.mp3)
        with mock.patch.object(mv, 'HTTP', fake2):
            self.main()
        self.assertEqual(fake2.calls, [])
        self.assertIn('0 clip(s) to synthesize', self.out.getvalue())
        # a changed setting -> exactly those clips again
        fake3 = FakeHTTP(self.mp3)
        with mock.patch.object(mv, 'HTTP', fake3):
            self.main('--style', '0.6', '--yes', '--only', 'praise-1')
        self.assertEqual([c['body']['voice_settings']['style'] for c in fake3.calls if '/text-to-speech/' in c['url']], [0.6])

    def test_samples(self):
        box, data = self.sandbox()
        with mock.patch.object(mv, 'SAMPLE_IDS', ['intro-title']), mock.patch.object(mv, 'HTTP', FakeHTTP(self.mp3)):
            self.main('--provider', 'elevenlabs', '--samples', '--yes')
        files = sorted(p.name for p in (box / 'samples').iterdir())
        self.assertEqual(len(files), 2)                       # one sample + samples.json
        self.assertTrue(files[0].startswith('elevenlabs-intro-title-'))
        self.assertEqual(list((box / 'public' / 'audio' / 'fi').iterdir()), [])
        self.assertFalse((box / 'voices.json').exists())

    def test_apply_credit(self):
        box, data = self.sandbox()
        self.assertTrue(self.run_quiet(mv.apply_credit, data))
        s = data.read_text(encoding='utf-8')
        self.assertEqual(s.count(mv.ELEVEN_CREDIT), 1)
        self.assertIn('Koraanin teksti: Tanzil', s)

    # ---- make_name
    def test_make_name(self):
        box, data = self.sandbox()
        out = self.tmp / 'names' / 'aisha.mp3'
        fake = FakeHTTP(self.mp3)
        with mock.patch.object(mv, 'HTTP', fake):
            self.run_quiet(make_name.main, ['Aisha', '--say', 'Aaisha', '--out', str(out), '--provider', 'elevenlabs', '--yes'])
        self.assertEqual([c['body']['text'] for c in fake.calls if '/text-to-speech/' in c['url']], ['Aaisha!'])
        self.assertTrue(out.exists())
        self.assertFalse((box / 'voices.json').exists())
        with self.assertRaises(SystemExit):
            self.run_quiet(make_name.main, ['Aisha', '--out', str(mv.ROOT / 'public' / 'aisha.mp3')])
        self.assertEqual(make_name.slug('Äijä Öö'), 'aija-oo')


if __name__ == '__main__':
    unittest.main()
