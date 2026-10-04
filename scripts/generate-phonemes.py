#!/usr/bin/env python3
"""Generate actual phoneme-token demonstrations, bypassing text-to-phoneme G2P.

Kokoro's generate_from_tokens API consumes its phonetic token alphabet. The
mapping below follows that alphabet, not English letter names. Stop consonants
receive no appended schwa. These are labelled AI demonstrations; they have not
been accepted as a human-reviewed phonetic reference corpus.

Run separately from generate-audio.py: both update the shared manifest.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/audio"
TOKENS = {
    "/i/": "ˈi", "/ɪ/": "ˈɪ", "/ɛ/": "ˈɛ", "/æ/": "ˈæ",
    "/ɑ/": "ˈɑ", "/ɔ/": "ˈɔ", "/ʊ/": "ˈʊ", "/u/": "ˈu",
    "/ʌ/": "ˈʌ", "/ə/": "ə", "/eɪ/": "ˈA", "/aɪ/": "ˈI",
    "/ɔɪ/": "ˈY", "/aʊ/": "ˈW", "/oʊ/": "ˈO", "/ɝ/": "ˈɜɹ",
    "/ɚ/": "əɹ", "/p/": "p", "/b/": "b", "/t/": "t",
    "/d/": "d", "/k/": "k", "/ɡ/": "ɡ", "/f/": "f",
    "/v/": "v", "/θ/": "θ", "/ð/": "ð", "/s/": "s",
    "/z/": "z", "/ʃ/": "ʃ", "/ʒ/": "ʒ", "/h/": "h",
    "/tʃ/": "ʧ", "/dʒ/": "ʤ", "/m/": "m", "/n/": "n",
    "/ŋ/": "ŋ", "/l/": "l", "/r/": "ɹ", "/w/": "w", "/j/": "j",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path)
    parser.add_argument("--device", default="cpu", choices=["cpu", "mps", "cuda"])
    args = parser.parse_args()
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    import imageio_ffmpeg
    import numpy as np
    import soundfile as sf
    import torch
    from kokoro import KPipeline, KModel

    sounds = json.loads((ROOT / "content/sounds.json").read_text())
    manifest_path = OUTPUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    phonemes = manifest.setdefault("phonemes", {})
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    if args.model_dir:
        model = KModel(repo_id="hexgrad/Kokoro-82M", config=str(args.model_dir / "config.json"),
                       model=str(args.model_dir / "kokoro-v1_0.pth")).to(args.device).eval()
        pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", model=model)
        voice = str(args.model_dir / f"{manifest['voice']}.pt")
    else:
        pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M", device=args.device)
        voice = manifest["voice"]
    for i, sound in enumerate(sounds, 1):
        if sound["id"] in phonemes and (ROOT / "public" / phonemes[sound["id"]]["url"].lstrip("/")).exists():
            continue
        token = TOKENS[sound["symbol"]]
        unknown = [c for c in token if c not in pipeline.model.vocab]
        if unknown:
            raise RuntimeError(f"Unknown model tokens: {unknown}")
        results = list(pipeline.generate_from_tokens(token, voice=voice, speed=0.75))
        data = np.concatenate([r.audio.detach().cpu().numpy() for r in results if r.audio is not None])
        if not np.isfinite(data).all() or len(data) < 2400 or float(np.sqrt(np.mean(data * data))) < 0.001:
            raise RuntimeError(f"Invalid or silent phoneme demonstration: {sound['symbol']}")
        peak = float(np.max(np.abs(data)))
        if peak > 0.95:
            data *= 0.95 / peak
        suffix = hashlib.sha256((manifest["voice"] + token).encode()).hexdigest()[:8]
        out = OUTPUT / f"{sound['id']}_{suffix}_1.mp3"
        with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
            sf.write(wav.name, data, 24000, subtype="PCM_16")
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
                            "-i", wav.name, "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", str(out)], check=True)
        phonemes[sound["id"]] = {"url": "/audio/" + out.name, "symbol": sound["symbol"],
                                  "input": token, "duration": round(len(data) / 24000, 3),
                                  "kind": "phoneme", "speed": 0.75, "reviewedByHuman": False}
        manifest["disclosure"] = "AI-generated phoneme demonstrations and speech. Practise the sound in words too. Human listening review has not been completed."
        tmp = manifest_path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        tmp.replace(manifest_path)
        print(f"[{i}/{len(sounds)}] {sound['symbol']} <- {token} ({len(data) / 24000:.3f}s)", flush=True)


if __name__ == "__main__":
    main()
