/** English <-> Russian Excel function names. */
export const EN_TO_RU: Record<string, string> = {
  SUM: "СУММ", AVERAGE: "СРЗНАЧ", MIN: "МИН", MAX: "МАКС", COUNT: "СЧЁТ", COUNTA: "СЧЁТЗ",
  COUNTBLANK: "СЧИТАТЬПУСТОТЫ", COUNTIF: "СЧЁТЕСЛИ", COUNTIFS: "СЧЁТЕСЛИМН", SUMIF: "СУММЕСЛИ",
  SUMIFS: "СУММЕСЛИМН", AVERAGEIF: "СРЗНАЧЕСЛИ", AVERAGEIFS: "СРЗНАЧЕСЛИМН", MAXIFS: "МАКСЕСЛИ",
  MINIFS: "МИНЕСЛИ", PRODUCT: "ПРОИЗВЕД", ROUND: "ОКРУГЛ", ROUNDUP: "ОКРУГЛВВЕРХ",
  ROUNDDOWN: "ОКРУГЛВНИЗ", ABS: "ABS", SQRT: "КОРЕНЬ", POWER: "СТЕПЕНЬ", MOD: "ОСТАТ", INT: "ЦЕЛОЕ",
  CEILING: "ОКРВВЕРХ", FLOOR: "ОКРВНИЗ", PI: "ПИ", SUMPRODUCT: "СУММПРОИЗВ", MEDIAN: "МЕДИАНА",
  LARGE: "НАИБОЛЬШИЙ", SMALL: "НАИМЕНЬШИЙ", RANK: "РАНГ", STDEV: "СТАНДОТКЛОН", IF: "ЕСЛИ",
  IFS: "ЕСЛИМН", IFERROR: "ЕСЛИОШИБКА", IFNA: "ЕСНД", AND: "И", OR: "ИЛИ", NOT: "НЕ",
  VLOOKUP: "ВПР", HLOOKUP: "ГПР", XLOOKUP: "ПРОСМОТРX", INDEX: "ИНДЕКС", MATCH: "ПОИСКПОЗ",
  LEFT: "ЛЕВСИМВ", RIGHT: "ПРАВСИМВ", MID: "ПСТР", LEN: "ДЛСТР", UPPER: "ПРОПИСН",
  LOWER: "СТРОЧН", PROPER: "ПРОПНАЧ", TRIM: "СЖПРОБЕЛЫ", CONCAT: "СЦЕП", CONCATENATE: "СЦЕПИТЬ",
  TEXTJOIN: "ОБЪЕДИНИТЬ", SUBSTITUTE: "ПОДСТАВИТЬ", FIND: "НАЙТИ", SEARCH: "ПОИСК", TEXT: "ТЕКСТ",
  VALUE: "ЗНАЧЕН", EXACT: "СОВПАД", REPT: "ПОВТОР", TODAY: "СЕГОДНЯ", NOW: "ТДАТА", DATE: "ДАТА",
  YEAR: "ГОД", MONTH: "МЕСЯЦ", DAY: "ДЕНЬ", WEEKDAY: "ДЕНЬНЕД", EOMONTH: "КОНМЕСЯЦА",
  EDATE: "ДАТАМЕС", DAYS: "ДНИ", DATEDIF: "РАЗНДАТ", NETWORKDAYS: "ЧИСТРАБДНИ", ISBLANK: "ЕПУСТО",
  ISNUMBER: "ЕЧИСЛО", ISTEXT: "ЕТЕКСТ", ISERROR: "ЕОШИБКА", NA: "НД", TRUE: "ИСТИНА", FALSE: "ЛОЖЬ",
};

export const RU_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_RU).map(([en, ru]) => [ru, en]),
);
// Common spelling without "Ё"
for (const [ru, en] of Object.entries({ ...RU_TO_EN })) {
  if (ru.includes("Ё")) RU_TO_EN[ru.replace(/Ё/g, "Е")] = en;
}

export type FunctionLocale = "en" | "ru";
export type ArgSeparator = "," | ";";

export interface FormulaStyle {
  locale: FunctionLocale;
  separator: ArgSeparator;
}

/**
 * Walks a formula outside of string literals and calls `onText` for each code segment.
 * String literals are left untouched.
 */
function mapCode(formula: string, onText: (code: string) => string): string {
  let out = "";
  let buf = "";
  let inStr = false;
  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if (ch === '"') {
      if (!inStr) {
        out += onText(buf);
        buf = "";
        inStr = true;
        out += ch;
      } else if (formula[i + 1] === '"') {
        out += '""';
        i++;
      } else {
        inStr = false;
        out += ch;
      }
      continue;
    }
    if (inStr) out += ch;
    else buf += ch;
  }
  return out + onText(buf);
}

/**
 * Converts a canonical formula (English names, comma separators, dot decimals)
 * into the user's preferred style, e.g. =ЕСЛИ(A2>0,5;"да";"нет").
 */
export function localizeFormula(formula: string, style: FormulaStyle): string {
  if (style.locale === "en" && style.separator === ",") return formula;
  return mapCode(formula, (code) => {
    let s = code;
    if (style.separator === ";") {
      s = s.replace(/,/g, ";").replace(/(\d)\.(\d)/g, "$1,$2");
    }
    if (style.locale === "ru") {
      s = s.replace(/([A-Za-z][A-Za-z0-9.]*)(\s*\()/g, (m, name: string, paren: string) => {
        const ru = EN_TO_RU[name.toUpperCase()];
        return ru ? ru + paren : m;
      });
      s = s.replace(/\b(TRUE|FALSE)\b(?!\s*\()/gi, (m) => EN_TO_RU[m.toUpperCase()] ?? m);
    }
    return s;
  });
}

/**
 * Converts any user-entered formula (Russian names, semicolons, decimal commas)
 * into canonical English form understood by the engine.
 */
export function canonicalizeFormula(formula: string): string {
  if (!formula.startsWith("=")) return formula;
  let hasSemicolon = false;
  mapCode(formula, (code) => {
    if (code.includes(";")) hasSemicolon = true;
    return code;
  });
  return mapCode(formula, (code) => {
    let s = code;
    if (hasSemicolon) {
      s = s.replace(/(\d),(\d)/g, "$1.$2").replace(/;/g, ",");
    }
    s = s.replace(/([\p{L}_][\p{L}\p{N}_.]*)(\s*\()/gu, (m, name: string, paren: string) => {
      const en = RU_TO_EN[name.toUpperCase()];
      return en ? en + paren : m;
    });
    s = s.replace(/(ИСТИНА|ЛОЖЬ)(?!\s*\()/giu, (m) => RU_TO_EN[m.toUpperCase()] ?? m);
    return s;
  });
}
