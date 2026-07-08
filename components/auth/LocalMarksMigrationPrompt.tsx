"use client";

import { useLocalMarksMigration } from "@/lib/useLocalMarksMigration";
import Modal from "@/components/chrome/Modal";

export default function LocalMarksMigrationPrompt() {
  const migration = useLocalMarksMigration();

  return (
    <Modal open={migration.open} onClose={migration.dismiss} title="استيراد العلامات" maxWidth="max-w-md">
      <div className="px-5 py-5">
        <p className="text-sm leading-7 text-ink">
          وجدنا علامات محفوظة على هذا الجهاز. يمكنك نقلها إلى حسابك لتبقى متزامنة بين أجهزتك.
        </p>
        {migration.status && <p className="mt-2 text-xs text-ink-soft">{migration.status}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={migration.dismiss}
            className="pressable rounded-full border border-gold/25 px-4 py-2 text-sm text-ink-soft hover:text-ink"
          >
            لاحقًا
          </button>
          <button
            type="button"
            disabled={migration.pending}
            onClick={() => void migration.importLocalMarks()}
            className="pressable rounded-full bg-accent px-4 py-2 text-sm text-paper disabled:cursor-default disabled:opacity-50"
          >
            {migration.pending ? "جار الاستيراد..." : "استيراد العلامات"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
