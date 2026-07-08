"use client";

import { useAuthUser } from "@/lib/auth/useAuthUser";

export default function AccountButton({
  tone = "paper",
  compact = false,
}: {
  tone?: "paper" | "cover";
  compact?: boolean;
}) {
  const auth = useAuthUser();
  const cover = tone === "cover";
  const base =
    "pressable inline-flex items-center justify-center gap-2 rounded-full border text-sm transition-colors disabled:cursor-default disabled:opacity-60";
  const className = cover
    ? `${base} border-gold-soft/35 bg-gold-soft/10 px-4 py-2 text-paper hover:bg-gold-soft/20`
    : `${base} border-gold/25 bg-sheet/70 px-3 py-2 text-ink-soft hover:border-accent/40 hover:text-accent`;

  if (!auth.isConfigured) {
    return (
      <button className={className} disabled title="أضف إعدادات Supabase في ملف البيئة">
        تسجيل الدخول غير مهيأ
      </button>
    );
  }

  if (auth.isLoading) {
    return (
      <button className={className} disabled>
        جار التحقق...
      </button>
    );
  }

  if (!auth.user) {
    return (
      <button type="button" onClick={() => void auth.signInWithGoogle()} className={className}>
        تسجيل الدخول بواسطة Google
      </button>
    );
  }

  const name = auth.user.name ?? auth.user.email ?? "حسابك";

  return (
    <div className="flex min-w-0 items-center gap-2">
      {!compact && (
        <span className={cover ? "max-w-36 truncate text-sm text-paper/85" : "max-w-36 truncate text-sm text-ink"}>
          {name}
        </span>
      )}
      {auth.user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote OAuth avatar, decorative account chip.
        <img
          src={auth.user.avatarUrl}
          alt=""
          className="h-8 w-8 rounded-full border border-gold/30"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/30 bg-sheet/70 text-xs text-accent">
          {name.slice(0, 1)}
        </span>
      )}
      <button type="button" onClick={() => void auth.signOut()} className={className}>
        خروج
      </button>
    </div>
  );
}
