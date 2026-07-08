"use client";

import { useAuthUser } from "@/lib/auth/useAuthUser";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const picked = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [name];
  return picked
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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
  const secondary =
    auth.user.email && auth.user.email !== name ? auth.user.email : "تسجيل الدخول نشط";

  if (compact) {
    return (
      <div className="account-card flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3">
        <span className="account-avatar-frame flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          {auth.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote OAuth avatar, decorative account chip.
            <img
              src={auth.user.avatarUrl}
              alt=""
              className="h-full w-full rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="account-avatar-fallback flex h-full w-full items-center justify-center rounded-full text-xs font-medium">
              {initialsFor(name)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 text-start">
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          <span className="block truncate text-[11px] text-ink-soft">{secondary}</span>
        </span>
        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="account-signout pressable shrink-0 cursor-pointer rounded-full border px-3 py-1 text-[12px]"
        >
          خروج
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={cover ? "max-w-36 truncate text-sm text-paper/85" : "max-w-36 truncate text-sm text-ink"}>
        {name}
      </span>
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
          {initialsFor(name)}
        </span>
      )}
      <button type="button" onClick={() => void auth.signOut()} className={className}>
        خروج
      </button>
    </div>
  );
}
