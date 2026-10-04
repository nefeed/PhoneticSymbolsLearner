import curriculum from "@/content/curriculum.json";
import { database, identity, failure, json } from "@/lib/server";
import { checkAnswer, gradeLesson, type Stage } from "@/lib/learning";
const stages = curriculum.stages as Stage[];
const lessons = stages.flatMap((s) => s.lessons);
const lessonById = new Map(lessons.map((l) => [l.id, l]));
const questionById = new Map(
  lessons.flatMap((l) =>
    l.questions.map((q) => [q.id, { q, lesson: l }] as const),
  ),
);
function text(value: unknown, max = 500) {
  if (typeof value !== "string" || value.length > max)
    throw new Error("Invalid text");
  return value;
}
function id(value: unknown) {
  const s = text(value, 100);
  if (!/^[a-zA-Z0-9_.:-]+$/.test(s)) throw new Error("Invalid id");
  return s;
}
async function read(user: string) {
  const db = database();
  const [attempts, runs, words, resume] = await Promise.all([
    db
      .prepare(
        "SELECT id, question_id AS questionId, lesson_id AS lessonId, answer, correct, created_at AS createdAt FROM attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 10000",
      )
      .bind(user)
      .all(),
    db
      .prepare(
        "SELECT id, lesson_id AS lessonId, score, passed, created_at AS createdAt FROM runs WHERE user_id = ? ORDER BY created_at DESC",
      )
      .bind(user)
      .all(),
    db
      .prepare(
        "SELECT id, word, ipa, meaning, pos, note, created_at AS createdAt FROM words WHERE user_id = ? ORDER BY created_at DESC",
      )
      .bind(user)
      .all(),
    db
      .prepare("SELECT resume FROM profiles WHERE user_id = ?")
      .bind(user)
      .first<{ resume: string | null }>(),
  ]);
  return {
    attempts: attempts.results,
    runs: runs.results,
    words: words.results,
    resume: resume?.resume ? JSON.parse(resume.resume) : null,
  };
}
export async function GET(req: Request) {
  try {
    return json(await read(await identity(req)));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = await identity(req);
    if (Number(req.headers.get("content-length")) > 30000)
      throw new Error("Invalid payload size");
    const raw = await req.text();
    if (raw.length > 30000) throw new Error("Invalid payload size");
    const b = JSON.parse(raw);
    const db = database(),
      now = Date.now();
    if (b.action === "answer") {
      const found = questionById.get(id(b.questionId));
      if (!found || found.q.type === "speak")
        throw new Error("Invalid question");
      const answer = text(b.answer);
      const result = checkAnswer(found.q, answer);
      const attemptId = id(b.id);
      const existing = await db
        .prepare("SELECT answer FROM attempts WHERE user_id = ? AND id = ?")
        .bind(user, attemptId)
        .first<{ answer: string }>();
      if (existing && existing.answer !== answer)
        throw new Error("Invalid changed answer; start a new lesson attempt");
      await db.batch([
        db
          .prepare(
            "INSERT OR IGNORE INTO attempts (id,user_id,question_id,lesson_id,answer,correct,created_at) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(
            attemptId,
            user,
            found.q.id,
            found.lesson.id,
            answer,
            result ? 1 : 0,
            now,
          ),
        db
          .prepare(
            "UPDATE profiles SET resume=json_set(resume, ?, ?), updated_at=? WHERE user_id=? AND json_extract(resume, '$.lessonId')=? AND json_extract(resume, '$.runId')=?",
          )
          .bind(
            "$.answers." + found.q.id,
            answer,
            now,
            user,
            found.lesson.id,
            attemptId.split(":")[0],
          ),
      ]);
    } else if (b.action === "finish") {
      const lesson = lessonById.get(id(b.lessonId));
      if (
        !lesson ||
        !b.answers ||
        typeof b.answers !== "object" ||
        Array.isArray(b.answers)
      )
        throw new Error("Invalid lesson");
      const answers: Record<string, string> = {};
      for (const q of lesson.questions) {
        if (b.answers[q.id] !== undefined)
          answers[q.id] = text(b.answers[q.id]);
      }
      const result = gradeLesson(lesson, answers);
      if (!result.complete) throw new Error("Invalid incomplete assessment");
      // Only recorded answers count; a client cannot skip every question and submit a score.
      const stored = await db
        .prepare(
          "SELECT question_id AS questionId, answer FROM attempts WHERE user_id = ? AND id LIKE ?",
        )
        .bind(user, id(b.id) + ":%")
        .all<{ questionId: string; answer: string }>();
      for (const q of lesson.questions.filter((q) => q.type !== "speak"))
        if (
          !stored.results.some(
            (a) => a.questionId === q.id && a.answer === answers[q.id],
          )
        )
          throw new Error("Invalid unrecorded answer");
      await db.batch([
        db
          .prepare(
            "INSERT OR IGNORE INTO runs (id,user_id,lesson_id,score,passed,created_at) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            id(b.id),
            user,
            lesson.id,
            result.score,
            result.score >= 80 ? 1 : 0,
            now,
          ),
        db
          .prepare(
            "UPDATE profiles SET resume=NULL,updated_at=? WHERE user_id=? AND json_extract(resume, '$.runId')=?",
          )
          .bind(now, user, id(b.id)),
      ]);
    } else if (b.action === "resume") {
      let value: string | null = null;
      if (b.resume) {
        const r = b.resume;
        const l = lessonById.get(id(r.lessonId));
        if (
          !l ||
          !["concept", "question"].includes(r.phase) ||
          !Number.isInteger(r.index) ||
          r.index < 0 ||
          r.index >=
            (r.phase === "concept" ? l.concepts.length : l.questions.length)
        )
          throw new Error("Invalid resume");
        const answers: Record<string, string> = {};
        for (const q of l.questions) {
          if (r.answers?.[q.id] !== undefined)
            answers[q.id] = text(r.answers[q.id]);
        }
        value = JSON.stringify({
          lessonId: l.id,
          phase: r.phase,
          index: r.index,
          answers,
          runId: id(r.runId),
        });
      }
      await db
        .prepare(
          "INSERT INTO profiles (user_id,resume,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET resume=excluded.resume,updated_at=excluded.updated_at",
        )
        .bind(user, value, now)
        .run();
    } else if (b.action === "word") {
      const w = b.word;
      if (!w || !text(w.word, 80).trim()) throw new Error("Invalid word");
      const wid = text(w.word, 80).trim().toLowerCase();
      await db
        .prepare(
          "INSERT INTO words (id,user_id,word,ipa,meaning,pos,note,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET ipa=excluded.ipa,meaning=excluded.meaning,pos=excluded.pos,note=excluded.note",
        )
        .bind(
          wid,
          user,
          text(w.word, 80).trim(),
          text(w.ipa || "", 120),
          text(w.meaning || "", 500),
          text(w.pos || "", 60),
          text(w.note || "", 1000),
          now,
        )
        .run();
    } else if (b.action === "removeWord") {
      await db
        .prepare("DELETE FROM words WHERE user_id = ? AND id = ?")
        .bind(user, text(b.id, 80))
        .run();
    } else throw new Error("Invalid action");
    return json(await read(user));
  } catch (e) {
    if (e instanceof SyntaxError) return failure(new Error("Invalid JSON"));
    return failure(e);
  }
}
