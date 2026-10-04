#!/usr/bin/env python3
"""Check curriculum coverage and decode every published MP3.

Run with the audio virtual environment after generating or changing course data.
This checks technical integrity, not perceived pronunciation correctness.
"""
from pathlib import Path
import importlib.util
import json
import subprocess
import sys

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("generate_audio", Path(__file__).with_name("generate-audio.py"))
generation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generation)
requested = generation.collect_texts(sorted((ROOT / "content").glob("*.json")))
manifest = json.loads((ROOT / "public/audio/manifest.json").read_text())
clips = manifest["clips"]
phonemes = manifest.get("phonemes", {})
sound_path = ROOT / "content/sounds.json"
sounds = json.loads(sound_path.read_text()) if sound_path.exists() else []
missing_phonemes = [s["id"] for s in sounds if s["id"] not in phonemes]
missing = sorted(set(requested) - set(clips))
failures = ["missing: " + item for item in missing] + ["missing phoneme: " + item for item in missing_phonemes]
for key, row in requested.items():
    clip = clips.get(key)
    if clip and clip.get("synthesisInput", clip["text"]) != generation.synthesis_text(row["text"]):
        failures.append("stale pronunciation override: " + key)
    if clip and key in generation.READ_PRESENT and ("ɹˈid" not in clip["phonemes"] or "ɹˈɛd" in clip["phonemes"]):
        failures.append("present read pronounced as past: " + key)
    if clip and key in generation.READ_PAST and "ɹˈɛd" not in clip["phonemes"]:
        failures.append("past read lacks the expected vowel: " + key)
contrast = clips.get("i read every day. i read yesterday.")
if contrast and not all(v in contrast["phonemes"] for v in ["ɹˈid", "ɹˈɛd"]):
    failures.append("read contrast does not contain both vowel forms")
durations = []
total_bytes = 0
for key, clip in {**clips, **phonemes}.items():
    path = ROOT / "public" / clip["url"].lstrip("/")
    if not path.exists() or path.stat().st_size < 1024:
        failures.append("missing or too small: " + key)
        continue
    decoded = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(path),
                              "-f", "f32le", "-ac", "1", "-ar", "24000", "pipe:1"], capture_output=True)
    if decoded.returncode:
        failures.append("decode failure: " + key)
        continue
    samples = np.frombuffer(decoded.stdout, dtype=np.float32)
    duration = len(samples) / 24000
    if len(samples) < 2400 or not np.isfinite(samples).all():
        failures.append("empty/invalid samples: " + key)
        continue
    rms = float(np.sqrt(np.mean(samples * samples)))
    if rms < (0.001 if clip.get("kind") == "phoneme" else 0.003):
        failures.append("near silent: " + key)
    if abs(duration - clip["duration"]) > 0.1:
        failures.append("duration mismatch: " + key)
    sequence = clip.get("input") if clip.get("kind") == "phoneme" else clip.get("phonemes")
    if not sequence or "❓" in sequence:
        failures.append("unknown phoneme mapping: " + key)
    durations.append(duration)
    total_bytes += path.stat().st_size
report = {"requestedSpeechClips": len(requested), "publishedSpeechClips": len(clips), "phonemeClips": len(phonemes),
          "missingClips": len(missing), "missingPhonemes": len(missing_phonemes),
          "decodedClips": len(durations), "totalBytes": total_bytes,
          "totalSeconds": round(sum(durations), 2), "failures": failures,
          "note": "Technical integrity and text coverage only; listening review is separate."}
print(json.dumps(report, ensure_ascii=False, indent=2))
sys.exit(1 if failures else 0)
