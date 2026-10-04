import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export function database() {
  if (!env.DB) throw new Error("Database unavailable");
  return env.DB;
}
export async function identity(request: Request) {
  const origin = request.headers.get("origin");
  if (
    request.method !== "GET" &&
    origin &&
    origin !== new URL(request.url).origin
  )
    throw new Error("Forbidden origin");
  const user = await getChatGPTUser();
  if (!user) throw new Error("Sign in required");
  return user.userId;
}
export function failure(e: unknown) {
  const message = e instanceof Error ? e.message : "Service unavailable";
  const status =
    message === "Sign in required"
      ? 401
      : message === "Forbidden origin"
        ? 403
        : message.startsWith("Invalid")
          ? 400
          : 503;
  console.error("Yinji request failed:", message);
  return Response.json(
    {
      error:
        status === 503
          ? "The service is unavailable. Please try again."
          : message,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function json(data: unknown) {
  return Response.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
