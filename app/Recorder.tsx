"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Check } from "lucide-react";
import { AudioButton } from "./AudioButton";
import type { Lang, Text } from "@/lib/learning";
function wav(buffer: AudioBuffer) {
  const samples = buffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + samples.length * 2),
    view = new DataView(bytes);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const n = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, n < 0 ? n * 32768 : n * 32767, true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}
export default function Recorder({
  target,
  lang,
  tips,
  signedIn,
  onPractice,
}: {
  target: string;
  lang: Lang;
  tips?: Text;
  signedIn: boolean;
  onPractice?: () => void;
}) {
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [requesting, setRequesting] = useState(false);
  const [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [quality, setQuality] = useState(""),
    [heard, setHeard] = useState(false);
  const rec = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    timeout = useRef<ReturnType<typeof setTimeout> | null>(null),
    blob = useRef<Blob | null>(null),
    currentUrl = useRef(""),
    alive = useRef(true),
    generation = useRef(0),
    startPending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      if (rec.current?.state === "recording") rec.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      if (timeout.current) clearTimeout(timeout.current);
      URL.revokeObjectURL(currentUrl.current);
    };
  }, []);
  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    if (timer.current) clearInterval(timer.current);
    if (timeout.current) clearTimeout(timeout.current);
    setRecording(false);
  }
  async function start() {
    if (startPending.current || recording) return;
    startPending.current = true;
    setRequesting(true);
    const token = ++generation.current;
    setError("");
    setHeard(false);
    setSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        t(
          "这个浏览器暂不支持录音，请使用 Safari 或 Chrome 的 HTTPS 页面。",
          "Recording is not available here. Use Safari or Chrome on HTTPS.",
        ),
      );
      startPending.current = false;
      setRequesting(false);
      return;
    }
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (!alive.current || token !== generation.current) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = acquired;
      const formats = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
      const mimeType = formats.find((f) => MediaRecorder.isTypeSupported(f));
      const recorder = new MediaRecorder(
        stream.current,
        mimeType ? { mimeType } : {},
      );
      rec.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        try {
          const input = new Blob(chunks, { type: recorder.mimeType });
          const ctx = new AudioContext();
          let decoded: AudioBuffer;
          try {
            decoded = await ctx.decodeAudioData(await input.arrayBuffer());
          } finally {
            await ctx.close();
          }
          const offline = new OfflineAudioContext(
            1,
            Math.ceil(decoded.duration * 16000),
            16000,
          );
          const source = offline.createBufferSource();
          source.buffer = decoded;
          source.connect(offline.destination);
          source.start();
          const mono = await offline.startRendering();
          if (!alive.current || token !== generation.current) return;
          blob.current = wav(mono);
          URL.revokeObjectURL(currentUrl.current);
          currentUrl.current = URL.createObjectURL(blob.current);
          setUrl(currentUrl.current);
          const samples = mono.getChannelData(0);
          let energy = 0,
            clipped = 0;
          for (const v of samples) {
            energy += v * v;
            if (Math.abs(v) > 0.98) clipped++;
          }
          const rms = Math.sqrt(energy / samples.length);
          setQuality(
            rms < 0.008
              ? t(
                  "声音较轻或接近静音。靠近麦克风，再试一次。",
                  "The sound is very quiet. Move closer and try again.",
                )
              : clipped / samples.length > 0.02
                ? t(
                    "声音有些过响。离麦克风稍远一点。",
                    "The sound is too loud. Move back a little.",
                  )
                : t(
                    `已录制 ${mono.duration.toFixed(1)} 秒。请回听并与示范对比。`,
                    `Recorded ${mono.duration.toFixed(1)} seconds. Listen and compare.`,
                  ),
          );
        } catch {
          if (alive.current)
            setError(
              t(
                "无法读取这段录音，请重新录制。",
                "Could not read this clip. Please record again.",
              ),
            );
        }
      };
      recorder.start();
      setRecording(true);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      timeout.current = setTimeout(stop, 20000);
    } catch (e) {
      if (!alive.current || token !== generation.current) return;
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? t(
              "麦克风权限未开启。请在浏览器设置中允许，然后重试。",
              "Allow the microphone in your browser, then try again.",
            )
          : t(
              "麦克风无法使用，请检查设备后重试。",
              "The microphone is not ready. Check it and try again.",
            ),
      );
      stream.current?.getTracks().forEach((t) => t.stop());
    } finally {
      startPending.current = false;
      if (alive.current) setRequesting(false);
    }
  }
  return (
    <div className="recorder">
      <div className="record-actions">
        <AudioButton text={target} lang={lang} />
        <button
          type="button"
          className={"record-button " + (recording ? "recording" : "")}
          onClick={recording ? stop : start}
          disabled={requesting}
        >
          {recording ? <Square size={18} /> : <Mic size={19} />}{" "}
          {recording
            ? `${seconds}s · ${t("停止", "Stop")}`
            : url
              ? t("重新录音", "Try again")
              : t("开始录音", "Record")}
        </button>
      </div>
      <p className="muted small">
        {t(
          "最多 20 秒 · 录音只在此设备回听，不会上传。离开页面后不保存。",
          "Up to 20 seconds. Your recording stays on this device. It is not uploaded or saved.",
        )}
      </p>
      {url && (
        <div className="recorded">
          <audio controls src={url} onEnded={() => setHeard(true)} />
          <p className="small">{quality}</p>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {tips && (
        <div className="pronunciation-tip">
          <strong>{t("练习时留意", "Focus on this")}</strong>
          <p>{tips[lang]}</p>
        </div>
      )}
      {url && (
        <>
          <p className="availability">
            {t(
              "这是跟读与自评，不自动判断发音对错。听完录音，再对比示范。",
              "This is a self-check, with no speech score. Listen to your clip, then compare it with the example.",
            )}
          </p>
          {onPractice && (
            <button
              className="secondary"
              disabled={!heard}
              onClick={onPractice}
            >
              <Check size={18} />
              {t("我已回听并完成跟读", "I listened and tried")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
