#!/usr/bin/env python3
"""Build Yinji's static, neural US-English audio library locally.

No paid API, keys, or visitor speech are used. Install scripts/audio-requirements.txt
in a separate Python 3.12 venv. Initial run downloads the official Kokoro weights
and Misaki English language model. Existing clips are retained on subsequent runs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "audio"
SAMPLE_TEXTS = ["Hello.", "ship", "sheep", "ship, sheep", "a cat", "an apple"]
READ_PRESENT = {
    "read",
    "after lunch, i read.", "does she read? she does not read.",
    "i am going to read tomorrow.", "i book a room. i read a book.",
    "i read a book.", "i read a new book every week.", "i read every day.",
    "i will read tomorrow. i am going to read.", "she reads. they read.",
    "she will read tomorrow.", "they do not read at night.", "take it, read it",
}
READ_PAST = {"i read a book yesterday.", "she reads. she is reading. she has read."}


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def synthesis_text(text: str) -> str:
    """Resolve known homographs using Kokoro's documented phoneme override.

    Misaki tags bare 'I read every day' as past tense. Explicit token input
    preserves the course's intended present/past distinction.
    """
    key = normalize(text)
    if key == "i read every day. i read yesterday.":
        return "I [read](/ɹˈid/) every day. I [read](/ɹˈɛd/) yesterday."
    if key in READ_PRESENT:
        return re.sub(r"\bread\b", "[read](/ɹˈid/)", text, flags=re.IGNORECASE)
    if key in READ_PAST:
        return re.sub(r"\bread\b", "[read](/ɹˈɛd/)", text, flags=re.IGNORECASE)
    return text


def collect_texts(paths: list[Path]) -> dict[str, dict]:
    texts: dict[str, dict] = {}

    def add(text: object, source: str):
        if not isinstance(text, str):
            return
        text = re.sub(r"\s+", " ", text).strip()
        # Never send IPA, Chinese UI text, or blank quiz placeholders to TTS.
        if not text or not re.search(r"[A-Za-z]", text) or re.search(r"[\u3400-\u9fff]", text):
            return
        if text.startswith("/") or "___" in text:
            return
        key = normalize(text)
        texts.setdefault(key, {"text": text, "sources": []})
        if source not in texts[key]["sources"]:
            texts[key]["sources"].append(source)

    def walk(value: object, source: str):
        if isinstance(value, dict):
            for key, item in value.items():
                if key in {"audioText", "target", "word"}:
                    add(item, source + "." + key)
                walk(item, source + "." + key)
        elif isinstance(value, list):
            for i, item in enumerate(value):
                walk(item, f"{source}[{i}]")

    for item in SAMPLE_TEXTS:
        add(item, "starter-sample")
    for path in paths:
        if path.exists():
            walk(json.loads(path.read_text()), str(path.relative_to(ROOT)))
    return texts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voice", default="am_puck", help="Official Kokoro US male voice")
    parser.add_argument("--speed", type=float, default=0.9)
    parser.add_argument("--device", default="cpu", choices=["cpu", "mps", "cuda"])
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--list", action="store_true", help="List pending clips without loading a model")
    parser.add_argument("--text", action="append", help="Additional English text; repeatable")
    parser.add_argument("--model-dir", type=Path, help="Optional local config.json, kokoro-v1_0.pth, voice.pt directory")
    args = parser.parse_args()
    paths = sorted((ROOT / "content").glob("*.json"))
    requested = collect_texts(paths)
    for text in args.text or []:
        requested[normalize(text)] = {"text": text, "sources": ["cli"]}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUTPUT / "manifest.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    if old and (old.get("voice") != args.voice or old.get("speed") != args.speed):
        raise SystemExit("Existing library uses a different voice/speed; create a separate library rather than mix it.")
    clips = old.get("clips", {})
    pending = [(key, row) for key, row in requested.items()
               if key not in clips or not (ROOT / "public" / clips[key]["url"].lstrip("/")).exists()
               or clips[key].get("synthesisInput", clips[key]["text"]) != synthesis_text(row["text"])]
    print(f"Requested {len(requested)} unique clips; {len(pending)} pending", flush=True)
    if args.list:
        for _, row in pending:
            print(row["text"])
        return
    if args.limit:
        pending = pending[:args.limit]
    if not pending:
        return

    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    import imageio_ffmpeg
    import numpy as np
    import soundfile as sf
    import torch
    from kokoro import KModel, KPipeline

    torch.set_num_threads(min(4, os.cpu_count() or 1))
    if args.model_dir:
        model = KModel(repo_id="hexgrad/Kokoro-82M", config=str(args.model_dir / "config.json"), model=str(args.model_dir / "kokoro-v1_0.pth"))
        model = model.to(args.device).eval()
        pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", model=model)
        voice = str(args.model_dir / f"{args.voice}.pt")
    else:
        pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", device=args.device)
        voice = args.voice
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    manifest = {**old, "version": 1, "provider": "Kokoro-82M", "modelRevision": "v1.0",
                "voice": args.voice, "locale": "en-US", "speed": args.speed,
                "sampleRate": 24000, "modelLicense": "Apache-2.0",
                "voiceDescription": "AI-generated American English male voice",
                "disclosure": old.get("disclosure", "AI-generated speech. Human listening review has not been completed."),
                "generatedAt": datetime.now(timezone.utc).isoformat(), "clips": clips}
    for count, (key, row) in enumerate(pending, 1):
        # A stable hash prevents overwrites; numeric suffix also makes generation explicit.
        spoken_text = synthesis_text(row["text"])
        digest = hashlib.sha256((args.voice + "\0" + str(args.speed) + "\0" + key + "\0" + spoken_text).encode()).hexdigest()[:16]
        out = OUTPUT / f"{digest}_1.mp3"
        results = list(pipeline(spoken_text, voice=voice, speed=args.speed, split_pattern=r"\n+"))
        chunks = [r.audio.detach().cpu().numpy() for r in results if r.audio is not None]
        if not chunks:
            raise RuntimeError(f"No audio for {row['text']!r}")
        data = np.concatenate(chunks)
        if not np.isfinite(data).all() or len(data) < 2400 or float(np.max(np.abs(data))) < 0.005:
            raise RuntimeError(f"Invalid or silent audio for {row['text']!r}")
        # Prevent output clipping without changing pitch or voice.
        peak = float(np.max(np.abs(data)))
        if peak > 0.95:
            data = data * (0.95 / peak)
        with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
            sf.write(wav.name, data, 24000, subtype="PCM_16")
            subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", wav.name,
                            "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", str(out)], check=True)
        clips[key] = {"url": "/audio/" + out.name, "text": row["text"],
                      "synthesisInput": spoken_text,
                      "duration": round(len(data) / 24000, 3), "kind": "speech",
                      "phonemes": " ".join(r.phonemes for r in results), "sources": row["sources"]}
        if key == "read":
            clips[key]["pronunciationNote"] = {
                "zh": "这里只示范原形和现在时 /riːd/。过去式与过去分词为 /rɛd/，请结合句子和词典音标判断。",
                "en": "This is the base and present form /riːd/. The past forms use /rɛd/. Check the sentence and dictionary."
            }
        # Save after every clip: interrupted runs resume without recomputing audio.
        staged = manifest_path.with_suffix(".json.tmp")
        staged.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        staged.replace(manifest_path)
        print(f"[{count}/{len(pending)}] {row['text']} ({clips[key]['duration']}s)", flush=True)
    print(f"Ready: {len(clips)} clips in {OUTPUT}", flush=True)


if __name__ == "__main__":
    main()
