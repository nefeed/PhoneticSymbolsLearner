"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  BookOpen,
  Library,
  Flame,
  Sparkles,
  Cloud,
  Globe2,
  Check,
  Headphones,
  X,
  Bookmark,
  Search,
  Plus,
  Trash2,
  Download,
  Printer,
  RotateCcw,
  HelpCircle,
  Trophy,
  LoaderCircle,
  CheckCircle2,
  Menu,
  Star,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import curriculum from "@/content/curriculum.json";
import soundData from "@/content/sounds.json";
import {
  emptyState,
  gradeLesson,
  checkAnswer,
  reviewItems,
  studyDays,
  type State,
  type Stage,
  type Sound,
  type Lesson,
  type Question,
  type Lang,
  type Resume,
  type Word,
} from "@/lib/learning";
import { AudioButton, stopAudio } from "./AudioButton";
import Recorder from "./Recorder";
import GamePath from "./GamePath";
const stages = curriculum.stages as Stage[],
  sounds = soundData as Sound[],
  lessons = stages.flatMap((s) => s.lessons),
  questions = lessons.flatMap((l) => l.questions);
const uid = () => crypto.randomUUID();
type Session = {
  lesson: Lesson;
  phase: "concept" | "question";
  index: number;
  answers: Record<string, string>;
  runId: string;
  review?: Question[];
};
type Props = {
  user: { name: string; email: string } | null;
  signInUrl: string;
  signOutUrl: string;
};
export default function LearningApp({ user, signInUrl, signOutUrl }: Props) {
  const [lang, setLang] = useState<Lang>("zh"),
    [tab, setTab] = useState("learn"),
    [mobileMenu, setMobileMenu] = useState(false),
    [data, setData] = useState<State>(emptyState),
    [stageIndex, setStageIndex] = useState(0),
    [lessonIndex, setLessonIndex] = useState(0),
    [session, setSession] = useState<Session | null>(null),
    [result, setResult] = useState<{
      score: number;
      correct: number;
      total: number;
      review: boolean;
    } | null>(null),
    [choice, setChoice] = useState(""),
    [order, setOrder] = useState<number[]>([]),
    [submitted, setSubmitted] = useState<string | null>(null),
    [help, setHelp] = useState(false),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [hydrated, setHydrated] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [sound, setSound] = useState<Sound | null>(null),
    [soundFilter, setSoundFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [wordResult, setWordResult] = useState<any>(null),
    [wordBusy, setWordBusy] = useState(false),
    [wordForm, setWordForm] = useState<Partial<Word> | null>(null),
    [cardIndex, setCardIndex] = useState(0),
    [flipped, setFlipped] = useState(false);
  const pending = useRef<any>(null),
    stateRef = useRef(data),
    menuButton = useRef<HTMLButtonElement>(null);
  stateRef.current = data;
  const t = useCallback(
    (zh: string, en: string) => (lang === "zh" ? zh : en),
    [lang],
  );
  const optionText = (value: string) =>
    lang === "en" ? value.replace(/\s*·\s*[\u4e00-\u9fff].*$/, "") : value;
  const completed = useMemo(
    () => new Set(data.runs.filter((r) => r.passed).map((r) => r.lessonId)),
    [data.runs],
  );
  const review = useMemo(() => reviewItems(data.attempts), [data.attempts]);
  const due = review.filter((r) => r.due);
  const available = useMemo(
    () =>
      new Set(
        lessons
          .filter(
            (lesson, index) =>
              completed.has(lesson.id) ||
              index === 0 ||
              completed.has(lessons[index - 1].id) ||
              data.resume?.lessonId === lesson.id,
          )
          .map((lesson) => lesson.id),
      ),
    [completed, data.resume],
  );
  const stage = stages[stageIndex];
  useEffect(() => {
    setHydrated(true);
    if (!user) setReady(true);
    const pref = localStorage.getItem("yinji-language");
    if (pref === "en" || pref === "zh") setLang(pref);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    localStorage.setItem("yinji-language", lang);
  }, [lang]);
  const load = useCallback(async () => {
    if (!user || pending.current) return;
    try {
      const r = await fetch("/api/state");
      if (!r.ok) throw Error();
      const d: any = await r.json();
      setData(d);
      setReady(true);
      setError("");
    } catch {
      setError(
        t(
          "暂时无法读取云端进度，请重试。",
          "Could not load your progress. Please try again.",
        ),
      );
      setReady(false);
    }
  }, [user, t]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const fn = () => {
      if (user && !session && !busy && !pending.current) void load();
    };
    window.addEventListener("focus", fn);
    return () => window.removeEventListener("focus", fn);
  }, [load, user, session, busy]);
  async function mutate(action: any) {
    if (busy || (pending.current && pending.current !== action)) return false;
    setBusy(true);
    setError("");
    try {
      if (user) {
        if (!ready)
          throw Error(
            t("请先重新读取云端进度。", "Load your saved progress first."),
          );
        const r = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error || "Save failed");
        setData(d);
      } else {
        setData((prev) => {
          const next = { ...prev };
          if (action.action === "resume") next.resume = action.resume;
          if (action.action === "answer") {
            const q = questions.find((q) => q.id === action.questionId)!;
            const l = lessons.find((l) =>
              l.questions.some((x) => x.id === q.id),
            )!;
            if (!prev.attempts.some((a) => a.id === action.id))
              next.attempts = [
                {
                  id: action.id,
                  questionId: q.id,
                  lessonId: l.id,
                  answer: action.answer,
                  correct: checkAnswer(q, action.answer) ? 1 : 0,
                  createdAt: Date.now(),
                },
                ...prev.attempts,
              ];
          }
          if (
            action.action === "answer" &&
            next.resume &&
            next.resume.runId === action.id.split(":")[0]
          )
            next.resume = {
              ...next.resume,
              answers: {
                ...next.resume.answers,
                [action.questionId]: action.answer,
              },
            };
          if (action.action === "finish") {
            const l = lessons.find((l) => l.id === action.lessonId)!;
            const g = gradeLesson(l, action.answers);
            next.runs = [
              {
                id: action.id,
                lessonId: l.id,
                score: g.score,
                passed: g.score >= 80 ? 1 : 0,
                createdAt: Date.now(),
              },
              ...prev.runs.filter((r) => r.id !== action.id),
            ];
            next.resume = null;
          }
          if (action.action === "word") {
            const w = {
              ...action.word,
              id: action.word.word.trim().toLowerCase(),
              createdAt: Date.now(),
            };
            next.words = [w, ...prev.words.filter((x) => x.id !== w.id)];
          }
          if (action.action === "removeWord")
            next.words = prev.words.filter((w) => w.id !== action.id);
          return next;
        });
      }
      pending.current = null;
      return true;
    } catch (e) {
      pending.current = action;
      setError(
        (e instanceof Error ? e.message : "") +
          " " +
          t("尚未保存，请重试。", "Not saved. Please try again."),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function cleanQuestion() {
    setChoice("");
    setOrder([]);
    setSubmitted(null);
    setHelp(false);
    stopAudio();
  }
  async function startLesson(lesson: Lesson, resume?: NonNullable<Resume>) {
    if (pending.current) return;
    const s: Session = resume
      ? { lesson, ...resume, phase: resume.phase as "concept" | "question" }
      : { lesson, phase: "concept", index: 0, answers: {}, runId: uid() };
    if (
      !(await mutate({
        action: "resume",
        resume: {
          lessonId: lesson.id,
          phase: s.phase,
          index: s.index,
          answers: s.answers,
          runId: s.runId,
        },
      }))
    )
      return;
    cleanQuestion();
    if (
      s.phase === "question" &&
      s.answers[s.lesson.questions[s.index].id] !== undefined
    ) {
      const saved = s.answers[s.lesson.questions[s.index].id];
      setSubmitted(saved);
      setChoice(saved);
    }
    setResult(null);
    const chapterIndex = stages.findIndex((chapter) =>
      chapter.lessons.some((item) => item.id === lesson.id),
    );
    if (chapterIndex >= 0) {
      setStageIndex(chapterIndex);
      setLessonIndex(
        stages[chapterIndex].lessons.findIndex((item) => item.id === lesson.id),
      );
    }
    setSession(s);
    setTab("learn");
  }
  async function advance() {
    if (!session || busy || pending.current) return;
    const s = session;
    const qs = s.review || s.lesson.questions;
    if (s.phase === "concept") {
      const end = s.index === s.lesson.concepts.length - 1;
      const next = {
        ...s,
        phase: end ? "question" : "concept",
        index: end ? 0 : s.index + 1,
      } as Session;
      if (
        await mutate({
          action: "resume",
          resume: {
            lessonId: s.lesson.id,
            phase: next.phase,
            index: next.index,
            answers: next.answers,
            runId: s.runId,
          },
        })
      ) {
        setSession(next);
        cleanQuestion();
      }
      return;
    }
    if (submitted === null) return;
    const answers = { ...s.answers, [qs[s.index].id]: submitted };
    if (s.index < qs.length - 1) {
      const next = { ...s, index: s.index + 1, answers };
      if (
        s.review ||
        (await mutate({
          action: "resume",
          resume: {
            lessonId: s.lesson.id,
            phase: "question",
            index: next.index,
            answers,
            runId: s.runId,
          },
        }))
      ) {
        setSession(next);
        cleanQuestion();
      }
    } else {
      let g;
      if (s.review) {
        const count = qs.filter((q) =>
          checkAnswer(q, answers[q.id] || ""),
        ).length;
        g = {
          score: Math.round((count / qs.length) * 100),
          correct: count,
          total: qs.length,
        };
      } else {
        g = gradeLesson(s.lesson, answers);
        if (
          !(await mutate({
            action: "finish",
            id: s.runId,
            lessonId: s.lesson.id,
            answers,
          }))
        )
          return;
      }
      setResult({ ...g, review: !!s.review });
      setSession(null);
      cleanQuestion();
    }
  }
  async function check() {
    if (!session || busy || submitted !== null) return;
    const q = (session.review || session.lesson.questions)[session.index];
    const answer =
      q.type === "order" ? order.map((i) => q.options[i]).join(" ") : choice;
    if (!answer) return;
    setSubmitted(answer);
    setSession({ ...session, answers: { ...session.answers, [q.id]: answer } });
    await mutate({
      action: "answer",
      id: session.runId + ":" + q.id,
      questionId: q.id,
      answer,
    });
  }
  function startReview(all = false) {
    const ids = (all ? review : due).map((r) => r.questionId);
    const qs = ids
      .map((id) => questions.find((q) => q.id === id))
      .filter(Boolean) as Question[];
    if (!qs.length) {
      setNotice(
        t(
          "今天没有到期错题，可以回顾全部错题。",
          "No review is due. You can review all mistakes.",
        ),
      );
      return;
    }
    setSession({
      lesson: lessons.find((l) => l.questions.some((q) => q.id === qs[0].id))!,
      phase: "question",
      index: 0,
      answers: {},
      runId: uid(),
      review: qs,
    });
    setResult(null);
    cleanQuestion();
    setTab("learn");
  }
  async function lookup() {
    const word = query.trim();
    if (!word) return;
    setWordBusy(true);
    setWordResult(null);
    setNotice("");
    try {
      const r = await fetch("/api/dictionary?word=" + encodeURIComponent(word));
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setWordResult(d);
    } catch (e) {
      setNotice(
        t(
          "没有查到这个词，或词典暂时不可用。你仍可以手动添加。",
          "Word not found, or the dictionary is busy. You can add it by hand.",
        ),
      );
    } finally {
      setWordBusy(false);
    }
  }
  async function saveWord(word: Partial<Word>) {
    if (!word.word?.trim()) return;
    if (
      await mutate({
        action: "word",
        word: {
          word: word.word.trim(),
          ipa: word.ipa || "",
          meaning: word.meaning || "",
          pos: word.pos || "",
          note: word.note || "",
        },
      })
    ) {
      setWordForm(null);
      setNotice(t("已加入你的单词册。", "Added to your word book."));
    }
  }
  function download(format: "json" | "md") {
    const body =
      format === "json"
        ? JSON.stringify(
            {
              app: "音记 Yinji",
              exportedAt: new Date().toISOString(),
              ...data,
            },
            null,
            2,
          )
        : [
            "# 音记 · 我的复习册",
            new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US"),
            "\n## My words / 我的单词",
            ...data.words.map(
              (w) =>
                `\n### ${w.word} ${w.ipa}\n${w.pos} · ${w.meaning}\n${w.note}`,
            ),
            "\n## Practice again / 错题复习",
            ...review.map((r) => {
              const q = questions.find((q) => q.id === r.questionId)!;
              return `\n### ${q.prompt[lang]}\n${q.text}\n我的答案 / My answer: ${r.lastAnswer}\n正确答案 / Answer: ${q.answer}\n${q.explanation[lang]}`;
            }),
          ].join("\n");
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([body], {
        type:
          format === "json"
            ? "application/json"
            : "text/markdown;charset=utf-8",
      }),
    );
    a.href = url;
    a.download = `yinji-review-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useEffect(() => {
    const mc = (document as any).modelContext;
    if (!mc?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: any) => {
      try {
        Promise.resolve(
          mc.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: "yinji_read_progress",
      title: "Read learning progress",
      description:
        "Read the signed-in learner’s lesson progress and review counts. No changes.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute(input: unknown) {
        if (!input || typeof input !== "object" || Object.keys(input).length)
          throw Error("No inputs expected");
        const d = stateRef.current;
        return {
          passedLessons: [
            ...new Set(d.runs.filter((r) => r.passed).map((r) => r.lessonId)),
          ],
          savedWords: d.words.length,
          dueMistakes: reviewItems(d.attempts).filter((r) => r.due).length,
        };
      },
    });
    register({
      name: "yinji_open_section",
      title: "Open a learning section",
      description:
        "Open Learn, Sounds, Words or Review. Does not complete a lesson or change saved data.",
      inputSchema: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: ["learn", "sounds", "words", "review"],
          },
        },
        required: ["section"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute(input: any) {
        if (
          !input ||
          Object.keys(input).length !== 1 ||
          !["learn", "sounds", "words", "review"].includes(input.section)
        )
          throw Error("Invalid section");
        setTab(input.section);
        return { section: input.section };
      },
    });
    return () => lifecycle.abort();
  }, []);
  const activeQuestion =
    session?.phase === "question"
      ? (session.review || session.lesson.questions)[session.index]
      : null;
  return (
    <>
      <div
        className={"app-shell " + (session ? "in-lesson" : "")}
        inert={!hydrated}
      >
        <header className="topbar">
          <a className="brand" href="/" aria-label="音记 Yinji">
            <span className="brand-mark">
              <AudioLines size={25} />
            </span>
            <strong>
              音记<span>YINJI</span>
            </strong>
          </a>
          <div
            className="game-stats"
            aria-label={t("冒险进度", "Your progress")}
          >
            <span title={t("学习日", "Study days")}>
              <Flame className="stat-flame" size={24} />
              <b>{studyDays(data.attempts)}</b>
              <small>{t("天", "days")}</small>
            </span>
            <span title={t("已通关", "Levels passed")}>
              <Star className="stat-star" size={25} fill="currentColor" />
              <b>{completed.size}</b>
              <small>{t("星", "stars")}</small>
            </span>
            <span className="word-stat" title={t("我的单词", "My words")}>
              <BookOpen className="stat-book" size={23} />
              <b>{data.words.length}</b>
            </span>
          </div>
          <div className="header-actions">
            <button
              ref={menuButton}
              className="mobile-menu-button"
              aria-label={t("打开菜单", "Open menu")}
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={24} />
            </button>
            <button
              className="lang-button"
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              aria-label={t("切换为英文", "Switch to Chinese")}
            >
              <Globe2 size={17} />
              {lang === "zh" ? "EN" : "中文"}
            </button>
            <a
              className="account-button"
              href={user ? signOutUrl : signInUrl}
              target="_top"
              title={
                user
                  ? t("退出账号", "Sign out")
                  : t("使用 ChatGPT 账号登录", "Sign in with ChatGPT")
              }
            >
              {user ? user.name.slice(0, 12) : t("登录同步", "Sign in")}
            </a>
          </div>
        </header>
        <Tabs
          className="workspace"
          value={tab}
          onValueChange={(v) => {
            stopAudio();
            setTab(v);
            setNotice("");
          }}
        >
          <TabsList className="main-nav">
            <TabsTrigger value="learn">
              <Star />
              {t("学习之路", "Learn")}
            </TabsTrigger>
            <TabsTrigger value="sounds">
              <AudioLines />
              {t("声音图鉴", "Sounds")}
            </TabsTrigger>
            <TabsTrigger value="words">
              <Library />
              {t("我的单词", "Words")}
            </TabsTrigger>
            <TabsTrigger value="review">
              <Headphones />
              {t("复习册", "Review")}
              {due.length > 0 && (
                <span className="count-badge">{due.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
          {error && (
            <div role="alert" className="error-banner">
              <span>{error}</span>
              <button
                onClick={() =>
                  pending.current ? void mutate(pending.current) : void load()
                }
                disabled={busy}
              >
                {t("重试", "Try again")}
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label={t("关闭提示", "Close message")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <TabsContent value="learn" className="view">
            {session ? (
              <section className="lesson-player">
                <div className="player-head">
                  <button
                    className="icon-button"
                    aria-label={t(
                      "退出本课，保留进度",
                      "Leave lesson and keep progress",
                    )}
                    disabled={busy || !!pending.current}
                    onClick={() => {
                      stopAudio();
                      setSession(null);
                      cleanQuestion();
                    }}
                  >
                    <X size={21} />
                  </button>
                  <div>
                    <span>
                      {session.review
                        ? t("错题重练", "Try again")
                        : session.lesson.title[lang]}
                    </span>
                    <Progress
                      value={
                        session.phase === "concept"
                          ? ((session.index + 1) /
                              (session.lesson.concepts.length +
                                session.lesson.questions.length)) *
                            100
                          : ((session.lesson.concepts.length +
                              session.index +
                              1) /
                              (session.lesson.concepts.length +
                                (session.review || session.lesson.questions)
                                  .length)) *
                            100
                      }
                    />
                  </div>
                  <span className="player-counter">
                    {session.phase === "concept"
                      ? t("讲解", "Learn")
                      : t("练习", "Practice")}{" "}
                    {session.index + 1}/
                    {session.phase === "concept"
                      ? session.lesson.concepts.length
                      : (session.review || session.lesson.questions).length}
                  </span>
                </div>
                <div className="player-body">
                  {session.phase === "concept"
                    ? (() => {
                        const c = session.lesson.concepts[session.index];
                        return (
                          <>
                            <span className="pill blue">
                              {t("先理解，再练习", "LEARN, THEN TRY")}
                            </span>
                            <h1>{c.title[lang]}</h1>
                            <p className="concept-body">{c.body[lang]}</p>
                            <div className="example-box">
                              <p lang="en">{c.example}</p>
                              <span>{lang === "zh" ? c.translation : ""}</span>
                              <AudioButton text={c.audioText} lang={lang} />
                              <AudioButton
                                text={c.audioText}
                                lang={lang}
                                slow
                              />
                            </div>
                            <p className="learning-tip">
                              <Sparkles size={17} />
                              {t(
                                "点慢速听清细节，再用正常速度跟读。",
                                "Listen slowly, then say it at normal speed.",
                              )}
                            </p>
                          </>
                        );
                      })()
                    : activeQuestion && (
                        <>
                          <div className="question-label">
                            <span className="pill blue">
                              {t(
                                {
                                  choice: "选一选",
                                  listen: "听一听",
                                  order: "排一排",
                                  speak: "说一说",
                                }[activeQuestion.type],
                                {
                                  choice: "CHOOSE",
                                  listen: "LISTEN",
                                  order: "BUILD",
                                  speak: "SPEAK",
                                }[activeQuestion.type],
                              )}
                            </span>
                            <button
                              className="text-button"
                              onClick={() => setHelp(!help)}
                            >
                              <HelpCircle size={16} />
                              {t("解释考点", "Help")}
                            </button>
                          </div>
                          <h1 className="question-title">
                            {activeQuestion.prompt[lang]}
                          </h1>
                          {activeQuestion.type === "listen" ? (
                            <div className="listen-center">
                              <AudioButton
                                text={
                                  activeQuestion.audioText ||
                                  activeQuestion.answer
                                }
                                lang={lang}
                                large
                              />
                              <AudioButton
                                text={
                                  activeQuestion.audioText ||
                                  activeQuestion.answer
                                }
                                lang={lang}
                                slow
                              />
                            </div>
                          ) : (
                            activeQuestion.text && (
                              <div className="question-text" lang="en">
                                {activeQuestion.text}
                                {activeQuestion.audioText &&
                                  activeQuestion.type !== "speak" && (
                                    <AudioButton
                                      text={activeQuestion.audioText}
                                      lang={lang}
                                    />
                                  )}
                              </div>
                            )
                          )}
                          {activeQuestion.type === "choice" ||
                          activeQuestion.type === "listen" ? (
                            <RadioGroup
                              className="answer-options"
                              value={choice}
                              onValueChange={setChoice}
                              disabled={submitted !== null}
                            >
                              {activeQuestion.options.map((option, i) => (
                                <label
                                  key={i}
                                  className={
                                    "answer-option " +
                                    (choice === option ? "selected " : "") +
                                    (submitted !== null
                                      ? checkAnswer(activeQuestion, option)
                                        ? "correct"
                                        : choice === option
                                          ? "incorrect"
                                          : ""
                                      : "")
                                  }
                                >
                                  <RadioGroupItem
                                    value={option}
                                    aria-label={option}
                                  />
                                  <span className="option-letter">
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  <span>{optionText(option)}</span>
                                  {submitted !== null &&
                                    checkAnswer(activeQuestion, option) && (
                                      <CheckCircle2 size={19} />
                                    )}
                                </label>
                              ))}
                            </RadioGroup>
                          ) : activeQuestion.type === "order" ? (
                            <div className="order-task">
                              <div
                                className="built-sentence"
                                aria-label={t("你的句子", "Your sentence")}
                              >
                                {order.length ? (
                                  order.map((i, j) => (
                                    <button
                                      disabled={submitted !== null}
                                      key={i}
                                      onClick={() =>
                                        setOrder(
                                          order.filter((_, k) => k !== j),
                                        )
                                      }
                                    >
                                      {activeQuestion.options[i]}
                                    </button>
                                  ))
                                ) : (
                                  <span>
                                    {submitted ||
                                      t(
                                        "按顺序点下面的词",
                                        "Tap the words in order",
                                      )}
                                  </span>
                                )}
                              </div>
                              <div className="word-tiles">
                                {activeQuestion.options.map((w, i) => (
                                  <button
                                    key={i}
                                    disabled={
                                      order.includes(i) || submitted !== null
                                    }
                                    onClick={() => setOrder([...order, i])}
                                  >
                                    {w}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <Recorder
                              key={activeQuestion.id}
                              target={
                                activeQuestion.target || activeQuestion.answer
                              }
                              lang={lang}
                              tips={activeQuestion.explanation}
                              signedIn={!!user}
                              onPractice={() => setSubmitted("__practice__")}
                            />
                          )}
                          {activeQuestion.type === "speak" &&
                            submitted === null && (
                              <button
                                className="text-button"
                                onClick={() => setSubmitted("__skipped__")}
                              >
                                {t(
                                  "稍后跟读（不计分）",
                                  "Speak later (not scored)",
                                )}
                              </button>
                            )}
                          {(help ||
                            (submitted !== null &&
                              activeQuestion.type !== "speak")) && (
                            <div
                              className={
                                "explanation " +
                                (submitted !== null
                                  ? checkAnswer(activeQuestion, submitted)
                                    ? "right"
                                    : "wrong"
                                  : "")
                              }
                              role={submitted !== null ? "status" : undefined}
                            >
                              <strong>
                                {submitted === null
                                  ? t("一起理解这个考点", "Let’s learn this")
                                  : checkAnswer(activeQuestion, submitted)
                                    ? t("答对了！", "You got it!")
                                    : t(
                                        "差一点，来看看为什么",
                                        "Not quite. Here is why.",
                                      )}
                              </strong>
                              {submitted !== null &&
                                !checkAnswer(activeQuestion, submitted) && (
                                  <p>
                                    {t("正确答案：", "Answer: ")}
                                    <b>{optionText(activeQuestion.answer)}</b>
                                  </p>
                                )}
                              <p>{activeQuestion.explanation[lang]}</p>
                              {submitted !== null &&
                                !checkAnswer(activeQuestion, submitted) && (
                                  <small>
                                    {t(
                                      "已加入错题册，之后会再见到它。",
                                      "Added to your review book. You will try it again.",
                                    )}
                                  </small>
                                )}
                            </div>
                          )}
                        </>
                      )}
                </div>
                <div className="player-footer">
                  <span>
                    {busy ? (
                      <>
                        <LoaderCircle size={15} className="spin" />
                        {t("正在保存", "Saving")}
                      </>
                    ) : user ? (
                      <>
                        <Cloud size={15} />
                        {t("进度自动同步", "Your progress is saved")}
                      </>
                    ) : (
                      t(
                        "访客体验 · 登录后保存进度",
                        "Guest mode · Sign in to save",
                      )
                    )}
                  </span>
                  {session.phase === "concept" ? (
                    <button
                      className="primary"
                      onClick={advance}
                      disabled={busy || !!pending.current}
                    >
                      {session.index === session.lesson.concepts.length - 1
                        ? t("开始练习", "Let’s practice")
                        : t("继续学习", "Keep learning")}
                    </button>
                  ) : submitted === null ? (
                    <button
                      className="primary"
                      onClick={check}
                      disabled={
                        busy ||
                        activeQuestion?.type === "speak" ||
                        (activeQuestion?.type === "order"
                          ? order.length !== activeQuestion.options.length
                          : !choice)
                      }
                    >
                      {activeQuestion?.type === "speak"
                        ? t("先录音并回听", "Record and listen first")
                        : t("检查答案", "Check answer")}
                    </button>
                  ) : (
                    <button
                      className="primary"
                      onClick={advance}
                      disabled={busy || !!pending.current}
                    >
                      {t("继续", "Continue")}
                    </button>
                  )}
                </div>
              </section>
            ) : result ? (
              <section className="result-panel">
                <span className="result-icon">
                  <Trophy size={43} />
                </span>
                <div className="result-celebration" aria-hidden="true">
                  <span>✦</span>
                  <img src="/sound-buddy.svg" alt="" />
                  <span>★</span>
                </div>
                <h1>
                  {result.score >= 80
                    ? t(
                        result.review ? "复习挑战完成！" : "闯关成功！",
                        result.review ? "Review complete!" : "Level complete!",
                      )
                    : t(
                        "找到薄弱点，就是进步。",
                        "Now you know what to try again.",
                      )}
                </h1>
                <div className="result-score">
                  {result.score}
                  <span>%</span>
                </div>
                <p>
                  {result.correct}/{result.total}{" "}
                  {t(
                    "道客观题正确 · 跟读不计分",
                    "correct · Speaking practice is not scored",
                  )}
                </p>
                <p className="muted">
                  {result.review
                    ? t(
                        "复习记录已更新，正确题会延长复习间隔。",
                        "Your review is updated. Correct answers get a longer gap.",
                      )
                    : result.score >= 80
                      ? t(
                          "已通过本课。保持节奏，继续下一课。",
                          "Lesson passed. Keep going at your own pace.",
                        )
                      : t(
                          "80% 为通过标准。先看解释，再试一次。",
                          "Pass with 80%. Read the tips and try again.",
                        )}
                </p>
                <div className="result-actions">
                  <button
                    className="primary"
                    onClick={() => {
                      setResult(null);
                      if (!result.review && result.score >= 80) {
                        if (lessonIndex < stage.lessons.length - 1)
                          setLessonIndex(lessonIndex + 1);
                        else if (stageIndex < stages.length - 1) {
                          setStageIndex(stageIndex + 1);
                          setLessonIndex(0);
                        }
                      }
                    }}
                  >
                    {t("回到学习路线", "Back to my path")}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setResult(null);
                      setTab("review");
                    }}
                  >
                    {t("看看错题册", "Open review book")}
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="journey-intro">
                  <h1>{t("你的声音冒险", "Your sound adventure")}</h1>
                  <span>{t("7 章 · 42 关", "7 CHAPTERS · 42 LEVELS")}</span>
                </div>
                {data.resume && (
                  <div className="resume-banner">
                    <span>
                      <Bookmark size={17} />
                      {t("上次学到：", "Last lesson: ")}
                      {
                        lessons.find((l) => l.id === data.resume!.lessonId)
                          ?.title[lang]
                      }
                    </span>
                    <button
                      onClick={() => {
                        const r = data.resume!;
                        const l = lessons.find((l) => l.id === r.lessonId);
                        if (l) void startLesson(l, r);
                      }}
                      disabled={busy}
                    >
                      {t("接着学", "Keep going")}
                    </button>
                  </div>
                )}
                <GamePath
                  stages={stages}
                  stageIndex={stageIndex}
                  lessonIndex={lessonIndex}
                  completed={completed}
                  available={available}
                  lang={lang}
                  busy={busy || !ready}
                  onStage={(index) => {
                    setStageIndex(index);
                    const next = stages[index].lessons.findIndex(
                      (l) => !completed.has(l.id),
                    );
                    setLessonIndex(Math.max(0, next));
                  }}
                  onLesson={setLessonIndex}
                  onStart={(lesson) => void startLesson(lesson)}
                />
              </>
            )}
          </TabsContent>
          <TabsContent className="view tool-view" value="sounds">
            <div className="page-heading">
              <div>
                <p className="eyebrow">A MAP OF SOUNDS</p>
                <h1>{t("每个声音，都有自己的位置。", "Meet every sound.")}</h1>
                <p>
                  {t(
                    "标准美式 · 点开看口型提示，听单音和例词。",
                    "American English. Open a sound to listen and learn.",
                  )}
                </p>
              </div>
              <span className="subtle-count">
                {sounds.length} {t("张声音卡", "sound cards")}
              </span>
            </div>
            <Tabs value={soundFilter} onValueChange={setSoundFilter}>
              <TabsList className="filter-tabs">
                {[
                  ["all", "全部", "All"],
                  ["vowel", "元音", "Vowels"],
                  ["diphthong", "双元音", "Two-part"],
                  ["consonant", "辅音", "Consonants"],
                  ["rhotic", "R 音元音", "R sounds"],
                ].map(([id, zh, en]) => (
                  <TabsTrigger key={id} value={id}>
                    {t(zh, en)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="sounds-grid">
              {sounds
                .filter((s) => soundFilter === "all" || s.group === soundFilter)
                .map((s) => (
                  <button
                    key={s.id}
                    className={"sound-tile " + s.group}
                    onClick={() => setSound(s)}
                  >
                    <span className="tile-ipa">
                      /{s.symbol.replace(/^\/+|\/+$/g, "")}/
                    </span>
                    <span>{s.examples[0].word}</span>
                    <small>{s.name[lang]}</small>
                    <VolumeIcon />
                  </button>
                ))}
            </div>
            <p className="small muted sound-note">
              {t(
                "这里使用一套实用的美式教学分类；弱读与 R 音单列。不同词典的符号和口音合并方式可能不同。AI 合成声音请结合例词对照学习。",
                "These are useful American sound groups. Dictionaries may use other signs. Learn AI sound examples together with real words.",
              )}
            </p>
          </TabsContent>
          <TabsContent className="view tool-view" value="words">
            <div className="page-heading">
              <div>
                <p className="eyebrow">WORDS WORTH KEEPING</p>
                <h1>
                  {t("把新单词，变成老朋友。", "Make new words feel familiar.")}
                </h1>
                <p>
                  {t(
                    "查读音、词义和词性，也留下你自己的理解。",
                    "Find a sound, a meaning, and a word job. Add your own note.",
                  )}
                </p>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  setWordForm({
                    word: query,
                    ipa: "",
                    meaning: "",
                    pos: "",
                    note: "",
                  })
                }
              >
                <Plus size={18} />
                {t("添加单词", "Add word")}
              </button>
            </div>
            <form
              className="search-form"
              onSubmit={(e) => {
                e.preventDefault();
                void lookup();
              }}
            >
              <Search size={20} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={50}
                placeholder={t(
                  "输入一个英文单词，比如 apple",
                  "Try a word, like apple",
                )}
                aria-label={t("查找英文单词", "Look up a word")}
              />
              <button className="primary" disabled={wordBusy || !query.trim()}>
                {wordBusy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  t("查一查", "Look up")
                )}
              </button>
            </form>
            {wordResult && (
              <article className="dictionary-card">
                <div className="word-heading">
                  <div>
                    <h2>{wordResult.word}</h2>
                    <span>{wordResult.ipa}</span>
                  </div>
                  <AudioButton text={wordResult.word} lang={lang} />
                  <button
                    className="secondary"
                    onClick={() =>
                      setWordForm({
                        word: wordResult.word,
                        ipa: wordResult.ipa,
                        meaning:
                          wordResult.meaning ||
                          wordResult.meanings?.[0]?.definitions?.[0]
                            ?.definition ||
                          "",
                        pos:
                          wordResult.meanings
                            ?.map((m: any) => m.pos)
                            .join(", ") || "",
                        note: "",
                      })
                    }
                  >
                    <Bookmark size={17} />
                    {t("存入单词册", "Save word")}
                  </button>
                </div>
                {wordResult.meaning && <p>{wordResult.meaning}</p>}
                {wordResult.meanings?.map((m: any, i: number) => (
                  <div className="definition" key={i}>
                    <span className="pill blue">{m.pos}</span>
                    {m.definitions.map((d: any, j: number) => (
                      <div key={j}>
                        <p>{d.definition}</p>
                        {d.example && <small>{d.example}</small>}
                      </div>
                    ))}
                  </div>
                ))}
                <p className="tiny-note">
                  {wordResult.source}
                  {wordResult.sourceUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={wordResult.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("查看原词条", "Source entry")}
                      </a>
                    </>
                  )}
                  {t(
                    " · 外部词典可能包含不同口音和较难词义，请结合语境。",
                    " · Sounds and meanings can change by place and context.",
                  )}
                </p>
              </article>
            )}
            <div className="section-heading">
              <h2>
                {t("我的单词册", "My word book")}{" "}
                <span>{data.words.length}</span>
              </h2>
              {data.words.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => {
                    setCardIndex(0);
                    setFlipped(false);
                    setTab("review");
                  }}
                >
                  <RotateCcw size={16} />
                  {t("翻卡复习", "Review cards")}
                </button>
              )}
            </div>
            {!data.words.length ? (
              <div className="empty">
                <Library size={32} />
                <h3>
                  {t(
                    "你的第一张单词卡，等你收藏。",
                    "Your first word card is waiting.",
                  )}
                </h3>
                <p>
                  {t(
                    "查一个词，或在声音图鉴里收藏例词。",
                    "Look up a word, or save one from Sounds.",
                  )}
                </p>
              </div>
            ) : (
              <div className="word-grid">
                {data.words.map((w) => (
                  <article className="word-card" key={w.id}>
                    <div className="word-heading">
                      <h3>{w.word}</h3>
                      <AudioButton text={w.word} lang={lang} label="" />
                    </div>
                    <p className="word-ipa">
                      {w.ipa} <span>{w.pos}</span>
                    </p>
                    <p>{w.meaning}</p>
                    {w.note && <small>{w.note}</small>}
                    <div className="word-card-foot">
                      <button
                        className="text-button"
                        onClick={() => setWordForm(w)}
                      >
                        {t("编辑笔记", "Edit note")}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={t("移除单词 ", "Remove word ") + w.word}
                        onClick={() => {
                          void mutate({ action: "removeWord", id: w.id });
                        }}
                        disabled={busy}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent className="view tool-view" value="review">
            <div className="page-heading">
              <div>
                <p className="eyebrow">YOUR LITTLE BOOK OF PROGRESS</p>
                <h1>
                  {t("再见一次，就记得更牢。", "Meet it again. Make it stick.")}
                </h1>
                <p>
                  {t(
                    "错题、单词和你的笔记，都在这一本里。",
                    "Your words, notes, and things to try again.",
                  )}
                </p>
              </div>
              <div className="export-actions">
                <button className="secondary" onClick={() => window.print()}>
                  <Printer size={17} />
                  {t("打印册子", "Print book")}
                </button>
                <button
                  className="icon-button"
                  title="Markdown"
                  aria-label={t(
                    "导出复习册 Markdown",
                    "Export review book Markdown",
                  )}
                  onClick={() => download("md")}
                >
                  <Download size={18} />
                </button>
                <button
                  className="text-button"
                  onClick={() => download("json")}
                >
                  JSON
                </button>
              </div>
            </div>
            <div className="review-summary">
              <div>
                <strong>{due.length}</strong>
                <span>{t("今天待复习", "Due today")}</span>
              </div>
              <div>
                <strong>{review.length}</strong>
                <span>{t("个易错考点", "Things to review")}</span>
              </div>
              <div>
                <strong>{data.words.length}</strong>
                <span>{t("个收藏单词", "Saved words")}</span>
              </div>
              <button
                className="primary"
                onClick={() => startReview()}
                disabled={!due.length || busy}
              >
                <RotateCcw size={18} />
                {t("开始错题重练", "Try mistakes again")}
              </button>
            </div>
            {data.words.length > 0 && (
              <div className="flashcard-section">
                <div className="section-heading">
                  <h2>{t("单词翻卡", "Word cards")}</h2>
                  <span>
                    {(cardIndex % data.words.length) + 1}/{data.words.length}
                  </span>
                </div>
                <button
                  className="flashcard"
                  onClick={() => setFlipped(!flipped)}
                >
                  <span className="pill blue">
                    {flipped
                      ? t("词义与笔记", "MEANING & NOTE")
                      : t("先想一想它的意思", "THINK OF THE MEANING")}
                  </span>
                  <strong>
                    {flipped
                      ? data.words[cardIndex % data.words.length].meaning
                      : data.words[cardIndex % data.words.length].word}
                  </strong>
                  <p>
                    {flipped
                      ? data.words[cardIndex % data.words.length].note
                      : data.words[cardIndex % data.words.length].ipa}
                  </p>
                  <small>{t("点一下翻面", "Tap to turn")}</small>
                </button>
                <div className="flash-actions">
                  <AudioButton
                    text={data.words[cardIndex % data.words.length].word}
                    lang={lang}
                  />
                  <button
                    className="secondary"
                    onClick={() => {
                      setCardIndex((cardIndex + 1) % data.words.length);
                      setFlipped(false);
                    }}
                  >
                    {t("下一个单词", "Next word")}
                  </button>
                </div>
              </div>
            )}
            <div className="section-heading">
              <h2>{t("错题与考点", "Mistakes & tips")}</h2>
              {review.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => startReview(true)}
                >
                  {t("全部再练一遍", "Try all again")}
                </button>
              )}
            </div>
            {review.length === 0 ? (
              <div className="empty">
                <CheckCircle2 size={32} />
                <h3>
                  {t(
                    "这里会收集你的易错点。",
                    "Your learning tips will live here.",
                  )}
                </h3>
                <p>
                  {t(
                    "先学一课。答错时，我们会解释原因，并安排下一次复习。",
                    "Try a lesson. Each mistake comes with help and another chance.",
                  )}
                </p>
              </div>
            ) : (
              <div className="mistakes-list">
                {review.map((r) => {
                  const q = questions.find((q) => q.id === r.questionId)!;
                  return (
                    <article key={r.questionId} className="mistake-card">
                      <div>
                        <span className={"pill " + (r.due ? "warm" : "green")}>
                          {r.due
                            ? t("待复习", "Ready to review")
                            : t(
                                `${new Date(r.dueAt).toLocaleDateString("zh-CN")} 再复习`,
                                `Review on ${new Date(r.dueAt).toLocaleDateString("en-US")}`,
                              )}
                        </span>
                        <small>
                          {t(
                            `错过 ${r.wrongCount} 次 · 连续答对 ${r.streak} 次`,
                            `${r.wrongCount} mistakes · ${r.streak} right in a row`,
                          )}
                        </small>
                      </div>
                      <h3>{q.prompt[lang]}</h3>
                      {q.text && <p lang="en">{q.text}</p>}
                      <p className="past-answer">
                        {t("上次错答：", "Last wrong answer: ")}
                        {r.lastAnswer}
                      </p>
                      <details>
                        <summary>
                          {t("看答案与解释", "See answer and tip")}
                        </summary>
                        <p>
                          <b>{q.answer}</b>
                        </p>
                        <p>{q.explanation[lang]}</p>
                        {q.audioText && (
                          <AudioButton text={q.audioText} lang={lang} />
                        )}
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
            <p className="small muted review-rule">
              {t(
                "错题答对后按 1、3、7、14、30 天安排复习；再答错会回到今天。单词翻卡用于自测，不自动计入掌握度。",
                "Review gaps grow to 1, 3, 7, 14 and 30 days. A mistake brings it back today. Word cards are for self-checks.",
              )}
            </p>
          </TabsContent>
        </Tabs>
        <footer className="app-footer">
          <span>音记 YINJI · {t("非商业学习项目", "NON-COMMERCIAL")}</span>
          <span>
            {user
              ? t("账号云端同步", "SAVED TO YOUR ACCOUNT")
              : t(
                  "访客进度仅保留在本次页面",
                  "GUEST PROGRESS LASTS FOR THIS VISIT",
                )}
          </span>
        </footer>
      </div>
      <Dialog open={mobileMenu} onOpenChange={setMobileMenu}>
        <DialogContent
          className="mobile-menu-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            menuButton.current?.focus();
          }}
        >
          <DialogTitle>{t("探索音记", "Explore Yinji")}</DialogTitle>
          <DialogDescription>
            {t(
              "选一个地方，继续你的声音冒险。",
              "Choose a place for your next step.",
            )}
          </DialogDescription>
          <div className="mobile-menu-items">
            {[
              { value: "learn", zh: "学习之路", en: "Learn", icon: Star },
              {
                value: "sounds",
                zh: "声音图鉴",
                en: "Sounds",
                icon: AudioLines,
              },
              { value: "words", zh: "我的单词", en: "Words", icon: Library },
              { value: "review", zh: "复习册", en: "Review", icon: Headphones },
            ].map((item) => (
              <button
                key={item.value}
                className={tab === item.value ? "active" : ""}
                onClick={() => {
                  stopAudio();
                  setTab(item.value);
                  setNotice("");
                  setMobileMenu(false);
                }}
              >
                <item.icon size={25} />
                {t(item.zh, item.en)}
                {item.value === "review" && due.length > 0 && (
                  <span className="count-badge">{due.length}</span>
                )}
              </button>
            ))}
          </div>
          <a
            className="menu-account"
            href={user ? signOutUrl : signInUrl}
            target="_top"
          >
            <Cloud size={20} />
            {user
              ? `${user.name} · ${t("退出账号", "Sign out")}`
              : t("登录，保存你的冒险进度", "Sign in and save your progress")}
          </a>
          <p className="small muted">
            {user
              ? t("进度随账号同步", "Your progress travels with you")
              : t(
                  "访客进度仅保留在本次页面",
                  "Guest progress lasts for this visit",
                )}
          </p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!sound}
        onOpenChange={(open) => {
          if (!open) {
            setSound(null);
            stopAudio();
          }
        }}
      >
        <DialogContent className="sound-dialog">
          <DialogTitle>
            {sound
              ? `/${sound.symbol.replace(/^\/+|\/+$/g, "")}/ · ${sound.name[lang]}`
              : ""}
          </DialogTitle>
          <DialogDescription>
            {t(
              "先听单音，再听它在单词里的样子。",
              "Hear the sound, then hear it in a word.",
            )}
          </DialogDescription>
          {sound && (
            <>
              <div className="sound-dialog-hero">
                <span className="ipa">
                  /{sound.symbol.replace(/^\/+|\/+$/g, "")}/
                </span>
                <PhonemeButton sound={sound} lang={lang} />
                <span className="pill blue">
                  {sound.voiced
                    ? t("声带振动", "Voiced")
                    : t("声带不振动", "Unvoiced")}
                </span>
              </div>
              <div className="pronunciation-tip">
                <strong>{t("嘴巴怎么做", "How to make it")}</strong>
                <p>{sound.tip[lang]}</p>
              </div>
              <div className="sound-examples">
                {sound.examples.map((w) => (
                  <div key={w.word}>
                    <div>
                      <strong>{w.word}</strong>
                      <span>
                        {w.ipa} {lang === "zh" && w.meaning}
                      </span>
                    </div>
                    <AudioButton text={w.word} lang={lang} />
                    <button
                      className="icon-button"
                      aria-label={t("收藏 ", "Save ") + w.word}
                      onClick={() => saveWord({ ...w, pos: "", note: "" })}
                      disabled={busy}
                    >
                      <Bookmark size={17} />
                    </button>
                  </div>
                ))}
              </div>
              {sound.contrast && (
                <p className="small muted">
                  {t("对比练习：", "Compare: ")}
                  {sound.contrast}
                </p>
              )}
              <details>
                <summary>{t("录音对照练习", "Record and compare")}</summary>
                <Recorder
                  target={sound.examples[0].word}
                  lang={lang}
                  tips={sound.tip}
                  signedIn={!!user}
                />
              </details>
              <p className="tiny-note">
                {t(
                  "AI 合成示范 · 请结合例词学习，不同美式口音可能略有不同。",
                  "AI voice examples. Learn with the words. American accents may vary.",
                )}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!wordForm}
        onOpenChange={(open) => {
          if (!open) setWordForm(null);
        }}
      >
        <DialogContent className="word-dialog">
          <DialogTitle>{t("留下一张单词卡", "Keep a word card")}</DialogTitle>
          <DialogDescription>
            {t(
              "词性取决于句中的用法。可以记下多个意思和例句。",
              "A word can do more than one job. Add a meaning and a note.",
            )}
          </DialogDescription>
          {pending.current && error && (
            <p className="error" role="alert">
              {t(
                "有一条学习记录尚未保存。请先关闭窗口并重试保存。",
                "A study record is not saved. Close this window and retry it first.",
              )}
            </p>
          )}
          {wordForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveWord(wordForm);
              }}
            >
              {[
                ["word", "单词", "Word", 80],
                ["ipa", "音标", "Sound signs", 120],
                ["pos", "词性（如 noun）", "Word job (like noun)", 60],
                ["meaning", "词义", "Meaning", 500],
              ].map(([key, zh, en, max]) => (
                <label className="field" key={key}>
                  <span>{t(String(zh), String(en))}</span>
                  <input
                    required={key === "word"}
                    value={(wordForm as any)[key] || ""}
                    maxLength={Number(max)}
                    onChange={(e) =>
                      setWordForm({ ...wordForm, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label className="field">
                <span>{t("我的笔记与例句", "My note and example")}</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={wordForm.note || ""}
                  onChange={(e) =>
                    setWordForm({ ...wordForm, note: e.target.value })
                  }
                />
              </label>
              <button
                className="primary"
                disabled={busy || !wordForm.word?.trim()}
              >
                {busy ? t("保存中", "Saving") : t("保存单词", "Save word")}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <section className="print-book">
        <h1>音记 · {t("我的复习册", "My review book")}</h1>
        <p>
          {new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}
        </p>
        <h2>{t("我的单词", "My words")}</h2>
        {data.words.map((w) => (
          <article key={w.id}>
            <h3>
              {w.word}{" "}
              <small>
                {w.ipa} · {w.pos}
              </small>
            </h3>
            <p>{w.meaning}</p>
            <p>{w.note}</p>
            <div className="writing-lines" />
          </article>
        ))}
        <h2>{t("错题重练", "Try again")}</h2>
        {review.map((r, i) => {
          const q = questions.find((q) => q.id === r.questionId)!;
          return (
            <article key={q.id}>
              <h3>
                {i + 1}. {q.prompt[lang]}
              </h3>
              <p>{q.text}</p>
              <p>{q.options.join(" / ")}</p>
              <div className="writing-lines" />
            </article>
          );
        })}
        <div className="print-answers">
          <h2>{t("答案与解释", "Answers & tips")}</h2>
          {review.map((r, i) => {
            const q = questions.find((q) => q.id === r.questionId)!;
            return (
              <article key={q.id}>
                <h3>
                  {i + 1}. {q.answer}
                </h3>
                <p>{q.explanation[lang]}</p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
function VolumeIcon() {
  return <Headphones size={16} />;
}
function PhonemeButton({ sound, lang }: { sound: Sound; lang: Lang }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  async function play() {
    setBusy(true);
    setMessage("");
    try {
      const m: any = await fetch("/audio/manifest.json").then((r) => r.json());
      const entry = m.phonemes?.[sound.id];
      if (!entry?.url) throw Error();
      audio.current?.pause();
      stopAudio();
      audio.current = new Audio(entry.url);
      await audio.current.play();
    } catch {
      setMessage(
        lang === "zh"
          ? "单音尚未就绪，请先听例词。"
          : "The sound is not ready. Listen to the words.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="audio-wrap">
      <button className="audio-button" onClick={play} disabled={busy}>
        <AudioLines size={18} />
        {lang === "zh" ? "听单音" : "Hear sound"}
      </button>
      {message && <small>{message}</small>}
    </span>
  );
}
