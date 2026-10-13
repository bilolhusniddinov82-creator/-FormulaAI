# FormulaAI — Excel formulas with AI

Describe a calculation in **Uzbek, Russian or English** and get a working Excel formula with a plain-language explanation, the cells it uses, a worked example, exact paste instructions and alternatives. Includes an Excel-like spreadsheet editor with a live formula engine, file import/export, templates and a searchable formula library.

## Quick start

Requirements: Node.js 18.18+ (tested on Node 24).

```bash
npm install
npm run dev          # http://localhost:3000
```

The app works immediately in **demo mode** (no API key): a built-in, rule-based generator answers common requests (revenue, salaries, inventory, expenses, profit & loss, counts, discounts, percentages, averages, max/min, lookups, VAT).

### Enable AI (Claude)

```bash
cp .env.example .env.local
# then edit .env.local:
ANTHROPIC_API_KEY=sk-ant-...
# optional, defaults to claude-opus-5-5
# ANTHROPIC_MODEL=claude-opus-5-5
```

Restart the dev server. The navbar badge switches from **Demo mode** to **AI mode**.

The key is read only on the server (`src/lib/ai/claude.ts`, used by `POST /api/generate`). It is never sent to the browser — do **not** prefix it with `NEXT_PUBLIC_`. If the AI call fails (invalid key, rate limit, network), the API answers with the demo generator and the UI shows a notice.

### Production

```bash
npm run build
npm start
```

### Tests

```bash
npm test         # formula engine, demo generator, sheet operations, file import
npm run typecheck
```

## Pages

| Route | What it does |
| --- | --- |
| `/` | Dashboard: prompt, language selector, generate, upload, example cards, recent calculations, sales calculator |
| `/formula-generator` | Full generator with results. Supports links like `/formula-generator?q=Calculate%20VAT&lang=ru` |
| `/spreadsheet` | Spreadsheet editor + AI assistant panel |
| `/templates` | Sales calculator, payroll, inventory, monthly expenses, P&L, price list with discounts & VAT |
| `/formula-library` | 60+ functions and business formulas with syntax, example and use case, searchable by category |
| `/history` | Saved generations (stored in the browser), search, reopen, delete |
| `/settings` | Interface/explanation language, theme, function names (EN/RU), separator (`,`/`;`), currency, decimals, reset |

## Spreadsheet editor

- Click to select, **Enter/F2** or double-click to edit, type `=` to start a formula; while typing a formula, click cells to insert their addresses.
- Arrow keys, Tab, Shift+click / Shift+arrows / drag for ranges, Delete to clear, Ctrl+Z / Ctrl+Y, Ctrl+C copies values, **Ctrl+V pastes from Excel** (tab-separated).
- Formula bar, add/delete rows and columns, rename columns, number/currency/percent/date formats, sort A→Z / Z→A (formulas move with their rows), fill down, search with highlighting (Enter jumps to the next match).
- Automatic totals row (sum / average / count) and selection statistics.
- Inserting a row copies per-row formulas from the row above and extends totals such as `=SUM(D2:D4)`.
- Formulas typed with Russian names or semicolons (`=СУММ(A1;B1)`) are understood and stored in canonical form.
- Export to **.xlsx** (live formulas + cached values + number formats) or **CSV** (UTF-8 with BOM). After uploading a file, the untouched **original** can be downloaded again from the Export menu.

**Formula engine** (`src/lib/formula`): its own parser and evaluator with Excel operator precedence, ranges, whole-column ranges, circular-reference detection and these functions: SUM, PRODUCT, ROUND, ROUNDUP, ROUNDDOWN, ABS, SQRT, POWER, MOD, INT, CEILING, FLOOR, PI, SUMPRODUCT, AVERAGE, MIN, MAX, MEDIAN, COUNT, COUNTA, COUNTBLANK, LARGE, SMALL, RANK, STDEV, SUMIF(S), COUNTIF(S), AVERAGEIF(S), MAXIFS, MINIFS, IF, IFS, IFERROR, IFNA, AND, OR, NOT, VLOOKUP, HLOOKUP, XLOOKUP, INDEX, MATCH, LEFT, RIGHT, MID, LEN, UPPER, LOWER, PROPER, TRIM, CONCAT, CONCATENATE, TEXTJOIN, SUBSTITUTE, FIND, SEARCH, TEXT, VALUE, EXACT, REPT, TODAY, NOW, DATE, YEAR, MONTH, DAY, WEEKDAY, EOMONTH, EDATE, DAYS, DATEDIF, NETWORKDAYS, ISBLANK, ISNUMBER, ISTEXT, ISERROR, NA. Russian function names are accepted too.

> Handsontable was not used because it needs a commercial license for business use, and Univer is very large for this scope. The custom grid and engine have no licensing restrictions.

## File upload

`.xlsx`, `.xls` and `.csv` up to 10 MB (first non-empty sheet, up to 5,000 rows × 100 columns), parsed in the browser with SheetJS. Formulas are kept, date and percent columns are detected, and a header row is generated (`Column A`, …) when the first row is not headers. In the editor's **AI Assistant** panel, choose the columns to use; the generator then receives the real headers, sample values and row range, so references match your file.

## How generation works

`POST /api/generate` body: `{ prompt, language: "uz"|"ru"|"en", context? }` (validated with Zod). `context` describes the sheet (column letters, headers, a few sample values, data rows, selected columns).

- **AI mode** — Claude is asked for structured JSON (`output_config.format` JSON schema), and the response is validated against the same Zod schema. Formulas always come back in canonical form (English names, commas); the UI converts them to Russian names and/or `;` separators from Settings.
- **Rule:** cell references are never invented silently. If the layout is unknown, the result is marked **Example references**, lists its assumptions and asks which columns hold the data; vague requests get a clarifying question.
- **Demo mode** — the same output shape from `src/lib/ai/demo-generator.ts`, which recognises intents and column mentions in all three languages ("quantity is in column B", "количество в столбце B", "miqdor B ustunda") and the uploaded sheet's headers.

## Project structure

```
src/
  app/                 pages + api/generate, api/status
  components/
    ui/                shadcn-style primitives (button, card, input, dialog, dropdown, tooltip, badge)
    layout/            navbar, footer, providers (theme, tooltips, toasts, store hydration)
    shared/            copy, upload, language, theme, confirm, page header
    generator/         prompt form (react-hook-form + zod), result view, history cards
    spreadsheet/       grid, editor, assistant panel
  lib/
    formula/           tokenizer, parser, evaluator, functions, reference shifting, RU/EN localization
    ai/                schema (zod + JSON schema), Claude client, demo generator
    sheet-ops.ts       immutable sheet operations (insert/delete/sort/paste/fill/insert formula)
    spreadsheet-io.ts  SheetJS import/export
    templates.ts, formula-library.ts, i18n.ts, format.ts
  store/               zustand stores (settings, history, sheet, generator), persisted to localStorage
tests/                 node:test suites
```

## O‘zbekcha qisqacha

1. `npm install`, so‘ng `npm run dev` — brauzerda http://localhost:3000 ni oching.
2. API kalitsiz ilova **demo rejimda** ishlaydi (tayyor formulalar bilan).
3. AI ni yoqish uchun `.env.example` faylini `.env.local` nomi bilan nusxalang va `ANTHROPIC_API_KEY` ni kiriting, so‘ng serverni qayta ishga tushiring.
