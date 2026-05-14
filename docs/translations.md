# Translations

The dashboard uses small TypeScript dictionaries, one file per language.

```
src/i18n/
├── en.ts            # source keys and English text
├── it.ts            # Italian
├── fr.ts            # French
├── es.ts            # Spanish
├── de.ts            # German
├── zh.ts            # Chinese
└── translations.ts  # language registry
```

`en.ts` is the source of truth for translation keys. Other languages are typed as `Record<keyof typeof en, string>`, so TypeScript fails if a language is missing a key.

## Edit Existing Text

1. Find the key in `src/i18n/en.ts`.
2. Update the same key in each language file that needs a wording change.
3. Keep placeholders unchanged. For example, if English contains `{count}` or `{time}`, every translation for that key must keep the same placeholder name.
4. Run:

```bash
npm run typecheck
npm test
```

Example:

```ts
"common.refresh": "Refresh",
```

can become:

```ts
"common.refresh": "Reload",
```

Do not rename the key unless you also update every `t("...")` call that uses it.

## Add a New Key

1. Add the key to `src/i18n/en.ts`.
2. Add the same key to every other language file.
3. Use the key from React with `t("your.key")`.

Example:

```ts
// src/i18n/en.ts
"repo.lastSeen": "Last seen {time}",
```

```tsx
const { t } = useI18n();

return <span>{t("repo.lastSeen", { time: "10m ago" })}</span>;
```

Interpolation is intentionally simple: values are replaced by matching `{name}` tokens.

## Add a New Language

Use a lowercase language code as the file name. For example, Portuguese would use `pt.ts`.

1. Copy `src/i18n/en.ts` to `src/i18n/pt.ts`.
2. Rename the export and add the type constraint:

```ts
import type { en } from "./en";

export const pt: Record<keyof typeof en, string> = {
  "app.title": "GitHub Dashboard",
  // ...
};
```

3. Translate the values. Keep all keys and placeholders unchanged.
4. Register the language in `src/i18n/translations.ts`:

```ts
import { pt } from "./pt";

export const translations = { en, it, fr, es, de, zh, pt } as const;
```

5. Add the language name to every dictionary:

```ts
"language.pt": "Português",
```

6. If the language needs custom relative-time text, update `RELATIVE_TIME_LABELS` in `src/utils/format.ts`.
7. Add or update tests in:

```
tests/utils/i18n.test.ts
tests/utils/format.test.ts
```

8. Run:

```bash
npm run typecheck
npm test
npm run build
```

## Review Checklist

- The new file is listed in `src/i18n/translations.ts`.
- `npm run typecheck` passes.
- All placeholders match the English source.
- The language appears in the top-bar language switcher.
- Browser language detection works for the language code.
- Relative time is readable in list rows and repository cards.
