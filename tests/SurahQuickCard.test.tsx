import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SurahQuickCard from "@/components/reader/SurahQuickCard";
import { getSurahMeta } from "@/lib/mushaf/source";
import type { QuranAudioController } from "@/lib/audio/useQuranAudio";

const audio = {
  currentVerseKey: null,
  currentSurahNumber: null,
  isLoading: false,
  isPlaying: false,
  playbackMode: null,
  error: null,
  active: false,
  hasNext: false,
  hasPrev: false,
  reciter: {
    id: "minshawi",
    label: "Muhammad Siddiq Al-Minshawi",
    arabicName: "محمد صديق المنشاوي",
    source: "quran-foundation",
  },
  toggleAyah: vi.fn(),
  repeatAyah: vi.fn(),
  togglePage: vi.fn(),
  toggleSurah: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  next: vi.fn(),
  prev: vi.fn(),
  stop: vi.fn(),
  dismiss: vi.fn(),
} satisfies QuranAudioController;

const anchor = { left: 20, right: 120, top: 20, bottom: 50, width: 100, height: 30 };

describe("SurahQuickCard", () => {
  it("shows the selected Surah position and dispatches restrained quick actions", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn(async () => {});
    const onNavigate = vi.fn();
    const onOpenGuide = vi.fn();
    render(
      <SurahQuickCard
        open
        meta={getSurahMeta(85)!}
        anchor={anchor}
        currentAyah={8}
        audio={audio}
        onClose={() => {}}
        onNavigate={onNavigate}
        onCopy={onCopy}
        onShare={async () => {}}
        onOpenGuide={onOpenGuide}
      />
    );

    expect(screen.getByRole("dialog", { name: /بطاقة سورة البُرُوجِ/ })).toBeVisible();
    expect(screen.getByText("الآية ٨ من ٢٢")).toBeInTheDocument();
    expect(screen.getByText(/محمد صديق المنشاوي/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "الانتقال إلى البداية" }));
    expect(onNavigate).toHaveBeenCalledOnce();
    await user.selectOptions(screen.getByLabelText("صيغة نسخ السورة"), "numbered");
    await user.click(screen.getByRole("button", { name: "نسخ" }));
    expect(onCopy).toHaveBeenCalledWith("numbered");
    await user.click(screen.getByRole("button", { name: /معلومات السورة/ }));
    expect(onOpenGuide).toHaveBeenCalledOnce();
  });

  it("closes on Escape and outside pointer interaction", () => {
    const onClose = vi.fn();
    render(
      <SurahQuickCard
        open
        meta={getSurahMeta(84)!}
        anchor={anchor}
        currentAyah={25}
        audio={audio}
        onClose={onClose}
        onNavigate={() => {}}
        onCopy={async () => {}}
        onShare={async () => {}}
        onOpenGuide={() => {}}
      />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith(true);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledWith(true);
  });
});
