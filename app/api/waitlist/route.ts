import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseIsConfigured } from "@/lib/supabase/env";

/**
 * Save the signed-in email on the waitlist. One row per account.
 * TODO(stripe): this button goes away once checkout can sell more calls.
 */
export async function POST() {
  if (!supabaseIsConfigured()) {
    return Response.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return Response.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const email = user.email?.trim();
  if (!email) {
    return Response.json({ error: "missing_email" }, { status: 400 });
  }

  const { error } = await supabase.from("waitlist").upsert({
    user_id: user.id,
    email,
  });

  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, email });
}
