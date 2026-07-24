import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SurahGuide from "@/components/reader/SurahGuide";
import { getSurahMeta } from "@/lib/mushaf/source";
import type { SurahGuideData } from "@/lib/surahGuide/types";

describe("SurahGuide", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads only the selected Surah, renders attributed Arabic sections, and omits unsupported structure", async () => {
    const data: SurahGuideData = {
      surahNumber: 85,
      sections: [
        {
          id: "overview",
          title: "نبذة عن السورة",
          text: "نص عربي موثّق من المصدر.",
          contentFormat: "plain-text",
          source: {
            id: "quranpedia-surah-info-v1",
            name: "الموسوعة القرآنية (Quranpedia)",
            language: "ar",
            resourceUrl:
              "https://api.quranpedia.net/v1/surah/information/85",
            indexUrl: "https://quranpedia.net/surah-info",
          },
        },
        {
          id: "themes",
          title: "موضوعاتها",
          text: "موضوعات السورة كما وردت في المصدر.",
          contentFormat: "plain-text",
          source: {
            id: "quranpedia-surah-info-v1",
            name: "الموسوعة القرآنية (Quranpedia)",
            language: "ar",
            resourceUrl:
              "https://api.quranpedia.net/v1/surah/information/85",
            indexUrl: "https://quranpedia.net/surah-info",
          },
        },
        {
          id: "revelation-context",
          title: "سياق النزول والروايات المرتبطة بآيات السورة",
          text: "رواية مرتبطة بالسورة مع إحالتها.",
          contentFormat: "plain-text",
          source: {
            id: "quranpedia-surah-info-v1",
            name: "الموسوعة القرآنية (Quranpedia)",
            language: "ar",
            resourceUrl:
              "https://api.quranpedia.net/v1/surah/information/85",
            indexUrl: "https://quranpedia.net/surah-info",
          },
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => data,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SurahGuide
        open
        meta={getSurahMeta(85)}
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(screen.getByRole("complementary", { name: /دليل سورة البُرُوجِ/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "نبذة" })).toBeInTheDocument();
    expect(await screen.findByText("نص عربي موثّق من المصدر.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "موضوعاتها" })).toBeInTheDocument();
    expect(
      screen.getByText("سياق النزول والروايات المرتبطة بآيات السورة")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/الموسوعة القرآنية/).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/surah-info?surah=85&v=1"
    );
    expect(screen.queryByRole("heading", { name: "بنية السورة" })).not.toBeInTheDocument();
  });

  it("keeps trusted local metadata visible and offers retry when the provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(
      <SurahGuide
        open
        meta={getSurahMeta(84)}
        onClose={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(screen.getByText("٢٥")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "تعذّر الاتصال بالخادم"
    );
    expect(
      screen.getByRole("button", { name: "إعادة المحاولة" })
    ).toBeInTheDocument();
  });
});
