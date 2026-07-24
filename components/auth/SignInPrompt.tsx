"use client";

import { useAuthUser } from "@/lib/auth/useAuthUser";
import Modal from "@/components/chrome/Modal";

export default function SignInPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const auth = useAuthUser();

  return (
    <Modal open={open} onClose={onClose} title="حفظ العلامات" maxWidth="max-w-md">
      <div className="px-5 py-5">
        <p className="text-sm leading-7 text-ink">
          سجّل الدخول لحفظ علاماتك وملاحظاتك ومزامنتها بين أجهزتك
        </p>
        {auth.error && <p className="mt-2 text-xs text-danger">{auth.error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="pressable rounded-full border border-gold/25 px-4 py-2 text-sm text-ink-soft hover:text-ink"
          >
            لاحقًا
          </button>
          <button
            type="button"
            disabled={!auth.isConfigured}
            onClick={() => void auth.signInWithGoogle()}
            className="pressable rounded-full bg-accent px-4 py-2 text-sm text-paper disabled:cursor-default disabled:opacity-50"
          >
            تسجيل الدخول بواسطة Google
          </button>
        </div>
      </div>
    </Modal>
  );
}
