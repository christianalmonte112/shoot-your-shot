import { normalizePhone } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseIsConfigured } from "@/lib/supabase/env";

/** Save the signed-in user's phone without starting a call. */
export async function POST(request: Request) {
  if (!supabaseIsConfigured()) {
    return Response.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return Response.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "missing_phone" }, { status: 400 });
  }

  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).phone : "";
  const phone = normalizePhone(typeof raw === "string" ? raw : "");
  if (!phone) {
    return Response.json({ error: "missing_phone" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").upsert({
    user_id: userData.user.id,
    phone,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, phone });
}
