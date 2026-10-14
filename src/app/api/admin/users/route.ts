import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin, UserStatus } from "@/lib/auth";

export type AdminUser = {
  id: string;
  email: string;
  status: UserStatus;
  isAdmin: boolean;
  createdAt: string;
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const users = await sql<AdminUser[]>`
    select id, email, status, is_admin as "isAdmin", created_at as "createdAt"
    from users order by status = 'pending' desc, created_at
  `;
  return NextResponse.json({ users });
}
