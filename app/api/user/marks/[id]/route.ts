import { requireAuthenticatedUser } from "@/lib/user/server";
import { patchToRow, rowsToMarks, validatePatchMark } from "@/lib/user/marks";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  let patch;
  try {
    patch = validatePatchMark(await request.json());
  } catch {
    return Response.json({ error: "invalid_mark" }, { status: 400 });
  }

  const { id } = await params;
  const { supabase, user } = auth.context;
  const { data, error } = await supabase
    .from("user_marks")
    .update(patchToRow(patch))
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return Response.json({ error: "mark_update_failed" }, { status: 500 });
  return Response.json({ mark: rowsToMarks([data])[0] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { supabase, user } = auth.context;
  const { error } = await supabase
    .from("user_marks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: "mark_delete_failed" }, { status: 500 });
  return Response.json({ ok: true });
}
