import { sanitizeBuyerSettings } from "@/lib/buyer-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseIsConfigured } from "@/lib/supabase/env";

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
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const settings = sanitizeBuyerSettings(body);
  const { error } = await supabase.from("buyer_settings").upsert({
    user_id: userData.user.id,
    personality: settings.personality,
    difficulty: settings.difficulty,
    practice_questions: settings.practiceQuestions,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, settings });
}
