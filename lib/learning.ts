export type Lang = "zh" | "en";
export type Text = { zh: string; en: string };
export type Question = {
  id: string;
  type: "choice" | "listen" | "order" | "speak";
  prompt: Text;
  text: string;
  options: string[];
  answer: string;
  explanation: Text;
  audioText?: string;
  target?: string;
};
export type Lesson = {
  id: string;
  title: Text;
  description: Text;
  duration: number;
  kind: string;
  concepts: {
    title: Text;
    body: Text;
    example: string;
    translation: string;
    audioText: string;
  }[];
  questions: Question[];
};
export type Stage = {
  id: string;
  title: Text;
  subtitle: Text;
  color: string;
  lessons: Lesson[];
};
export type Sound = {
  id: string;
  symbol: string;
  group: string;
  name: Text;
  tip: Text;
  examples: { word: string; ipa: string; meaning: string }[];
  contrast?: string;
  voiced: boolean;
  audioText: string;
};
export type Attempt = {
  id: string;
  questionId: string;
  lessonId: string;
  answer: string;
  correct: number;
  createdAt: number;
};
export type Word = {
  id: string;
  word: string;
  ipa: string;
  meaning: string;
  pos: string;
  note: string;
  createdAt: number;
};
export type Run = {
  id: string;
  lessonId: string;
  score: number;
  passed: number;
  createdAt: number;
};
export type Resume = {
  lessonId: string;
  phase: string;
  index: number;
  answers: Record<string, string>;
  runId: string;
} | null;
export type State = {
  attempts: Attempt[];
  words: Word[];
  runs: Run[];
  resume: Resume;
};
export const emptyState = (): State => ({
  attempts: [],
  words: [],
  runs: [],
  resume: null,
});
export const normalize = (text: string) =>
  text
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/[.!?]+$/, "");
export function checkAnswer(q: Question, answer: string) {
  return q.type === "speak" ? null : normalize(q.answer) === normalize(answer);
}
export function gradeLesson(lesson: Lesson, answers: Record<string, string>) {
  const qs = lesson.questions.filter((q) => q.type !== "speak");
  const correct = qs.filter(
    (q) => typeof answers[q.id] === "string" && checkAnswer(q, answers[q.id]),
  ).length;
  return {
    score: qs.length ? Math.round((correct / qs.length) * 100) : 0,
    correct,
    total: qs.length,
    complete: qs.every((q) => typeof answers[q.id] === "string"),
  };
}
export function reviewItems(attempts: Attempt[], now = Date.now()) {
  const map = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const list = map.get(a.questionId) || [];
    list.push(a);
    map.set(a.questionId, list);
  }
  return [...map]
    .flatMap(([questionId, list]) => {
      list.sort((a, b) => a.createdAt - b.createdAt);
      const wrong = list.filter((a) => !a.correct);
      if (!wrong.length) return [];
      let streak = 0;
      for (let i = list.length - 1; i >= 0 && list[i].correct; i--) streak++;
      const last = list[list.length - 1];
      const days = [0, 1, 3, 7, 14, 30][Math.min(streak, 5)];
      return [
        {
          questionId,
          lessonId: last.lessonId,
          wrongCount: wrong.length,
          lastAnswer: wrong[wrong.length - 1].answer,
          streak,
          dueAt: last.createdAt + days * 86400000,
          due: last.createdAt + days * 86400000 <= now,
        },
      ];
    })
    .sort((a, b) => a.dueAt - b.dueAt);
}
export function studyDays(attempts: Attempt[]) {
  return new Set(
    attempts.map((a) =>
      new Date(a.createdAt).toLocaleDateString("en-CA", {
        timeZone: "Asia/Shanghai",
      }),
    ),
  ).size;
}
