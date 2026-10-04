"use client";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Headphones,
  Lock,
  Play,
  Star,
  Trophy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AudioButton } from "./AudioButton";
import LiquidIndicator from "./LiquidIndicator";
import type { Lang, Lesson, Stage } from "@/lib/learning";

type Props = {
  stages: Stage[];
  stageIndex: number;
  lessonIndex: number;
  completed: Set<string>;
  available: Set<string>;
  lang: Lang;
  busy: boolean;
  onStage: (index: number) => void;
  onLesson: (index: number) => void;
  onStart: (lesson: Lesson) => void;
};
const points = [
  [175, 67],
  [108, 153],
  [162, 239],
  [239, 325],
  [209, 411],
  [154, 497],
];

export default function GamePath({
  stages,
  stageIndex,
  lessonIndex,
  completed,
  available,
  lang,
  busy,
  onStage,
  onLesson,
  onStart,
}: Props) {
  const [chapters, setChapters] = useState(false);
  const chapterClose = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chapterButton = useRef<HTMLButtonElement>(null);
  useEffect(
    () => () => {
      if (chapterClose.current) clearTimeout(chapterClose.current);
    },
    [],
  );
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const stage = stages[stageIndex];
  const selected = stage.lessons[lessonIndex];
  const open = available.has(selected.id);
  const done = stage.lessons.filter((l) => completed.has(l.id)).length;
  return (
    <>
      <div className="game-journey">
        <section
          className="adventure-map"
          aria-label={t("闯关地图", "Level map")}
        >
          <button
            ref={chapterButton}
            className="chapter-banner"
            onClick={() => setChapters(true)}
            aria-label={t("切换章节", "Choose a chapter")}
          >
            <span className="chapter-emblem">
              <img src="/yinji-mark.svg" alt="" aria-hidden="true" />
            </span>
            <span>
              <small>
                {t(
                  `第 ${stageIndex + 1} 章 / 共 ${stages.length} 章`,
                  `CHAPTER ${stageIndex + 1} OF ${stages.length}`,
                )}
              </small>
              <strong>{stage.title[lang]}</strong>
            </span>
            <ChevronDown size={22} />
          </button>
          <div className="chapter-progress">
            <span>{t(`已收集 ${done} / 6 颗星`, `${done} of 6 stars`)}</span>
            <span>
              {stage.lessons.map((l) => (
                <Star
                  key={l.id}
                  size={15}
                  fill={completed.has(l.id) ? "currentColor" : "none"}
                  className={completed.has(l.id) ? "earned" : ""}
                />
              ))}
            </span>
          </div>
          <div className="level-path liquid-group">
            <LiquidIndicator
              activeKey={selected.id}
              selector=".level-stop.selected .level-node"
            />
            <svg
              className="path-line"
              viewBox="0 0 360 558"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M175 67 C175 112 108 109 108 153 S162 194 162 239 S239 282 239 325 S209 368 209 411 S154 454 154 497" />
            </svg>
            <span className="path-decoration note-one" aria-hidden="true">
              /ʃ/
            </span>
            <span className="path-decoration note-two" aria-hidden="true">
              /æ/
            </span>
            <span className="map-phoneme" aria-hidden="true">
              /ɪ/
            </span>
            {stage.lessons.map((lesson, index) => {
              const passed = completed.has(lesson.id),
                unlocked = available.has(lesson.id),
                selectedNode = index === lessonIndex;
              const state = passed ? "passed" : unlocked ? "open" : "locked";
              return (
                <div
                  className={`level-stop ${state} ${selectedNode ? "selected" : ""}`}
                  key={lesson.id}
                  style={{
                    left: `${points[index][0] / 3.6}%`,
                    top: points[index][1],
                  }}
                >
                  {selectedNode && unlocked && (
                    <span className="start-bubble">
                      {passed
                        ? t("再练一次", "TRY AGAIN")
                        : t("从这里开始", "START HERE")}
                    </span>
                  )}
                  <button
                    className="level-node"
                    onClick={() => onLesson(index)}
                    aria-label={t(
                      `第 ${index + 1} 关：${lesson.title.zh}${passed ? "，已通关" : unlocked ? "，可开始" : "，尚未解锁"}`,
                      `Level ${index + 1}: ${lesson.title.en}${passed ? ", passed" : unlocked ? ", ready" : ", locked"}`,
                    )}
                    aria-pressed={selectedNode}
                    data-status={state}
                  >
                    {passed ? (
                      <Star size={30} fill="currentColor" />
                    ) : !unlocked ? (
                      <Lock size={25} />
                    ) : lesson.kind === "checkpoint" ? (
                      <Trophy size={29} />
                    ) : index % 2 ? (
                      <Headphones size={29} />
                    ) : (
                      <Star size={30} fill="currentColor" />
                    )}
                  </button>
                  <span className="level-title">
                    {index === 5
                      ? t("章节挑战", "CHAPTER CHECK")
                      : lesson.title[lang]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
        <aside
          className={`quest-card ${!open ? "quest-locked" : ""}`}
          aria-label={t("当前关卡", "Your level")}
        >
          <div className="quest-hero">
            <span className="quest-tag">
              {selected.kind === "checkpoint"
                ? t("准备好挑战了吗？", "READY FOR A CHECK?")
                : t("从一个声音开始", "ONE SOUND AT A TIME")}
            </span>
            <div className="phoneme-orbs" aria-hidden="true">
              <span className="phoneme-orb orb-left">/ɪ/</span>
              <span className="phoneme-orb orb-main">/æ/</span>
              <span className="phoneme-orb orb-right">/ə/</span>
            </div>
          </div>
          <div className="quest-copy">
            <p className="quest-kicker">
              {t(`第 ${lessonIndex + 1} 关`, `LEVEL ${lessonIndex + 1}`)}{" "}
              <span>
                · {selected.duration} {t("分钟", "min")}
              </span>
            </p>
            <h2>{selected.title[lang]}</h2>
            <p className="quest-description">{selected.description[lang]}</p>
          </div>
          <div className="quest-example">
            {stageIndex === 0 && lessonIndex === 0 ? (
              <>
                <span>
                  <b>/ɪ/</b> ship{" "}
                  <AudioButton
                    text="ship"
                    lang={lang}
                    label={t("听一听", "Listen")}
                  />
                </span>
                <span>
                  <b>/i/</b> sheep{" "}
                  <AudioButton
                    text="sheep"
                    lang={lang}
                    label={t("听一听", "Listen")}
                  />
                </span>
              </>
            ) : (
              <>
                <p>{selected.concepts[0]?.example}</p>
                <AudioButton
                  text={selected.concepts[0]?.audioText || ""}
                  lang={lang}
                />
              </>
            )}
          </div>
          <div className="quest-footer">
            <button
              className="primary start-button"
              disabled={busy || !open}
              onClick={() => onStart(selected)}
            >
              {!open ? (
                <Lock size={19} />
              ) : completed.has(selected.id) ? (
                <Check size={20} />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
              {!open
                ? t("先通过前一关", "PASS THE LAST LEVEL")
                : completed.has(selected.id)
                  ? t("再练习一次", "Practice again")
                  : selected.kind === "checkpoint"
                    ? t("开始阶段考核", "Take the stage check")
                    : t("开始这一课", "Start this lesson")}
            </button>
            <small>
              {open
                ? t("听一听 → 学一学 → 闯一关", "LISTEN · LEARN · PLAY")
                : t(
                    "一关一关来，你一定可以。",
                    "One step at a time. You can do it.",
                  )}
            </small>
          </div>
          <div className="quest-rule">
            <BookOpen size={18} />
            <span>
              {t(
                "答对 80% 即可通关，错题随时再练。",
                "Pass with 80%. Try mistakes again any time.",
              )}
            </span>
          </div>
        </aside>
      </div>
      <Dialog
        open={chapters}
        onOpenChange={(open) => {
          if (chapterClose.current) clearTimeout(chapterClose.current);
          setChapters(open);
        }}
      >
        <DialogContent
          className="chapter-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            chapterButton.current?.focus();
          }}
        >
          <DialogTitle>{t("选择冒险章节", "Choose your chapter")}</DialogTitle>
          <DialogDescription>
            {t(
              "每章 6 关。一步一步，解锁新的世界。",
              "Six levels in each chapter. Take one step at a time.",
            )}
          </DialogDescription>
          <div className="chapter-choices liquid-group">
            <LiquidIndicator activeKey={stageIndex} selector="button.current" />
            {stages.map((s, i) => (
              <button
                key={s.id}
                className={i === stageIndex ? "current" : ""}
                aria-pressed={i === stageIndex}
                onClick={() => {
                  onStage(i);
                  if (chapterClose.current) clearTimeout(chapterClose.current);
                  chapterClose.current = setTimeout(
                    () => setChapters(false),
                    window.matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                      ? 0
                      : 220,
                  );
                }}
              >
                <span className="chapter-choice-number">{i + 1}</span>
                <span>
                  <strong>{s.title[lang]}</strong>
                  <small>
                    {s.lessons.filter((l) => completed.has(l.id)).length} / 6{" "}
                    {t("关已通过", "levels passed")}
                  </small>
                </span>
                {s.lessons.every((l) => completed.has(l.id)) ? (
                  <Trophy size={22} />
                ) : available.has(s.lessons[0].id) ? (
                  <ChevronRight size={22} />
                ) : (
                  <Lock size={19} />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
