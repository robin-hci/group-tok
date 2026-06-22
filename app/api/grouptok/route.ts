const backendUrl =
  process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

async function proxy(path: string, init?: RequestInit) {
  try {
    const response = await fetch(`${backendUrl}${path}`, {
      ...init,
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          error:
            typeof data.detail === "string"
              ? data.detail
              : "GroupTok backend request failed.",
          backendUrl,
        },
        { status: response.status },
      );
    }

    return Response.json(data, { status: response.status });
  } catch {
    return Response.json(
      {
        error: "GroupTok backend is not running.",
        backendUrl,
      },
      { status: 503 },
    );
  }
}

export async function GET() {
  return proxy("/ops-state");
}

export async function POST() {
  return proxy("/run-pipeline", { method: "POST" });
}

export async function PATCH(request: Request) {
  return proxy("/ack-action", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await request.json()),
  });
}
