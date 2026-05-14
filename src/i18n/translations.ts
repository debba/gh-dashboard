import { en } from "./en";
import { it } from "./it";
import { fr } from "./fr";
import { es } from "./es";
import { de } from "./de";
import { zh } from "./zh";

export const translations = { en, it, fr, es, de, zh } as const;
export type TranslationKey = keyof typeof en;
