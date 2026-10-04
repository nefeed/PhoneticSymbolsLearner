import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Stage } from "../lib/learning";
const curriculum = JSON.parse(
  readFileSync(new URL("../content/curriculum.json", import.meta.url), "utf8"),
) as { stages: Stage[] };
const lesson = curriculum.stages[0].lessons[0];
async function startQuiz(page: Page) {
  await page
    .getByRole("button", { name: /开始这一课|再练习一次/, exact: true })
    .click();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "继续学习", exact: true }).click();
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
}
test("guest can finish a lesson, understand mistakes, review and switch language", async ({
  page,
}) => {
  await page.goto("/");
  await startQuiz(page);
  for (const [i, q] of lesson.questions.entries()) {
    if (q.type === "speak")
      await page.getByRole("button", { name: "稍后跟读（不计分）" }).click();
    else {
      await page
        .getByRole("radio", {
          name: i === 0 ? q.options[0] : q.answer,
          exact: true,
        })
        .check();
      await page.getByRole("button", { name: "检查答案", exact: true }).click();
      await expect(page.locator(".explanation")).toBeVisible();
    }
    await page.getByRole("button", { name: "继续", exact: true }).click();
  }
  await expect(page.locator(".result-score")).toHaveText("80%");
  await page.getByRole("button", { name: "看看错题册" }).click();
  await expect(page.locator(".mistake-card")).toHaveCount(1);
  await page.getByRole("button", { name: "开始错题重练" }).click();
  await page.getByRole("radio", { name: "3", exact: true }).check();
  await page.getByRole("button", { name: "检查答案", exact: true }).click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(page.locator(".result-score")).toHaveText("100%");
  await page.getByRole("button", { name: "切换为英文" }).click();
  await expect(
    page.getByRole("tab", { name: "Sounds", exact: true }),
  ).toBeVisible();
});
test("sound cards have real audio and words can be saved, edited and exported", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "声音图鉴" }).click();
  await expect(page.locator(".sound-tile")).toHaveCount(41);
  await page.locator(".sound-tile").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const response = page.waitForResponse(
    (r) => r.url().includes("/audio/") && r.url().endsWith(".mp3"),
  );
  await page.getByRole("button", { name: "听单音", exact: true }).click();
  const audioResponse = await response;
  expect([200, 206]).toContain(audioResponse.status());
  expect(audioResponse.headers()["content-type"]).toContain("audio/");
  await page
    .getByRole("button", { name: /^收藏 / })
    .first()
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("tab", { name: "我的单词" }).click();
  await expect(page.locator(".word-card")).toHaveCount(1);
  await page.getByRole("button", { name: "编辑笔记", exact: true }).click();
  await page.getByLabel("我的笔记与例句").fill("My own example. 我的例句。");
  await page.getByRole("button", { name: "保存单词", exact: true }).click();
  await expect(page.locator(".word-card")).toContainText("My own example.");
  await page.getByRole("tab", { name: "复习册" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/yinji-review.*json/);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-book")).toBeVisible();
  await expect(page.locator(".app-shell")).toBeHidden();
});
test("iPhone, iPad and unfolded phone layouts keep lesson controls in the viewport", async ({
  page,
}, info) => {
  for (const [name, width, height] of [
    ["iphone16pro", 402, 874],
    ["ipad-portrait", 820, 1180],
    ["ipad-landscape", 1180, 820],
    ["fold-inner", 792, 900],
    ["small-phone", 360, 740],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /开始这一课|再练习一次/, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: /开始这一课|再练习一次/, exact: true })
      .click();
    const button = page.getByRole("button", { name: "继续学习", exact: true });
    const rect = await button.boundingBox();
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(height);
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({ path: `outputs/${info.project.name}-${name}.png` });
  }
});
test("cloud progress survives a new browser context and a resumed answered question", async ({
  page,
  browser,
}) => {
  await page.goto("/signin-with-chatgpt?return_to=/");
  await expect(
    page.getByRole("link", { name: "Seedy", exact: true }),
  ).toBeVisible();
  await startQuiz(page);
  await page.getByRole("radio", { name: "3", exact: true }).check();
  await page.getByRole("button", { name: "检查答案", exact: true }).click();
  await expect(page.locator(".player-footer")).not.toContainText("正在保存");
  await expect
    .poll(async () => {
      const state = await page.request.get("/api/state");
      return (await state.json()).resume?.answers[lesson.questions[0].id];
    })
    .toBe("3");
  const storage = await page.context().storageState();
  const second = await browser.newContext({
    storageState: storage,
    viewport: { width: 402, height: 874 },
  });
  const other = await second.newPage();
  await other.goto("http://127.0.0.1:5173/");
  await other.getByRole("button", { name: "接着学", exact: true }).click();
  await expect(other.locator(".explanation")).toContainText("答对了");
  await other.getByRole("button", { name: "继续", exact: true }).click();
  await expect(
    other.getByRole("heading", { name: lesson.questions[1].prompt.zh }),
  ).toBeVisible();
  await second.close();
});
test("failed writes remain retryable even if another feature tries to save", async ({
  page,
}) => {
  await page.goto("/signin-with-chatgpt?return_to=/");
  await startQuiz(page);
  let fail = true;
  await page.route("**/api/state", async (route) => {
    if (
      fail &&
      route.request().method() === "POST" &&
      route.request().postDataJSON()?.action === "answer"
    )
      return route.fulfill({
        status: 503,
        json: { error: "Temporary save error" },
      });
    return route.continue();
  });
  await page.getByRole("radio", { name: "3", exact: true }).check();
  await page.getByRole("button", { name: "检查答案", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("尚未保存");
  await page.getByRole("tab", { name: "我的单词" }).click();
  await page.getByRole("button", { name: "添加单词", exact: true }).click();
  await page.getByLabel("单词", { exact: true }).fill("test");
  await page.getByRole("button", { name: "保存单词", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("尚未保存");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  fail = false;
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("tab", { name: "学习之路" }).click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: lesson.questions[1].prompt.zh }),
  ).toBeVisible();
});
test("API rejects anonymous reads, cross-origin writes and unrecorded scores", async ({
  request,
  page,
}) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  await page.goto("/signin-with-chatgpt?return_to=/");
  const badOrigin = await page.request.post("/api/state", {
    headers: { Origin: "https://bad.example" },
    data: { action: "word", word: { word: "bad" } },
  });
  expect(badOrigin.status()).toBe(403);
  const answer = Object.fromEntries(
    lesson.questions
      .filter((q) => q.type !== "speak")
      .map((q) => [q.id, q.answer]),
  );
  const skipped = await page.request.post("/api/state", {
    data: {
      action: "finish",
      id: crypto.randomUUID(),
      lessonId: lesson.id,
      answers: answer,
    },
  });
  expect(skipped.status()).toBe(400);
});
test("finishing one run does not erase another device’s active lesson", async ({
  page,
}) => {
  await page.goto("/signin-with-chatgpt?return_to=/");
  const run = crypto.randomUUID(),
    other = crypto.randomUUID();
  const answers: Record<string, string> = {};
  for (const q of lesson.questions.filter((q) => q.type !== "speak")) {
    answers[q.id] = q.answer;
    const r = await page.request.post("/api/state", {
      data: {
        action: "answer",
        id: run + ":" + q.id,
        questionId: q.id,
        answer: q.answer,
      },
    });
    expect(r.ok()).toBe(true);
  }
  await page.request.post("/api/state", {
    data: {
      action: "resume",
      resume: {
        lessonId: curriculum.stages[0].lessons[1].id,
        phase: "concept",
        index: 2,
        answers: {},
        runId: other,
      },
    },
  });
  const finish = await page.request.post("/api/state", {
    data: { action: "finish", id: run, lessonId: lesson.id, answers },
  });
  expect(finish.ok()).toBe(true);
  expect((await finish.json()).resume.runId).toBe(other);
});

test("a microphone grant arriving after leaving the dialog is stopped without recording", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.__mic = { requests: 0, constructed: 0, track: null, grant: null };
    const NativeRecorder = window.MediaRecorder;
    if (!NativeRecorder) return;
    (window as any).MediaRecorder = class extends NativeRecorder {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        w.__mic.constructed++;
        super(stream, options);
      }
    };
    Object.defineProperty(
      Object.getPrototypeOf(navigator.mediaDevices),
      "getUserMedia",
      {
        configurable: true,
        value: async () => {
          w.__mic.requests++;
          const track = {
            readyState: "live",
            stop() {
              this.readyState = "ended";
            },
          };
          const stream = { getTracks: () => [track] } as unknown as MediaStream;
          w.__mic.track = track;
          return new Promise<MediaStream>((resolve) => {
            w.__mic.grant = () => resolve(stream);
          });
        },
      },
    );
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "声音图鉴" }).click();
  await page.locator(".sound-tile").first().click();
  await page.getByText("录音对照练习", { exact: true }).click();
  await page.getByRole("button", { name: "开始录音", exact: true }).click();
  if (
    !(await page.evaluate(() =>
      Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia),
    ))
  ) {
    await expect(page.locator(".recorder .error")).toContainText(
      "暂不支持录音",
    );
    return;
  }
  await expect(
    page.getByRole("button", { name: "开始录音", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() => (window as any).__mic.grant());
  await expect
    .poll(() => page.evaluate(() => (window as any).__mic.track.readyState))
    .toBe("ended");
  expect(await page.evaluate(() => (window as any).__mic.requests)).toBe(1);
  expect(await page.evaluate(() => (window as any).__mic.constructed)).toBe(0);
});

test("core dictionary gives a simple meaning, word job, and a saved card without external service", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "我的单词" }).click();
  await page.getByRole("textbox", { name: "查找英文单词" }).fill("apple");
  await page.getByRole("button", { name: "查一查", exact: true }).click();
  await expect(page.locator(".dictionary-card")).toContainText("苹果");
  await expect(page.locator(".dictionary-card")).toContainText("noun");
  await page.getByRole("button", { name: "存入单词册" }).click();
  await page.getByRole("button", { name: "保存单词", exact: true }).click();
  await expect(page.locator(".word-card")).toContainText("apple");
});

test("a resumed word-order exercise supports undo and checks the full sentence", async ({ page }) => {
  const orderLesson = curriculum.stages[2].lessons[2];
  const index = orderLesson.questions.findIndex(q => q.type === "order");
  const question = orderLesson.questions[index];
  await page.goto("/signin-with-chatgpt?return_to=/");
  const saved = await page.request.post("/api/state", { data: {
    action: "resume", resume: { lessonId: orderLesson.id, phase: "question", index,
      answers: {}, runId: crypto.randomUUID() }
  }});
  expect(saved.ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "接着学", exact: true }).click();
  await page.locator(".word-tiles").getByRole("button", { name: "song.", exact: true }).click();
  await page.locator(".built-sentence").getByRole("button", { name: "song.", exact: true }).click();
  for (const word of question.answer.split(" ")) {
    await page.locator(".word-tiles").getByRole("button", { name: word, exact: true }).click();
  }
  await page.getByRole("button", { name: "检查答案", exact: true }).click();
  await expect(page.locator(".explanation")).toContainText("答对了");
});
