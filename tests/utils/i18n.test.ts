import { describe, expect, it } from "vitest";
import {
  LANGUAGE_STORAGE_KEY,
  detectLanguage,
  isSupportedLanguage,
  normalizeLanguage,
  persistLanguage,
  readPersistedLanguage,
  translate,
} from "../../src/utils/i18n";

describe("i18n utilities", () => {
  it("detects the first supported browser language", () => {
    expect(detectLanguage(["fr-FR", "it-IT", "en-US"])).toBe("fr");
    expect(detectLanguage(["pt-BR", "fr-FR", "en-US"])).toBe("fr");
    expect(detectLanguage(["es-ES", "de-DE"])).toBe("es");
    expect(detectLanguage(["zh-CN", "en-US"])).toBe("zh");
    expect(detectLanguage(["de-DE", "en-GB"])).toBe("de");
    expect(detectLanguage(["pt-BR"])).toBe("en");
  });

  it("normalizes supported languages", () => {
    expect(normalizeLanguage("it-IT")).toBe("it");
    expect(normalizeLanguage("EN-us")).toBe("en");
    expect(normalizeLanguage("fr-FR")).toBe("fr");
    expect(normalizeLanguage("es-MX")).toBe("es");
    expect(normalizeLanguage("de-DE")).toBe("de");
    expect(normalizeLanguage("zh-Hans-CN")).toBe("zh");
    expect(normalizeLanguage("pt-BR")).toBeNull();
    expect(isSupportedLanguage("it")).toBe(true);
  });

  it("persists and reads the language preference", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    persistLanguage(storage, "it");

    expect(values.get(LANGUAGE_STORAGE_KEY)).toBe("it");
    expect(readPersistedLanguage(storage)).toBe("it");
  });

  it("interpolates translations", () => {
    expect(translate("it", "summary.repos", { count: 3 })).toBe("3 repo");
    expect(translate("en", "summary.repos", { count: 3 })).toBe("3 repos");
  });
});
