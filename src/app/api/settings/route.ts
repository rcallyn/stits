import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Category } from "@/lib/categories";
import { parseBody } from "@/lib/apiValidation";
import { settingsPatchSchema } from "@/lib/schemas";

type SettingsRow = {
  category_colors: Partial<Record<Category, string>>;
  category_labels: Partial<Record<Category, string>>;
  category_order: Category[];
  canvas_feed_url: string | null;
  canvas_last_synced_at: string | null;
};

export type SettingsPayload = {
  categoryColors: Partial<Record<Category, string>>;
  categoryLabels: Partial<Record<Category, string>>;
  categoryOrder: Category[];
  canvasFeedUrl: string;
  canvasLastSyncedAt?: string;
};

function rowToSettings(row: SettingsRow): SettingsPayload {
  return {
    categoryColors: row.category_colors ?? {},
    categoryLabels: row.category_labels ?? {},
    categoryOrder: row.category_order ?? [],
    canvasFeedUrl: row.canvas_feed_url ?? "",
    canvasLastSyncedAt: row.canvas_last_synced_at ?? undefined,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;
  // Signup creates the row; the upsert covers accounts made some other way.
  const [row] = await sql<SettingsRow[]>`
    insert into settings (user_id) values (${userId})
    on conflict (user_id) do update set user_id = excluded.user_id
    returning *
  `;
  return NextResponse.json(rowToSettings(row));
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;
  const parsed = await parseBody(req, settingsPatchSchema);
  if (!parsed.ok) return parsed.response;
  const changes = parsed.data;

  const fields: Record<string, unknown> = {};
  if ("categoryColors" in changes) fields.category_colors = sql.json(changes.categoryColors ?? {});
  if ("categoryLabels" in changes) fields.category_labels = sql.json(changes.categoryLabels ?? {});
  if ("categoryOrder" in changes) fields.category_order = sql.json(changes.categoryOrder ?? []);
  if ("canvasFeedUrl" in changes) fields.canvas_feed_url = changes.canvasFeedUrl ?? null;
  if ("canvasLastSyncedAt" in changes) {
    fields.canvas_last_synced_at = changes.canvasLastSyncedAt ?? null;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No changes." }, { status: 400 });
  }

  const [row] = await sql<SettingsRow[]>`
    insert into settings ${sql({ user_id: userId, ...fields })}
    on conflict (user_id) do update set ${sql(fields)}
    returning *
  `;
  return NextResponse.json(rowToSettings(row));
}
