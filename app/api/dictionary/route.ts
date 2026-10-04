import sounds from "@/content/sounds.json";
import coreWords from "@/content/core-words.json";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const word =
    new URL(req.url).searchParams.get("word")?.trim().toLowerCase() || "";
  if (!/^[a-z][a-z' -]{0,49}$/.test(word))
    return Response.json({ error: "Use one English word." }, { status: 400 });
  const core = coreWords.find((entry) => entry.word.toLowerCase() === word);
  if (core)
    return Response.json(
      { ...core, source: "音记基础词典 / Yinji word book" },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  const local = sounds
    .flatMap((s) => s.examples)
    .find((e) => e.word.toLowerCase() === word);
  try {
    const r = await fetch(
      "https://api.dictionaryapi.dev/api/v2/entries/en/" +
        encodeURIComponent(word),
      {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
        headers: { Accept: "application/json", "User-Agent": "Yinji/1.0" },
      },
    );
    if (!r.ok) {
      console.warn("Dictionary upstream status", r.status);
      if (local)
        return Response.json({
          word,
          ipa: local.ipa,
          meaning: local.meaning,
          meanings: [],
          source: "音记课程词汇",
        });
      return Response.json(
        {
          error:
            r.status === 404
              ? "Word not found. Check the spelling, or add it by hand."
              : "Dictionary is unavailable. Please try again.",
        },
        { status: r.status === 404 ? 404 : 503 },
      );
    }
    const data = (await r.json()) as any[];
    const item = data[0];
    return Response.json(
      {
        word: typeof item.word === "string" ? item.word : word,
        ipa:
          local?.ipa ||
          item.phonetics?.find(
            (p: any) => /[-/]us[-.]/i.test(p.audio || "") && p.text,
          )?.text ||
          item.phonetic ||
          item.phonetics?.find((p: any) => p.text)?.text ||
          "",
        meaning: local?.meaning || "",
        meanings: (item.meanings || []).slice(0, 4).map((m: any) => ({
          pos: m.partOfSpeech,
          definitions: (m.definitions || []).slice(0, 2).map((d: any) => ({
            definition: d.definition,
            example: d.example || "",
          })),
        })),
        source: "Free Dictionary API / Wiktionary",
        sourceUrl: Array.isArray(item.sourceUrls)
          ? item.sourceUrls.find(
              (url: unknown) =>
                typeof url === "string" &&
                url.startsWith("https://en.wiktionary.org/"),
            )
          : null,
      },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch {
    return Response.json(
      local
        ? { ...local, meanings: [], source: "音记课程词汇" }
        : {
            error:
              "Dictionary is unavailable. You can still add this word by hand.",
          },
      { status: local ? 200 : 503 },
    );
  }
}
