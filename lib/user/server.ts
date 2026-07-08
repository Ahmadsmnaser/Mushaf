import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuthenticatedContext {
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;
  user: User;
}

export async function requireAuthenticatedUser(): Promise<
  | { ok: true; context: AuthenticatedContext }
  | { ok: false; response: Response }
> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      response: Response.json({ error: "auth_not_configured" }, { status: 503 }),
    };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  await supabase.from("profiles").upsert(
    {
      id: data.user.id,
      email: data.user.email ?? null,
      name:
        typeof data.user.user_metadata?.name === "string"
          ? data.user.user_metadata.name
          : typeof data.user.user_metadata?.full_name === "string"
            ? data.user.user_metadata.full_name
            : null,
      avatar_url:
        typeof data.user.user_metadata?.avatar_url === "string"
          ? data.user.user_metadata.avatar_url
          : typeof data.user.user_metadata?.picture === "string"
            ? data.user.user_metadata.picture
            : null,
      provider: "google",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  return { ok: true, context: { supabase, user: data.user } };
}
