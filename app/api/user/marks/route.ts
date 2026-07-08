import { requireAuthenticatedUser } from "@/lib/user/server";
import { markToRow, rowsToMarks, validateCreateMark } from "@/lib/user/marks";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.context;
  const { data, error } = await supabase
    .from("user_marks")
    .select("*")
    .eq("user_id", user.id)
    .order("page_number", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) return Response.json({ error: "marks_read_failed" }, { status: 500 });
  return Response.json({ marks: rowsToMarks(data) });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  let mark;
  try {
    mark = validateCreateMark(await request.json());
  } catch {
    return Response.json({ error: "invalid_mark" }, { status: 400 });
  }

  const { supabase, user } = auth.context;
  const { data, error } = await supabase
    .from("user_marks")
    .insert(markToRow(mark, user.id))
    .select("*")
    .single();

  if (error) return Response.json({ error: "mark_create_failed" }, { status: 500 });
  return Response.json({ mark: rowsToMarks([data])[0] }, { status: 201 });
}
