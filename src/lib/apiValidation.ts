import { NextResponse } from "next/server";
import { z } from "zod";

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

// Reads and validates a JSON request body against a Zod schema. On failure it
// hands back a ready-to-return 400 response so route handlers stay a flat
// `if (!parsed.ok) return parsed.response`.
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid request.", details: z.treeifyError(result.error) },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}
