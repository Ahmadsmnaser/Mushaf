import {
  preferencesToRow,
  rowToPreferences,
  validatePreferencePatch,
} from "@/lib/user/preferences";
import { requireAuthenticatedUser } from "@/lib/user/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.context;
  const { data, error } = await supabase
    .from("user_preferences")
    .select("reader_theme,reciter_id,last_read_page,reading_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return Response.json({ error: "preferences_read_failed" }, { status: 500 });
  return Response.json({ preferences: rowToPreferences(data) });
}

export async function PATCH(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  let patch;
  try {
    patch = validatePreferencePatch(await request.json());
  } catch {
    return Response.json({ error: "invalid_preferences" }, { status: 400 });
  }

  const { supabase, user } = auth.context;
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        ...preferencesToRow(patch),
      },
      { onConflict: "user_id" }
    )
    .select("reader_theme,reciter_id,last_read_page,reading_mode")
    .single();

  if (error) return Response.json({ error: "preferences_update_failed" }, { status: 500 });
  return Response.json({ preferences: rowToPreferences(data) });
}
