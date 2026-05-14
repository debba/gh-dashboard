import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translations, type TranslationKey } from "./translations";
import {
  DEFAULT_LANGUAGE,
  detectLanguage,
  persistLanguage,
  readPersistedLanguage,
  translate,
  type Language,
} from "../utils/i18n";

type Translate = (key: TranslationKey, replacements?: Record<string, string | number>) => string;
const AVAILABLE_LANGUAGES = Object.keys(translations) as Language[];

interface I18nContextValue {
  language: Language;
  languages: Language[];
  setLanguage: (language: Language) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function initialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  return readPersistedLanguage(window.localStorage)
    ?? detectLanguage(window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language]);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    if (typeof window !== "undefined") persistLanguage(window.localStorage, nextLanguage);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    languages: AVAILABLE_LANGUAGES,
    setLanguage,
    t: (key, replacements) => translate(language, key, replacements),
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
