import { isQuranMark, sortMarks, type QuranMark } from "@/lib/marks";
import {
  markToRow,
  rowsToMarks,
  semanticMarkKey,
  validateCreateMark,
} from "@/lib/user/marks";
import { requireAuthenticatedUser } from "@/lib/user/server";

export const dynamic = "force-dynamic";

function parseMarks(input: unknown): QuranMark[] {
  if (
    typeof input !== "object" ||
    input === null ||
    !Array.isArray((input as { marks?: unknown }).marks)
  ) {
    throw new Error("invalid_body");
  }
  const marks = (input as { marks: unknown[] }).marks;
  if (!marks.every(isQuranMark)) throw new Error("invalid_marks");
  return sortMarks(marks).map((mark) => validateCreateMark(mark));
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  let localMarks;
  try {
    localMarks = parseMarks(await request.json());
  } catch {
    return Response.json({ error: "invalid_marks" }, { status: 400 });
  }

  const { supabase, user } = auth.context;
  const { data: currentRows, error: readError } = await supabase
    .from("user_marks")
    .select("*")
    .eq("user_id", user.id);

  if (readError) return Response.json({ error: "migration_read_failed" }, { status: 500 });

  const currentMarks = rowsToMarks(currentRows);
  const currentIds = new Set(currentMarks.map((mark) => mark.id));
  const currentKeys = new Set(currentMarks.map(semanticMarkKey));
  const rows = [];
  let skipped = 0;

  for (const mark of localMarks) {
    if (currentIds.has(mark.id) || currentKeys.has(semanticMarkKey(mark))) {
      skipped++;
      continue;
    }
    currentIds.add(mark.id);
    currentKeys.add(semanticMarkKey(mark));
    rows.push(markToRow(mark, user.id));
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("user_marks").insert(rows);
    if (error) return Response.json({ error: "migration_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, added: rows.length, updated: 0, skipped });
}
