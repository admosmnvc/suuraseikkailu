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
        self.assertEqual(b['model_id'], 'eleven_v3')
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
        t = {'id': 'intro-title', 'lang': 'fi', 'text': 'Suuraseikkailu!'}
        self.assertEqual(mv.say_text(t, 'elevenlabs'), 'Suuuura-seikkailuu!')
        self.assertEqual(mv.say_text({'id': 'bye', 'lang': 'fi', 'text': 'Nähdään taas!'}, 'elevenlabs'), 'Nähdään taas!')

    def test_v3_tags(self):
        v3 = {'provider': 'elevenlabs', **mv.ELEVEN, 'model_id': 'eleven_v3'}
        v2 = dict(v3, model_id='eleven_multilingual_v2')
        clip = lambda i, t='Hienoa!': {'id': i, 'lang': 'fi', 'text': t}
        self.assertEqual(mv.tts_text(clip('praise-3'), v3), '[excited] Hienoa!')
        self.assertEqual(mv.tts_text(clip('fx-vroom', 'Vrruum!'), v3), '[excited] Vrruum!')
        self.assertEqual(mv.tts_text(clip('turn-1'), v3), '[cheerful] Hienoa!')
        self.assertEqual(mv.tts_text(clip('mean-fatiha-0', 'Allahin nimeen.'), v3), 'Allahin nimeen.')
        self.assertEqual(mv.tts_text(clip('praise-3'), v2), 'Hienoa!')            # tags only for v3
        self.assertEqual(mv.tts_text(clip('praise-3'), {'provider': 'edge'}), 'Hienoa!')
        self.assertNotEqual(mv.clip_key(clip('praise-3'), -18.4, v3), mv.clip_key(clip('praise-3'), -18.4, v2))

    def test_qa_score(self):
        self.assertEqual(mv.qa_norm('[excited] Suuuura-seikkailuu!'), 'suuraseikkailuu')
        self.assertGreaterEqual(mv.qa_score('Suuuura-seikkailuu!', 'Suura seikkailu!'), mv.QA_MIN)
        self.assertGreaterEqual(mv.qa_score('Mahtavaa! Osaat koko Alfaatihan!', 'Mahtavaa, osaat koko alfaat ihan.'), mv.QA_MIN)
        self.assertLess(mv.qa_score('Nyt sinun vuorosi! Sano perässä.', 'Nyt sinun vuorosi, sanoo perassa.'), mv.QA_MIN)
        self.assertLess(mv.qa_score('Mahtavaa! Osaat koko Shahadan!', 'Mahtavaa! Osaatko koko Shahadan?'), mv.QA_MIN)

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
                   mock.patch.object(mv, 'list_clips', lambda: clips), mock.patch.object(mv, 'SOURCE_TAKES', {})]
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
        self.assertIn('2 clip(s), 46 characters = about 46 credits', out)   # '[excited] Hienoa!' + '[excited] Suuuura-seikkailuu!'
        self.assertIn('Add --yes', out)
        self.assertFalse((box / 'voices.json').exists())
        self.assertEqual(list((box / 'public' / 'audio' / 'fi').iterdir()), [])

    def test_run_with_yes_then_skip_and_credit(self):
        box, data = self.sandbox()
        fake = FakeHTTP(self.mp3)
        with mock.patch.object(mv, 'HTTP', fake):
            self.main('--provider', 'elevenlabs', '--yes', '--no-qa')
        tts = [c for c in fake.calls if '/text-to-speech/' in c['url']]
        self.assertEqual(sorted(c['body']['text'] for c in tts), ['[excited] Hienoa!', '[excited] Suuuura-seikkailuu!'])
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
            self.main('--style', '0.6', '--yes', '--only', 'praise-1', '--no-qa')
        self.assertEqual([c['body']['voice_settings']['style'] for c in fake3.calls if '/text-to-speech/' in c['url']], [0.6])

    def test_take_check(self):
        """A take the back-transcript does not match -> the next seed; the matching take stays, its seed is recorded."""
        box, data = self.sandbox()
        heard = {'praise-1': iter(['Hienoa!']), 'intro-title': iter(['Suura... jotain muuta', 'Suura seikkailu!'])}
        fake = FakeHTTP(self.mp3)
        qa_heard = lambda path, lang: next(heard[Path(path).name.split('.take')[0]])
        with mock.patch.object(mv, 'HTTP', fake), mock.patch.object(mv, 'qa_heard', qa_heard):
            self.main('--provider', 'elevenlabs', '--yes', '--jobs', '1')
        seeds = sorted(c['body']['seed'] for c in fake.calls if '/text-to-speech/' in c['url'])
        self.assertEqual(seeds, [7, 7, 8])
        v = {e['id']: e for e in json.loads((box / 'voices.json').read_text(encoding='utf-8'))['clips']}
        self.assertEqual((v['intro-title']['qa']['takes'], v['intro-title']['qa']['seed'], v['intro-title']['settings']['seed']), (2, 8, 8))
        self.assertEqual(v['praise-1']['qa']['takes'], 1)
        # the stored key is the base settings' key: a plain second run makes nothing
        fake2 = FakeHTTP(self.mp3)
        with mock.patch.object(mv, 'HTTP', fake2):
            self.main()
        self.assertEqual(fake2.calls, [])

    def test_samples(self):
        box, data = self.sandbox()
        with mock.patch.object(mv, 'SAMPLE_IDS', ['intro-title']), mock.patch.object(mv, 'HTTP', FakeHTTP(self.mp3)):
            self.main('--provider', 'elevenlabs', '--samples', '--yes')
        files = sorted(p.name for p in (box / 'samples').iterdir())
        self.assertEqual(len(files), 2)                       # one sample + samples.json
        self.assertTrue(files[0].startswith('elevenlabs-intro-title-'))
        self.assertEqual(list((box / 'public' / 'audio' / 'fi').iterdir()), [])
        self.assertFalse((box / 'voices.json').exists())

    def test_source_take(self):
        """SOURCE_TAKES: mastered from the fixed take, no TTS request, a new take file = a new key."""
        box, data = self.sandbox()
        src = box / 'take.mp3'
        src.write_bytes(self.mp3)
        fake = FakeHTTP(self.mp3)
        with mock.patch.object(mv, 'SOURCE_TAKES', {'intro-title': str(src)}), mock.patch.object(mv, 'HTTP', fake):
            self.main('--provider', 'elevenlabs', '--yes', '--no-qa')
            self.assertEqual([c['body']['text'] for c in fake.calls if '/text-to-speech/' in c['url']], ['[excited] Hienoa!'])
            vj = json.loads((box / 'voices.json').read_text(encoding='utf-8'))
            v = {e['id']: e for e in vj['clips']}
            self.assertEqual(v['intro-title']['settings']['source'], str(src))
            self.assertTrue((box / 'public' / 'audio' / 'fi' / 'intro-title.mp3').exists())
            key = v['intro-title']['key']
            src.write_bytes(src.read_bytes() + b'\0')
            clip = {'id': 'intro-title', 'lang': 'fi', 'text': 'Suuraseikkailu!'}
            self.assertNotEqual(mv.clip_key(clip, vj['target_lufs'], mv.voice_cfg(clip, 'elevenlabs')), key)

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
        self.assertEqual([c['body']['text'] for c in fake.calls if '/text-to-speech/' in c['url']], ['[cheerful] Aaisha!'])
        self.assertTrue(out.exists())
        self.assertFalse((box / 'voices.json').exists())
        with self.assertRaises(SystemExit):
            self.run_quiet(make_name.main, ['Aisha', '--out', str(mv.ROOT / 'public' / 'aisha.mp3')])
        self.assertEqual(make_name.slug('Äijä Öö'), 'aija-oo')


if __name__ == '__main__':
    unittest.main()
