import { NextResponse } from "next/server";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const url = payload?.url;

    if (!url) {
      return jsonResponse({ error: "URL is required" }, 400);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!response.ok) {
      return jsonResponse(
        { error: `Failed to fetch URL: ${response.statusText}` },
        response.status
      );
    }

    const html = await response.text();
    return jsonResponse({ html });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
}
