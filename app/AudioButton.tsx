"use client";
import { useEffect, useState } from "react";
import { Volume2, LoaderCircle, Square } from "lucide-react";
import type { Lang } from "@/lib/learning";
type Manifest = { clips: Record<string, { url: string; duration: number }> };
let manifest: Promise<Manifest> | null = null;
let playing: HTMLAudioElement | null = null;
export function stopAudio() {
  playing?.pause();
  playing = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
export function AudioButton({
  text,
  lang = "zh",
  slow = false,
  label,
  large = false,
}: {
  text: string;
  lang?: Lang;
  slow?: boolean;
  label?: string;
  large?: boolean;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  useEffect(
    () => () => {
      stopAudio();
    },
    [],
  );
  async function play() {
    if (active) {
      stopAudio();
      setActive(false);
      return;
    }
    if (!text.trim()) return;
    setBusy(true);
    setStatus("");
    stopAudio();
    try {
      manifest ??= fetch("/audio/manifest.json")
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json() as Promise<Manifest>;
        })
        .catch((e) => {
          manifest = null;
          throw e;
        });
      const index = await manifest!;
      const key = text.trim().replace(/\s+/g, " ").toLowerCase();
      const clip = index.clips[key];
      if (clip) {
        const audio = new Audio(clip.url);
        playing = audio;
        audio.playbackRate = slow ? 0.78 : 1;
        audio.preservesPitch = true;
        audio.onended = () => setActive(false);
        audio.onpause = () => setActive(false);
        audio.onerror = () => {
          setActive(false);
          setStatus(
            lang === "zh"
              ? "音频加载失败，请重试"
              : "Audio did not load. Try again.",
          );
        };
        await audio.play();
        setActive(true);
      } else {
        if (!window.speechSynthesis) throw Error();
        const voice = new SpeechSynthesisUtterance(text);
        voice.lang = "en-US";
        voice.rate = slow ? 0.7 : 0.9;
        voice.voice =
          window.speechSynthesis
            .getVoices()
            .find(
              (v) => v.lang === "en-US" && /Alex|Aaron|David|Guy/i.test(v.name),
            ) || null;
        voice.onend = () => setActive(false);
        voice.onerror = () => setActive(false);
        window.speechSynthesis.speak(voice);
        setActive(true);
        setStatus(
          lang === "zh" ? "新词：使用设备声音" : "New word: device voice",
        );
      }
    } catch {
      setStatus(
        lang === "zh"
          ? "暂时无法播放，请再试一次"
          : "Audio is not ready. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className={"audio-wrap " + (large ? "large" : "")}>
      <button
        type="button"
        className={"audio-button " + (large ? "large" : "")}
        aria-label={
          (lang === "zh" ? "朗读 " : "Play ") + text + (slow ? " (slow)" : "")
        }
        onClick={play}
        disabled={busy}
      >
        {busy ? (
          <LoaderCircle size={19} className="spin" />
        ) : active ? (
          <Square size={18} />
        ) : (
          <Volume2 size={large ? 26 : 18} />
        )}
        <span>
          {label ||
            (slow
              ? lang === "zh"
                ? "慢速"
                : "Slow"
              : lang === "zh"
                ? "听示范"
                : "Listen")}
        </span>
      </button>
      {status && <small role="status">{status}</small>}
    </span>
  );
}
