import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    questionId: text("question_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    answer: text("answer").notNull(),
    correct: integer("correct").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("attempts_user_time").on(t.userId, t.createdAt)],
);
export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    score: integer("score").notNull(),
    passed: integer("passed").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("runs_user").on(t.userId)],
);
export const words = sqliteTable(
  "words",
  {
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    word: text("word").notNull(),
    ipa: text("ipa").notNull(),
    meaning: text("meaning").notNull(),
    pos: text("pos").notNull(),
    note: text("note").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] })],
);
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  resume: text("resume"),
  updatedAt: integer("updated_at").notNull(),
});
