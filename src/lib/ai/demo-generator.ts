import { colToLetters, lettersToCol } from "../formula/refs";
import type { Language, SheetContext } from "../types";
import type { FormulaItem, FormulaResult } from "./schema";

/**
 * Local rule-based formula generator used when no AI key is configured
 * (or when the AI request fails). Understands English, Russian and Uzbek prompts.
 */

type Role =
  | "name" | "quantity" | "price" | "revenue" | "cost" | "salary" | "bonus" | "deduction"
  | "hours" | "rate" | "opening" | "received" | "sold" | "expected" | "actual" | "balance"
  | "amount" | "date" | "category" | "discount";

const ROLE_KEYWORDS: Record<Role, string[]> = {
  name: ["product", "item", "name", "товар", "продукт", "наименован", "назван", "mahsulot", "nomi", "tovar", "employee", "сотрудник", "xodim", "ism"],
  quantity: ["quantity", "qty", "units", "pcs", "количеств", "кол-во", "кол.", "шт", "miqdor", "soni", "dona"],
  price: ["price", "цен", "narx"],
  revenue: ["revenue", "sales", "turnover", "выручк", "продаж", "daromad", "tushum", "savdo"],
  cost: ["cost", "себестоим", "затрат", "tannarx", "xarajat"],
  salary: ["salary", "wage", "base pay", "оклад", "зарплат", "зп", "maosh", "ish haqi", "oylik"],
  bonus: ["bonus", "премия", "премии", "бонус", "mukofot"],
  deduction: ["deduction", "tax", "удержан", "налог", "ushlanma", "soliq"],
  hours: ["hours", "час", "soat"],
  rate: ["rate", "ставк", "stavka"],
  opening: ["opening", "beginning", "start stock", "начальн", "на начало", "boshlang"],
  received: ["received", "incoming", "purchased", "приход", "поступ", "закуп", "kirim", "kelgan"],
  sold: ["sold", "outgoing", "issued", "отгруж", "продано", "списан", "chiqim", "sotilgan"],
  expected: ["expected", "system", "book", "ожида", "учетн", "учётн", "kutilgan", "hisobdagi"],
  actual: ["actual", "counted", "physical", "фактич", "факт", "haqiqiy", "sanalgan"],
  balance: ["balance", "stock", "остаток", "qoldiq", "zaxira"],
  amount: ["amount", "expense", "spent", "сумм", "расход", "трат", "summa", "xarajat", "chiqim"],
  date: ["date", "month", "day", "дата", "месяц", "sana", "oy"],
  category: ["category", "type", "group", "категор", "тип", "статья", "kategoriya", "turi", "guruh"],
  discount: ["discount", "скидк", "chegirma"],
};

type Intent =
  | "revenue" | "salary" | "inventory" | "expenses" | "profit" | "count" | "discount"
  | "percent" | "average" | "maxmin" | "lookup" | "vat" | "sum";

const INTENT_KEYWORDS: [Intent, string[]][] = [
  ["inventory", ["inventory", "stock", "missing", "warehouse", "shortage", "остат", "склад", "недостач", "инвентар", "ombor", "qoldiq", "kamomad", "yetishmay", "zaxira"]],
  ["salary", ["salary", "salaries", "payroll", "wage", "зарплат", "оклад", "заработн", "maosh", "ish haqi", "oylik"]],
  ["profit", ["profit", "loss", "margin", "прибыл", "убыт", "маржин", "наценк", "foyda", "zarar", "marja"]],
  ["expenses", ["expense", "spending", "costs", "расход", "затрат", "трат", "xarajat"]],
  ["lookup", ["lookup", "look up", "find the price", "vlookup", "xlookup", "найти цену", "впр", "подтянуть", "qidir", "topib"]],
  ["vat", ["vat", "ндс", "qqs", "qo‘shilgan qiymat", "qo'shilgan qiymat"]],
  ["discount", ["discount", "скидк", "chegirma"]],
  ["percent", ["percent", "percentage", "%", "share", "процент", "доля", "foiz", "ulush"]],
  ["count", ["count", "how many", "number of", "посчитать количество", "сколько", "количество товар", "nechta", "soni", "sanash", "hisobla soni"]],
  ["average", ["average", "mean", "средн", "o‘rtacha", "o'rtacha", "ortacha"]],
  ["maxmin", ["maximum", "minimum", "highest", "lowest", "largest", "smallest", "best", "top", "максим", "миним", "наибольш", "наименьш", "eng katta", "eng kichik", "eng ko‘p", "eng yuqori"]],
  ["revenue", ["revenue", "sales", "total sales", "turnover", "выручк", "продаж", "daromad", "tushum", "savdo", "sotuv"]],
  ["sum", ["total", "sum", "итог", "сумм", "jami", "yig‘indi", "yigindi", "umumiy"]],
];

type Text = { en: string; ru: string; uz: string };

interface Ctx {
  lang: Language;
  t: (x: Text) => string;
  cols: Partial<Record<Role, string>>;
  /** Roles whose column came from the user (prompt or sheet), not assumed. */
  known: Set<Role>;
  assumed: Role[];
  first: number;
  last: number;
  rangeKnown: boolean;
  nextFree: () => string;
  headers: Map<string, string>;
}

const ROLE_LABEL: Record<Role, Text> = {
  name: { en: "product / name", ru: "товар / наименование", uz: "mahsulot / nomi" },
  quantity: { en: "quantity", ru: "количество", uz: "miqdor" },
  price: { en: "unit price", ru: "цена за единицу", uz: "birlik narxi" },
  revenue: { en: "revenue", ru: "выручка", uz: "daromad (tushum)" },
  cost: { en: "cost", ru: "себестоимость", uz: "tannarx" },
  salary: { en: "base salary", ru: "оклад", uz: "asosiy maosh" },
  bonus: { en: "bonus", ru: "премия", uz: "mukofot" },
  deduction: { en: "deductions", ru: "удержания", uz: "ushlanmalar" },
  hours: { en: "hours worked", ru: "отработанные часы", uz: "ishlangan soat" },
  rate: { en: "hourly rate", ru: "часовая ставка", uz: "soatlik stavka" },
  opening: { en: "opening stock", ru: "начальный остаток", uz: "boshlang‘ich qoldiq" },
  received: { en: "received", ru: "приход", uz: "kirim" },
  sold: { en: "sold / issued", ru: "расход (продано)", uz: "chiqim (sotilgan)" },
  expected: { en: "expected (book) stock", ru: "учётный остаток", uz: "hisobdagi qoldiq" },
  actual: { en: "actual (counted) stock", ru: "фактический остаток", uz: "haqiqiy qoldiq" },
  balance: { en: "stock balance", ru: "остаток", uz: "qoldiq" },
  amount: { en: "amount", ru: "сумма", uz: "summa" },
  date: { en: "date", ru: "дата", uz: "sana" },
  category: { en: "category", ru: "категория", uz: "kategoriya" },
  discount: { en: "discount %", ru: "скидка %", uz: "chegirma %" },
};

function norm(s: string) {
  return s.toLowerCase().replace(/[’`ʻʼ]/g, "‘");
}

function matchRole(text: string): Role | null {
  const s = norm(text);
  // Order matters: more specific roles first
  const order: Role[] = [
    "discount", "opening", "received", "sold", "expected", "actual", "bonus", "deduction", "hours",
    "rate", "salary", "quantity", "price", "revenue", "cost", "balance", "date", "category", "amount", "name",
  ];
  for (const role of order) {
    if (ROLE_KEYWORDS[role].some((k) => s.includes(k))) return role;
  }
  return null;
}

/** Finds explicit column mentions such as "quantity is in column B", "B ustunda narx", "цена в столбце C". */
function columnsFromPrompt(prompt: string): Partial<Record<Role, string>> {
  const found: Partial<Record<Role, string>> = {};
  const colWord = "(?:column|col\\.?|столбц[еау]?|столбец|колонк[еаи]|ustun(?:da|ida|i)?)";
  // Each pattern captures: [1] words before, [2] column letter, [3] words after (optional)
  const patterns = [
    new RegExp(`([^.,;:\\n]{0,40}?)(?<!\\p{L})${colWord}\\s+([A-Z]{1,2})(?![\\p{L}\\d])()`, "giu"),
    new RegExp(`([^.,;:\\n]{0,40}?)(?<![\\p{L}\\d])([A-Z]{1,2})\\s+${colWord}([^.,;:\\n]{0,40})`, "giu"),
    new RegExp(`([\\p{L}%' -]{2,30})\\(([A-Z]{1,2})\\)()`, "gu"),
    new RegExp(`([\\p{L}%' -]{2,30})\\s*[-–=:]\\s*([A-Z]{1,2})(?![\\p{L}\\d])()`, "gu"),
  ];
  for (const re of patterns) {
    for (const m of prompt.matchAll(re)) {
      const letter = m[2];
      if (!/^[A-Z]{1,2}$/.test(letter)) continue;
      // Prefer the words closest to the column letter: last words before it, then words after it
      const before = m[1].trim().split(/\s+/).slice(-4).join(" ");
      const after = (m[3] ?? "").trim().split(/\s+/).slice(0, 4).join(" ");
      const role = matchRole(before) ?? matchRole(after);
      if (role && !found[role]) found[role] = letter;
    }
  }
  return found;
}

function detectIntent(prompt: string, cols: Partial<Record<Role, string>>): Intent | null {
  const s = norm(prompt);
  for (const [intent, words] of INTENT_KEYWORDS) {
    if (words.some((w) => s.includes(w))) {
      // "total" with quantity & price columns is a revenue question
      if (intent === "sum" && cols.quantity && cols.price) return "revenue";
      return intent;
    }
  }
  if (cols.quantity && cols.price) return "revenue";
  return null;
}

function buildCtx(prompt: string, lang: Language, context?: SheetContext | null): Ctx {
  const t = (x: Text) => x[lang];
  const cols: Partial<Record<Role, string>> = {};
  const known = new Set<Role>();
  const headers = new Map<string, string>();

  if (context) {
    const selected = new Set(context.selectedColumns);
    const pool = context.columns.filter((c) => selected.size === 0 || selected.has(c.letter));
    for (const c of context.columns) headers.set(c.letter, c.header);
    for (const c of [...pool, ...context.columns]) {
      const role = matchRole(c.header);
      if (role && !cols[role]) {
        cols[role] = c.letter;
        known.add(role);
      }
    }
  }
  const fromPrompt = columnsFromPrompt(prompt);
  for (const [role, letter] of Object.entries(fromPrompt) as [Role, string][]) {
    cols[role] = letter;
    known.add(role);
  }

  const used = new Set<number>(Object.values(cols).map((l) => lettersToCol(l!)));
  if (context) context.columns.forEach((c) => used.add(lettersToCol(c.letter)));
  let next = used.size ? Math.max(...used) + 1 : 3;
  const nextFree = () => colToLetters(next++);

  return {
    lang,
    t,
    cols,
    known,
    assumed: [],
    first: context?.firstDataRow ?? 2,
    last: context && context.lastDataRow >= context.firstDataRow ? context.lastDataRow : 100,
    rangeKnown: !!context && context.lastDataRow >= context.firstDataRow,
    nextFree,
    headers,
  };
}

/** Returns the column for a role; when unknown, assigns a default and records the assumption. */
function col(ctx: Ctx, role: Role, fallback: string): string {
  const existing = ctx.cols[role];
  if (existing) return existing;
  ctx.cols[role] = fallback;
  ctx.assumed.push(role);
  return fallback;
}

/** Column for a computed result: reuse a matching existing column or take the next free one. */
function outputCol(ctx: Ctx, role: Role): string {
  const existing = ctx.cols[role];
  if (existing && ctx.known.has(role)) return existing;
  const letter = ctx.nextFree();
  ctx.cols[role] = letter;
  return letter;
}

const range = (ctx: Ctx, c: string) => `${c}${ctx.first}:${c}${ctx.last}`;
const absRange = (ctx: Ctx, c: string) => `$${c}$${ctx.first}:$${c}$${ctx.last}`;

interface Draft {
  title: Text;
  summary: Text;
  formulas: { label: Text; formula: string; explanation: Text; targetCell: string | null; fillDown: boolean }[];
  example: Text;
  alternatives: { formula: string; note: Text }[];
}

function pasteSteps(ctx: Ctx, d: Draft): string[] {
  const steps: string[] = [];
  for (const f of d.formulas) {
    const label = ctx.t(f.label);
    if (!f.targetCell) continue;
    if (f.fillDown) {
      steps.push(
        ctx.t({
          en: `${label}: click cell ${f.targetCell}, paste the formula, press Enter, then drag the fill handle (small square at the bottom-right of the cell) down to row ${ctx.last}.`,
          ru: `${label}: выделите ячейку ${f.targetCell}, вставьте формулу, нажмите Enter, затем протяните маркер заполнения (квадратик в правом нижнем углу) вниз до строки ${ctx.last}.`,
          uz: `${label}: ${f.targetCell} katakchasini tanlang, formulani joylang, Enter bosing, so‘ng to‘ldirish markerini (katakchaning pastki o‘ng burchagidagi kichik kvadrat) ${ctx.last}-qatorgacha pastga torting.`,
        }),
      );
    } else {
      steps.push(
        ctx.t({
          en: `${label}: click an empty cell below or beside your data (e.g. ${f.targetCell}), paste the formula and press Enter.`,
          ru: `${label}: выберите пустую ячейку под или рядом с данными (например, ${f.targetCell}), вставьте формулу и нажмите Enter.`,
          uz: `${label}: ma’lumotlar ostidagi yoki yonidagi bo‘sh katakchani tanlang (masalan, ${f.targetCell}), formulani joylang va Enter bosing.`,
        }),
      );
    }
  }
  return steps;
}

// ---------- intent builders ----------

function revenue(ctx: Ctx): Draft {
  const q = col(ctx, "quantity", "B");
  const p = col(ctx, "price", "C");
  const r = outputCol(ctx, "revenue");
  const { first, last } = ctx;
  return {
    title: { en: "Total sales revenue", ru: "Общая выручка от продаж", uz: "Umumiy savdo tushumi" },
    summary: {
      en: `Multiply quantity by unit price for each row, then add up the results.`,
      ru: `Умножьте количество на цену в каждой строке, затем сложите результаты.`,
      uz: `Har bir qatorda miqdorni narxga ko‘paytiring, so‘ng natijalarni qo‘shing.`,
    },
    formulas: [
      {
        label: { en: "Revenue for each row", ru: "Выручка по каждой строке", uz: "Har bir qator uchun tushum" },
        formula: `=${q}${first}*${p}${first}`,
        explanation: {
          en: `Multiplies the quantity in ${q}${first} by the price in ${p}${first}. Copied down, the row number changes automatically (${q}${first + 1}*${p}${first + 1}, …).`,
          ru: `Умножает количество из ${q}${first} на цену из ${p}${first}. При копировании вниз номер строки меняется автоматически (${q}${first + 1}*${p}${first + 1}, …).`,
          uz: `${q}${first} dagi miqdorni ${p}${first} dagi narxga ko‘paytiradi. Pastga nusxalanganda qator raqami avtomatik o‘zgaradi (${q}${first + 1}*${p}${first + 1}, …).`,
        },
        targetCell: `${r}${first}`,
        fillDown: true,
      },
      {
        label: { en: "Total revenue", ru: "Итоговая выручка", uz: "Jami tushum" },
        formula: `=SUM(${range(ctx, r)})`,
        explanation: {
          en: `Adds up every row revenue in column ${r}, from row ${first} to row ${last}.`,
          ru: `Складывает выручку всех строк столбца ${r} — со строки ${first} по ${last}.`,
          uz: `${r} ustunidagi barcha qatorlar tushumini (${first}-qatordan ${last}-qatorgacha) qo‘shadi.`,
        },
        targetCell: `${r}${last + 2}`,
        fillDown: false,
      },
      {
        label: { en: "Total quantity sold", ru: "Всего продано (шт.)", uz: "Jami sotilgan miqdor" },
        formula: `=SUM(${range(ctx, q)})`,
        explanation: {
          en: `Adds up all quantities in column ${q}.`,
          ru: `Суммирует всё количество в столбце ${q}.`,
          uz: `${q} ustunidagi barcha miqdorlarni qo‘shadi.`,
        },
        targetCell: `${q}${last + 2}`,
        fillDown: false,
      },
    ],
    example: {
      en: `Row ${first}: 10 × 5 000 = 50 000. If the other rows give 60 000 and 32 000, the total is 50 000 + 60 000 + 32 000 = 142 000.`,
      ru: `Строка ${first}: 10 × 5 000 = 50 000. Если в других строках 60 000 и 32 000, итог: 50 000 + 60 000 + 32 000 = 142 000.`,
      uz: `${first}-qator: 10 × 5 000 = 50 000. Boshqa qatorlarda 60 000 va 32 000 bo‘lsa, jami: 50 000 + 60 000 + 32 000 = 142 000.`,
    },
    alternatives: [
      {
        formula: `=SUMPRODUCT(${range(ctx, q)},${range(ctx, p)})`,
        note: {
          en: "Total revenue in one cell, without a helper column.",
          ru: "Итоговая выручка в одной ячейке без вспомогательного столбца.",
          uz: "Yordamchi ustunsiz, bitta katakchada jami tushum.",
        },
      },
      {
        formula: `=AVERAGE(${range(ctx, r)})`,
        note: { en: "Average sale value per row.", ru: "Средняя сумма продажи на строку.", uz: "Bir qatordagi o‘rtacha savdo summasi." },
      },
    ],
  };
}

function salary(ctx: Ctx): Draft {
  const { first, last } = ctx;
  const hourly = ctx.cols.hours && ctx.cols.rate;
  if (hourly) {
    const h = ctx.cols.hours!;
    const rt = ctx.cols.rate!;
    const out = outputCol(ctx, "salary");
    return {
      title: { en: "Salary from hours × rate", ru: "Зарплата: часы × ставка", uz: "Maosh: soat × stavka" },
      summary: {
        en: "Multiply hours worked by the hourly rate for each employee, then total the payroll.",
        ru: "Умножьте отработанные часы на ставку для каждого сотрудника и сложите фонд оплаты.",
        uz: "Har bir xodim uchun ishlangan soatni stavkaga ko‘paytiring va umumiy ish haqi fondini hisoblang.",
      },
      formulas: [
        {
          label: { en: "Salary per employee", ru: "Зарплата сотрудника", uz: "Xodim maoshi" },
          formula: `=${h}${first}*${rt}${first}`,
          explanation: {
            en: `Hours in ${h}${first} multiplied by the rate in ${rt}${first}.`,
            ru: `Часы из ${h}${first}, умноженные на ставку из ${rt}${first}.`,
            uz: `${h}${first} dagi soat ${rt}${first} dagi stavkaga ko‘paytiriladi.`,
          },
          targetCell: `${out}${first}`,
          fillDown: true,
        },
        {
          label: { en: "Total payroll", ru: "Фонд оплаты труда", uz: "Umumiy ish haqi fondi" },
          formula: `=SUM(${range(ctx, out)})`,
          explanation: { en: `Sum of all salaries in column ${out}.`, ru: `Сумма всех зарплат в столбце ${out}.`, uz: `${out} ustunidagi barcha maoshlar yig‘indisi.` },
          targetCell: `${out}${last + 2}`,
          fillDown: false,
        },
      ],
      example: { en: "160 h × 50 000 = 8 000 000.", ru: "160 ч × 50 000 = 8 000 000.", uz: "160 soat × 50 000 = 8 000 000." },
      alternatives: [
        {
          formula: `=IF(${h}${first}>160,160*${rt}${first}+(${h}${first}-160)*${rt}${first}*1.5,${h}${first}*${rt}${first})`,
          note: { en: "Overtime above 160 h paid at 1.5×.", ru: "Сверхурочные свыше 160 ч оплачиваются ×1,5.", uz: "160 soatdan ortiq ish 1,5 baravar to‘lanadi." },
        },
      ],
    };
  }
  const b = col(ctx, "salary", "B");
  const bo = col(ctx, "bonus", "C");
  const d = col(ctx, "deduction", "D");
  const out = ctx.nextFree();
  return {
    title: { en: "Employee net salary", ru: "Зарплата сотрудника к выплате", uz: "Xodimning qo‘lga tegadigan maoshi" },
    summary: {
      en: "Net salary = base salary + bonus − deductions, calculated per employee, then totalled.",
      ru: "К выплате = оклад + премия − удержания, для каждого сотрудника, затем итог.",
      uz: "Qo‘lga tegadigan maosh = asosiy maosh + mukofot − ushlanmalar; har bir xodim uchun, so‘ng jami.",
    },
    formulas: [
      {
        label: { en: "Net salary per employee", ru: "К выплате по сотруднику", uz: "Har bir xodim uchun sof maosh" },
        formula: `=${b}${first}+${bo}${first}-${d}${first}`,
        explanation: {
          en: `Adds the base salary (${b}${first}) and bonus (${bo}${first}), then subtracts deductions (${d}${first}).`,
          ru: `Складывает оклад (${b}${first}) и премию (${bo}${first}) и вычитает удержания (${d}${first}).`,
          uz: `Asosiy maosh (${b}${first}) va mukofotni (${bo}${first}) qo‘shib, ushlanmalarni (${d}${first}) ayiradi.`,
        },
        targetCell: `${out}${first}`,
        fillDown: true,
      },
      {
        label: { en: "Total payroll", ru: "Фонд оплаты труда", uz: "Umumiy ish haqi fondi" },
        formula: `=SUM(${range(ctx, out)})`,
        explanation: { en: `Total of all net salaries in column ${out}.`, ru: `Сумма всех выплат в столбце ${out}.`, uz: `${out} ustunidagi barcha sof maoshlar yig‘indisi.` },
        targetCell: `${out}${last + 2}`,
        fillDown: false,
      },
    ],
    example: {
      en: "5 000 000 + 500 000 − 660 000 = 4 840 000.",
      ru: "5 000 000 + 500 000 − 660 000 = 4 840 000.",
      uz: "5 000 000 + 500 000 − 660 000 = 4 840 000.",
    },
    alternatives: [
      {
        formula: `=(${b}${first}+${bo}${first})*(1-12%)`,
        note: {
          en: "Example: deduct a flat 12% income tax instead of a deductions column (check your actual rate).",
          ru: "Пример: удержать фиксированный налог 12% вместо столбца удержаний (уточните вашу ставку).",
          uz: "Misol: ushlanmalar ustuni o‘rniga 12% daromad solig‘ini ayirish (haqiqiy stavkani tekshiring).",
        },
      },
      {
        formula: `=AVERAGE(${range(ctx, out)})`,
        note: { en: "Average salary.", ru: "Средняя зарплата.", uz: "O‘rtacha maosh." },
      },
    ],
  };
}

function inventory(ctx: Ctx): Draft {
  const { first, last } = ctx;
  if (ctx.cols.expected || ctx.cols.actual) {
    const e = col(ctx, "expected", "B");
    const a = col(ctx, "actual", "C");
    const diff = ctx.nextFree();
    const status = ctx.nextFree();
    return {
      title: { en: "Find missing inventory", ru: "Поиск недостачи товара", uz: "Kamomadni aniqlash" },
      summary: {
        en: "Compare expected (book) stock with the actual count; a positive difference means items are missing.",
        ru: "Сравните учётный остаток с фактическим; положительная разница означает недостачу.",
        uz: "Hisobdagi qoldiqni haqiqiy sanalgan qoldiq bilan solishtiring; musbat farq kamomadni bildiradi.",
      },
      formulas: [
        {
          label: { en: "Missing quantity", ru: "Недостача (шт.)", uz: "Kamomad miqdori" },
          formula: `=MAX(0,${e}${first}-${a}${first})`,
          explanation: {
            en: `Expected (${e}${first}) minus actual (${a}${first}). MAX(0, …) shows 0 instead of a negative number when there is a surplus.`,
            ru: `Учётный (${e}${first}) минус фактический (${a}${first}). MAX(0, …) показывает 0 вместо отрицательного числа при излишке.`,
            uz: `Hisobdagi (${e}${first}) minus haqiqiy (${a}${first}). MAX(0, …) ortiqcha bo‘lsa manfiy son o‘rniga 0 ko‘rsatadi.`,
          },
          targetCell: `${diff}${first}`,
          fillDown: true,
        },
        {
          label: { en: "Status", ru: "Статус", uz: "Holat" },
          formula: `=IF(${a}${first}<${e}${first},"${ctx.t({ en: "Missing", ru: "Недостача", uz: "Kamomad" })}",IF(${a}${first}>${e}${first},"${ctx.t({ en: "Surplus", ru: "Излишек", uz: "Ortiqcha" })}","OK"))`,
          explanation: {
            en: "Labels each row as missing, surplus or OK.",
            ru: "Помечает каждую строку: недостача, излишек или OK.",
            uz: "Har bir qatorni kamomad, ortiqcha yoki OK deb belgilaydi.",
          },
          targetCell: `${status}${first}`,
          fillDown: true,
        },
        {
          label: { en: "Total missing items", ru: "Всего недостача", uz: "Jami kamomad" },
          formula: `=SUM(${range(ctx, diff)})`,
          explanation: { en: `Sum of column ${diff}.`, ru: `Сумма по столбцу ${diff}.`, uz: `${diff} ustuni yig‘indisi.` },
          targetCell: `${diff}${last + 2}`,
          fillDown: false,
        },
      ],
      example: { en: "Expected 120, counted 112 → 8 missing.", ru: "По учёту 120, факт 112 → недостача 8.", uz: "Hisobda 120, sanalgan 112 → kamomad 8." },
      alternatives: [
        {
          formula: `=COUNTIF(${range(ctx, status)},"${ctx.t({ en: "Missing", ru: "Недостача", uz: "Kamomad" })}")`,
          note: { en: "How many products have a shortage.", ru: "Сколько позиций с недостачей.", uz: "Nechta mahsulotda kamomad bor." },
        },
      ],
    };
  }
  const o = col(ctx, "opening", "B");
  const rc = col(ctx, "received", "C");
  const s = col(ctx, "sold", "D");
  const bal = outputCol(ctx, "balance");
  return {
    title: { en: "Stock balance", ru: "Остаток на складе", uz: "Ombordagi qoldiq" },
    summary: {
      en: "Closing stock = opening stock + received − sold. Flag items that need reordering.",
      ru: "Конечный остаток = начальный + приход − расход. Отметьте позиции для дозаказа.",
      uz: "Yakuniy qoldiq = boshlang‘ich qoldiq + kirim − chiqim. Qayta buyurtma kerak bo‘lganlarini belgilang.",
    },
    formulas: [
      {
        label: { en: "Closing stock", ru: "Конечный остаток", uz: "Yakuniy qoldiq" },
        formula: `=${o}${first}+${rc}${first}-${s}${first}`,
        explanation: {
          en: `Opening (${o}${first}) plus received (${rc}${first}) minus sold (${s}${first}).`,
          ru: `Начальный (${o}${first}) плюс приход (${rc}${first}) минус расход (${s}${first}).`,
          uz: `Boshlang‘ich (${o}${first}) plus kirim (${rc}${first}) minus chiqim (${s}${first}).`,
        },
        targetCell: `${bal}${first}`,
        fillDown: true,
      },
      {
        label: { en: "Reorder flag", ru: "Нужен дозаказ", uz: "Qayta buyurtma belgisi" },
        formula: `=IF(${bal}${first}<10,"${ctx.t({ en: "Reorder", ru: "Заказать", uz: "Buyurtma" })}","OK")`,
        explanation: {
          en: "Shows a warning when fewer than 10 units remain (change 10 to your minimum).",
          ru: "Показывает предупреждение, если осталось меньше 10 шт. (замените 10 на ваш минимум).",
          uz: "10 donadan kam qolganda ogohlantiradi (10 ni o‘z minimumingizga almashtiring).",
        },
        targetCell: `${ctx.nextFree()}${first}`,
        fillDown: true,
      },
      {
        label: { en: "Total stock", ru: "Общий остаток", uz: "Jami qoldiq" },
        formula: `=SUM(${range(ctx, bal)})`,
        explanation: { en: `Sum of column ${bal}.`, ru: `Сумма по столбцу ${bal}.`, uz: `${bal} ustuni yig‘indisi.` },
        targetCell: `${bal}${last + 2}`,
        fillDown: false,
      },
    ],
    example: { en: "50 + 30 − 45 = 35 units left.", ru: "50 + 30 − 45 = 35 шт. в остатке.", uz: "50 + 30 − 45 = 35 dona qoldi." },
    alternatives: [
      {
        formula: `=COUNTIF(${range(ctx, bal)},"<10")`,
        note: { en: "Number of products below the minimum.", ru: "Количество позиций ниже минимума.", uz: "Minimumdan kam qolgan mahsulotlar soni." },
      },
    ],
  };
}

function expenses(ctx: Ctx): Draft {
  const { first, last } = ctx;
  const amt = col(ctx, "amount", "C");
  const hasDate = !!ctx.cols.date;
  const hasCat = !!ctx.cols.category;
  const formulas: Draft["formulas"] = [
    {
      label: { en: "Total expenses", ru: "Всего расходов", uz: "Jami xarajatlar" },
      formula: `=SUM(${range(ctx, amt)})`,
      explanation: { en: `Adds all amounts in column ${amt}.`, ru: `Складывает все суммы в столбце ${amt}.`, uz: `${amt} ustunidagi barcha summalarni qo‘shadi.` },
      targetCell: `${amt}${last + 2}`,
      fillDown: false,
    },
  ];
  const d = col(ctx, "date", "A");
  formulas.push({
    label: { en: "Expenses for one month", ru: "Расходы за месяц", uz: "Bir oylik xarajat" },
    formula: `=SUMIFS(${range(ctx, amt)},${range(ctx, d)},">="&DATE(2025,1,1),${range(ctx, d)},"<"&DATE(2025,2,1))`,
    explanation: {
      en: `Adds amounts whose date in column ${d} falls in January 2025. Change the two DATE(...) values for another month.`,
      ru: `Суммирует расходы, дата которых в столбце ${d} попадает в январь 2025. Для другого месяца измените оба DATE(...).`,
      uz: `${d} ustunidagi sanasi 2025-yil yanvariga to‘g‘ri keladigan summalarni qo‘shadi. Boshqa oy uchun ikkala DATE(...) ni o‘zgartiring.`,
    },
    targetCell: `${ctx.nextFree()}${first}`,
    fillDown: false,
  });
  if (hasCat) {
    const c = ctx.cols.category!;
    formulas.push({
      label: { en: "Expenses by category", ru: "Расходы по категории", uz: "Kategoriya bo‘yicha xarajat" },
      formula: `=SUMIF(${range(ctx, c)},"Rent",${range(ctx, amt)})`,
      explanation: {
        en: `Adds amounts where the category in column ${c} is "Rent". Replace "Rent" with any category.`,
        ru: `Суммирует расходы, где категория в столбце ${c} равна "Rent". Замените на нужную категорию.`,
        uz: `${c} ustunidagi kategoriya "Rent" bo‘lgan summalarni qo‘shadi. "Rent" ni kerakli kategoriyaga almashtiring.`,
      },
      targetCell: null,
      fillDown: false,
    });
  }
  return {
    title: { en: "Monthly expenses", ru: "Ежемесячные расходы", uz: "Oylik xarajatlar" },
    summary: {
      en: "Total all expenses, and use SUMIFS to total a single month" + (hasDate ? "." : " (needs a date column)."),
      ru: "Сложите все расходы и используйте SUMIFS (СУММЕСЛИМН) для отдельного месяца" + (hasDate ? "." : " (нужен столбец с датой)."),
      uz: "Barcha xarajatlarni qo‘shing va bitta oy uchun SUMIFS dan foydalaning" + (hasDate ? "." : " (sana ustuni kerak)."),
    },
    formulas,
    example: {
      en: "Rent 3 000 000 + Utilities 450 000 + Food 1 200 000 = 4 650 000.",
      ru: "Аренда 3 000 000 + Коммунальные 450 000 + Продукты 1 200 000 = 4 650 000.",
      uz: "Ijara 3 000 000 + Kommunal 450 000 + Oziq-ovqat 1 200 000 = 4 650 000.",
    },
    alternatives: [
      {
        formula: `=AVERAGE(${range(ctx, amt)})`,
        note: { en: "Average expense per entry.", ru: "Средний расход на запись.", uz: "Bitta yozuvga o‘rtacha xarajat." },
      },
      {
        formula: `=MAX(${range(ctx, amt)})`,
        note: { en: "Largest single expense.", ru: "Самый крупный расход.", uz: "Eng katta xarajat." },
      },
    ],
  };
}

function profit(ctx: Ctx): Draft {
  const { first, last } = ctx;
  const r = col(ctx, "revenue", "B");
  const c = col(ctx, "cost", "C");
  const p = ctx.nextFree();
  const m = ctx.nextFree();
  return {
    title: { en: "Profit and loss", ru: "Прибыль и убыток", uz: "Foyda va zarar" },
    summary: {
      en: "Profit = revenue − cost. Margin = profit ÷ revenue. Negative profit means a loss.",
      ru: "Прибыль = выручка − затраты. Маржа = прибыль ÷ выручка. Отрицательная прибыль — убыток.",
      uz: "Foyda = tushum − xarajat. Marja = foyda ÷ tushum. Manfiy foyda zarar degani.",
    },
    formulas: [
      {
        label: { en: "Profit per row", ru: "Прибыль по строке", uz: "Qator bo‘yicha foyda" },
        formula: `=${r}${first}-${c}${first}`,
        explanation: { en: `Revenue (${r}${first}) minus cost (${c}${first}).`, ru: `Выручка (${r}${first}) минус затраты (${c}${first}).`, uz: `Tushum (${r}${first}) minus xarajat (${c}${first}).` },
        targetCell: `${p}${first}`,
        fillDown: true,
      },
      {
        label: { en: "Profit margin %", ru: "Маржа, %", uz: "Foyda marjasi, %" },
        formula: `=IF(${r}${first}=0,0,(${r}${first}-${c}${first})/${r}${first})`,
        explanation: {
          en: "Profit as a share of revenue. IF avoids a #DIV/0! error when revenue is 0. Format the column as Percent.",
          ru: "Доля прибыли в выручке. IF (ЕСЛИ) защищает от ошибки #DIV/0! при нулевой выручке. Задайте процентный формат.",
          uz: "Foydaning tushumdagi ulushi. IF tushum 0 bo‘lganda #DIV/0! xatosining oldini oladi. Ustunni foiz formatiga o‘tkazing.",
        },
        targetCell: `${m}${first}`,
        fillDown: true,
      },
      {
        label: { en: "Total profit / loss", ru: "Итоговая прибыль / убыток", uz: "Jami foyda / zarar" },
        formula: `=SUM(${range(ctx, p)})`,
        explanation: { en: `Sum of column ${p}. A negative total is a loss.`, ru: `Сумма по столбцу ${p}. Отрицательный итог — убыток.`, uz: `${p} ustuni yig‘indisi. Manfiy natija — zarar.` },
        targetCell: `${p}${last + 2}`,
        fillDown: false,
      },
      {
        label: { en: "Result label", ru: "Подпись результата", uz: "Natija yorlig‘i" },
        formula: `=IF(SUM(${range(ctx, p)})>=0,"${ctx.t({ en: "Profit", ru: "Прибыль", uz: "Foyda" })}","${ctx.t({ en: "Loss", ru: "Убыток", uz: "Zarar" })}")`,
        explanation: { en: "Shows whether the period is profitable.", ru: "Показывает, прибыльный ли период.", uz: "Davr foydali yoki yo‘qligini ko‘rsatadi." },
        targetCell: `${m}${last + 2}`,
        fillDown: false,
      },
    ],
    example: {
      en: "Revenue 10 000 000 − cost 7 500 000 = 2 500 000 profit; margin 25%.",
      ru: "Выручка 10 000 000 − затраты 7 500 000 = прибыль 2 500 000; маржа 25%.",
      uz: "Tushum 10 000 000 − xarajat 7 500 000 = 2 500 000 foyda; marja 25%.",
    },
    alternatives: [
      {
        formula: `=SUM(${range(ctx, r)})-SUM(${range(ctx, c)})`,
        note: { en: "Total profit in one cell without a helper column.", ru: "Итоговая прибыль в одной ячейке.", uz: "Yordamchi ustunsiz jami foyda." },
      },
    ],
  };
}

function count(ctx: Ctx): Draft {
  const { last } = ctx;
  const n = col(ctx, "name", "A");
  const q = col(ctx, "quantity", "B");
  return {
    title: { en: "Count products sold", ru: "Подсчёт проданных товаров", uz: "Sotilgan mahsulotlarni sanash" },
    summary: {
      en: "COUNTA counts product rows; SUM adds units sold; COUNTIF counts rows meeting a condition.",
      ru: "COUNTA (СЧЁТЗ) считает строки товаров; SUM суммирует проданные единицы; COUNTIF (СЧЁТЕСЛИ) считает по условию.",
      uz: "COUNTA mahsulot qatorlarini sanaydi; SUM sotilgan donalarni qo‘shadi; COUNTIF shart bo‘yicha sanaydi.",
    },
    formulas: [
      {
        label: { en: "Number of products", ru: "Количество позиций", uz: "Mahsulotlar soni" },
        formula: `=COUNTA(${range(ctx, n)})`,
        explanation: { en: `Counts non-empty cells in column ${n}.`, ru: `Считает непустые ячейки в столбце ${n}.`, uz: `${n} ustunidagi bo‘sh bo‘lmagan katakchalarni sanaydi.` },
        targetCell: `${n}${last + 2}`,
        fillDown: false,
      },
      {
        label: { en: "Total units sold", ru: "Всего продано единиц", uz: "Jami sotilgan dona" },
        formula: `=SUM(${range(ctx, q)})`,
        explanation: { en: `Adds all quantities in column ${q}.`, ru: `Суммирует количество в столбце ${q}.`, uz: `${q} ustunidagi miqdorlarni qo‘shadi.` },
        targetCell: `${q}${last + 2}`,
        fillDown: false,
      },
      {
        label: { en: "Products with sales", ru: "Позиции с продажами", uz: "Sotuvi bor mahsulotlar" },
        formula: `=COUNTIF(${range(ctx, q)},">0")`,
        explanation: { en: "Counts rows where the quantity is greater than 0.", ru: "Считает строки, где количество больше 0.", uz: "Miqdori 0 dan katta qatorlarni sanaydi." },
        targetCell: null,
        fillDown: false,
      },
    ],
    example: { en: "Water 10 + Juice 5 + Bread 8 = 23 units, 3 products.", ru: "Вода 10 + Сок 5 + Хлеб 8 = 23 шт., 3 позиции.", uz: "Suv 10 + Sharbat 5 + Non 8 = 23 dona, 3 mahsulot." },
    alternatives: [
      {
        formula: `=SUMIF(${range(ctx, n)},"Water",${range(ctx, q)})`,
        note: { en: "Units sold of one specific product.", ru: "Продано единиц конкретного товара.", uz: "Bitta mahsulotning sotilgan donasi." },
      },
    ],
  };
}

function discount(ctx: Ctx): Draft {
  const { first, last } = ctx;
  const p = col(ctx, "price", "B");
  const d = col(ctx, "discount", "C");
  const out = ctx.nextFree();
  return {
    title: { en: "Price after discount", ru: "Цена со скидкой", uz: "Chegirmadan keyingi narx" },
    summary: {
      en: "Discounted price = price × (1 − discount %). Enter discounts as percentages (e.g. 15%).",
      ru: "Цена со скидкой = цена × (1 − скидка %). Вводите скидку в процентах (например, 15%).",
      uz: "Chegirmali narx = narx × (1 − chegirma %). Chegirmani foizda kiriting (masalan, 15%).",
    },
    formulas: [
      {
        label: { en: "Price after discount", ru: "Цена со скидкой", uz: "Chegirmali narx" },
        formula: `=${p}${first}*(1-${d}${first})`,
        explanation: {
          en: `Takes the price in ${p}${first} and reduces it by the discount in ${d}${first}.`,
          ru: `Берёт цену из ${p}${first} и уменьшает её на скидку из ${d}${first}.`,
          uz: `${p}${first} dagi narxni ${d}${first} dagi chegirmaga kamaytiradi.`,
        },
        targetCell: `${out}${first}`,
        fillDown: true,
      },
      {
        label: { en: "Discount amount", ru: "Сумма скидки", uz: "Chegirma summasi" },
        formula: `=${p}${first}*${d}${first}`,
        explanation: { en: "How much money the discount saves.", ru: "Сколько денег экономит скидка.", uz: "Chegirma qancha pul tejashini ko‘rsatadi." },
        targetCell: `${ctx.nextFree()}${first}`,
        fillDown: true,
      },
    ],
    example: { en: "100 000 × (1 − 15%) = 85 000; discount = 15 000.", ru: "100 000 × (1 − 15%) = 85 000; скидка = 15 000.", uz: "100 000 × (1 − 15%) = 85 000; chegirma = 15 000." },
    alternatives: [
      {
        formula: `=${p}${first}*(1-15%)`,
        note: { en: "Same 15% discount for every row (no discount column).", ru: "Одинаковая скидка 15% для всех строк.", uz: "Barcha qatorlar uchun bir xil 15% chegirma." },
      },
      {
        formula: `=SUM(${range(ctx, out)})`,
        note: { en: `Total after discounts (rows ${first}–${last}).`, ru: `Итого со скидками (строки ${first}–${last}).`, uz: `Chegirmalardan keyingi jami (${first}–${last}-qatorlar).` },
      },
    ],
  };
}

function percent(ctx: Ctx): Draft {
  const { first } = ctx;
  const v = col(ctx, "amount", "B");
  const out = ctx.nextFree();
  return {
    title: { en: "Percentage of total", ru: "Доля от общего итога", uz: "Umumiy summadagi ulush" },
    summary: {
      en: "Divide each value by the column total. The $ signs lock the total range so it does not move when copied.",
      ru: "Разделите каждое значение на итог столбца. Знаки $ фиксируют диапазон при копировании.",
      uz: "Har bir qiymatni ustun jamiga bo‘ling. $ belgilari nusxalashda diapazonni qotirib qo‘yadi.",
    },
    formulas: [
      {
        label: { en: "Share of total", ru: "Доля от итога", uz: "Jamidagi ulush" },
        formula: `=${v}${first}/SUM(${absRange(ctx, v)})`,
        explanation: {
          en: `Value in ${v}${first} divided by the total of column ${v}. Format the column as Percent.`,
          ru: `Значение ${v}${first}, делённое на итог столбца ${v}. Задайте процентный формат.`,
          uz: `${v}${first} dagi qiymat ${v} ustuni jamiga bo‘linadi. Ustunni foiz formatiga o‘tkazing.`,
        },
        targetCell: `${out}${first}`,
        fillDown: true,
      },
    ],
    example: { en: "50 000 ÷ 142 000 = 35.2%.", ru: "50 000 ÷ 142 000 = 35,2%.", uz: "50 000 ÷ 142 000 = 35,2%." },
    alternatives: [
      {
        formula: `=(C${first}-B${first})/B${first}`,
        note: {
          en: "Percent change from an old value (B) to a new value (C) — example columns.",
          ru: "Изменение в % от старого значения (B) к новому (C) — пример столбцов.",
          uz: "Eski qiymatdan (B) yangi qiymatga (C) foiz o‘zgarishi — misol ustunlar.",
        },
      },
      {
        formula: `=${v}${first}*20%`,
        note: { en: "20% of a value.", ru: "20% от значения.", uz: "Qiymatning 20% i." },
      },
    ],
  };
}

function simpleAggregate(ctx: Ctx, kind: "average" | "sum" | "maxmin"): Draft {
  const target = (["revenue", "amount", "quantity", "price", "salary"] as Role[]).find((r) => ctx.cols[r]);
  const c = target ? ctx.cols[target]! : col(ctx, "amount", "B");
  const n = ctx.cols.name;
  const r = range(ctx, c);
  const cell = `${c}${ctx.last + 2}`;
  if (kind === "average") {
    return {
      title: { en: "Average value", ru: "Среднее значение", uz: "O‘rtacha qiymat" },
      summary: { en: `Average of column ${c}.`, ru: `Среднее по столбцу ${c}.`, uz: `${c} ustunining o‘rtachasi.` },
      formulas: [
        {
          label: { en: "Average", ru: "Среднее", uz: "O‘rtacha" },
          formula: `=AVERAGE(${r})`,
          explanation: {
            en: "Adds the numbers and divides by how many there are. Empty cells and text are ignored.",
            ru: "Складывает числа и делит на их количество. Пустые ячейки и текст игнорируются.",
            uz: "Sonlarni qo‘shib, ularning soniga bo‘ladi. Bo‘sh katakchalar va matn hisobga olinmaydi.",
          },
          targetCell: cell,
          fillDown: false,
        },
      ],
      example: { en: "(50 000 + 60 000 + 32 000) ÷ 3 = 47 333.", ru: "(50 000 + 60 000 + 32 000) ÷ 3 = 47 333.", uz: "(50 000 + 60 000 + 32 000) ÷ 3 = 47 333." },
      alternatives: [
        { formula: `=ROUND(AVERAGE(${r}),0)`, note: { en: "Rounded to a whole number.", ru: "Округлено до целого.", uz: "Butun songacha yaxlitlangan." } },
        { formula: `=AVERAGEIF(${r},">0")`, note: { en: "Ignore zeros.", ru: "Без учёта нулей.", uz: "Nollarni hisobga olmaslik." } },
      ],
    };
  }
  if (kind === "maxmin") {
    const alts: Draft["alternatives"] = [{ formula: `=MIN(${r})`, note: { en: "Smallest value.", ru: "Наименьшее значение.", uz: "Eng kichik qiymat." } }];
    if (n)
      alts.unshift({
        formula: `=INDEX(${range(ctx, n)},MATCH(MAX(${r}),${r},0))`,
        note: { en: "Name of the item with the highest value.", ru: "Название позиции с максимальным значением.", uz: "Eng katta qiymatli mahsulot nomi." },
      });
    return {
      title: { en: "Highest and lowest values", ru: "Максимум и минимум", uz: "Eng katta va eng kichik qiymat" },
      summary: { en: `MAX and MIN of column ${c}.`, ru: `MAX (МАКС) и MIN (МИН) по столбцу ${c}.`, uz: `${c} ustunining MAX va MIN qiymatlari.` },
      formulas: [
        {
          label: { en: "Maximum", ru: "Максимум", uz: "Maksimum" },
          formula: `=MAX(${r})`,
          explanation: { en: `Largest number in column ${c}.`, ru: `Наибольшее число в столбце ${c}.`, uz: `${c} ustunidagi eng katta son.` },
          targetCell: cell,
          fillDown: false,
        },
      ],
      example: { en: "MAX(50 000; 60 000; 32 000) = 60 000.", ru: "МАКС(50 000; 60 000; 32 000) = 60 000.", uz: "MAX(50 000; 60 000; 32 000) = 60 000." },
      alternatives: alts,
    };
  }
  return {
    title: { en: "Column total", ru: "Итог по столбцу", uz: "Ustun jami" },
    summary: { en: `Sum of column ${c}.`, ru: `Сумма по столбцу ${c}.`, uz: `${c} ustuni yig‘indisi.` },
    formulas: [
      {
        label: { en: "Total", ru: "Итого", uz: "Jami" },
        formula: `=SUM(${r})`,
        explanation: {
          en: `Adds every number in ${r}. Text and empty cells are ignored.`,
          ru: `Складывает все числа в ${r}. Текст и пустые ячейки игнорируются.`,
          uz: `${r} dagi barcha sonlarni qo‘shadi. Matn va bo‘sh katakchalar hisobga olinmaydi.`,
        },
        targetCell: cell,
        fillDown: false,
      },
    ],
    example: { en: "50 000 + 60 000 + 32 000 = 142 000.", ru: "50 000 + 60 000 + 32 000 = 142 000.", uz: "50 000 + 60 000 + 32 000 = 142 000." },
    alternatives: [
      { formula: `=SUMIF(${r},">0")`, note: { en: "Only positive values.", ru: "Только положительные значения.", uz: "Faqat musbat qiymatlar." } },
      { formula: `=SUBTOTAL(9,${r})`, note: { en: "Ignores rows hidden by a filter (Excel only).", ru: "Не учитывает скрытые фильтром строки (в Excel).", uz: "Filtr bilan yashirilgan qatorlarni hisobga olmaydi (Excelda)." } },
    ],
  };
}

function lookup(ctx: Ctx): Draft {
  const { first } = ctx;
  const n = col(ctx, "name", "A");
  const p = col(ctx, "price", "C");
  const r = `${n}${first}:${n}${ctx.last}`;
  return {
    title: { en: "Look up a value", ru: "Поиск значения", uz: "Qiymatni qidirish" },
    summary: {
      en: "Find a product by name and return its price. XLOOKUP is the modern way; VLOOKUP works in older Excel.",
      ru: "Найдите товар по названию и верните его цену. XLOOKUP (ПРОСМОТРX) — современный способ; VLOOKUP (ВПР) — для старых версий.",
      uz: "Mahsulotni nomi bo‘yicha toping va narxini qaytaring. XLOOKUP — zamonaviy usul; VLOOKUP eski Excel uchun.",
    },
    formulas: [
      {
        label: { en: "Price by product name", ru: "Цена по названию", uz: "Nomi bo‘yicha narx" },
        formula: `=XLOOKUP("Juice",${absRange(ctx, n)},${absRange(ctx, p)},"${ctx.t({ en: "Not found", ru: "Не найдено", uz: "Topilmadi" })}")`,
        explanation: {
          en: `Searches column ${n} for "Juice" and returns the value from column ${p} in the same row. Replace "Juice" with a cell reference such as G2.`,
          ru: `Ищет "Juice" в столбце ${n} и возвращает значение из столбца ${p} той же строки. Замените "Juice" ссылкой на ячейку, например G2.`,
          uz: `${n} ustunidan "Juice" ni qidiradi va shu qatordagi ${p} ustuni qiymatini qaytaradi. "Juice" o‘rniga G2 kabi katakcha manzilini yozing.`,
        },
        targetCell: null,
        fillDown: false,
      },
    ],
    example: { en: 'XLOOKUP("Juice", …) → 12 000.', ru: 'ПРОСМОТРX("Juice"; …) → 12 000.', uz: 'XLOOKUP("Juice", …) → 12 000.' },
    alternatives: [
      {
        formula: `=VLOOKUP("Juice",$${n}$${first}:$${p}$${ctx.last},${lettersToCol(p) - lettersToCol(n) + 1},FALSE)`,
        note: { en: "Older Excel. FALSE means exact match.", ru: "Для старых версий. FALSE (ЛОЖЬ) — точное совпадение.", uz: "Eski Excel uchun. FALSE — aniq moslik." },
      },
      {
        formula: `=INDEX(${absRange(ctx, p)},MATCH("Juice",${r},0))`,
        note: { en: "Works in every Excel version.", ru: "Работает во всех версиях Excel.", uz: "Excelning barcha versiyalarida ishlaydi." },
      },
    ],
  };
}

function vat(ctx: Ctx): Draft {
  const { first } = ctx;
  const a = col(ctx, "amount", "B");
  const out = ctx.nextFree();
  return {
    title: { en: "VAT calculation", ru: "Расчёт НДС", uz: "QQS hisobi" },
    summary: {
      en: "Example uses a 12% VAT rate — replace it with the rate that applies to you.",
      ru: "В примере ставка НДС 12% — замените её на вашу ставку.",
      uz: "Misolda QQS stavkasi 12% — uni o‘zingizga tegishli stavkaga almashtiring.",
    },
    formulas: [
      {
        label: { en: "VAT amount", ru: "Сумма НДС", uz: "QQS summasi" },
        formula: `=${a}${first}*12%`,
        explanation: { en: `12% of the amount in ${a}${first}.`, ru: `12% от суммы в ${a}${first}.`, uz: `${a}${first} dagi summaning 12% i.` },
        targetCell: `${out}${first}`,
        fillDown: true,
      },
      {
        label: { en: "Amount including VAT", ru: "Сумма с НДС", uz: "QQS bilan summa" },
        formula: `=${a}${first}*(1+12%)`,
        explanation: { en: "Amount plus 12% VAT.", ru: "Сумма плюс 12% НДС.", uz: "Summa plyus 12% QQS." },
        targetCell: `${ctx.nextFree()}${first}`,
        fillDown: true,
      },
    ],
    example: { en: "1 000 000 × 12% = 120 000 VAT; total 1 120 000.", ru: "1 000 000 × 12% = 120 000 НДС; итого 1 120 000.", uz: "1 000 000 × 12% = 120 000 QQS; jami 1 120 000." },
    alternatives: [
      {
        formula: `=${a}${first}*12/112`,
        note: { en: "Extract VAT from an amount that already includes it.", ru: "Выделить НДС из суммы, которая уже его включает.", uz: "QQS kiritilgan summadan QQSni ajratib olish." },
      },
    ],
  };
}

const BUILDERS: Record<Intent, (ctx: Ctx) => Draft> = {
  revenue,
  salary,
  inventory,
  expenses,
  profit,
  count,
  discount,
  percent,
  lookup,
  vat,
  average: (ctx) => simpleAggregate(ctx, "average"),
  maxmin: (ctx) => simpleAggregate(ctx, "maxmin"),
  sum: (ctx) => simpleAggregate(ctx, "sum"),
};

function clarification(lang: Language): FormulaResult {
  const t = (x: Text) => x[lang];
  return {
    title: t({ en: "I need a bit more detail", ru: "Нужно немного больше деталей", uz: "Biroz ko‘proq ma’lumot kerak" }),
    summary: t({
      en: "I couldn't tell which calculation you need. Describe the goal and where your data is.",
      ru: "Не удалось понять, какой расчёт нужен. Опишите цель и где находятся данные.",
      uz: "Qanday hisob kerakligini aniqlay olmadim. Maqsadni va ma’lumotlar qayerdaligini yozing.",
    }),
    needsClarification: true,
    clarifyingQuestion: t({
      en: 'What do you want to calculate, and which columns hold the data? Example: "Calculate total sales. Quantity is in column B and price is in column C."',
      ru: 'Что нужно посчитать и в каких столбцах данные? Пример: «Посчитай выручку. Количество в столбце B, цена в столбце C».',
      uz: 'Nimani hisoblash kerak va ma’lumotlar qaysi ustunlarda? Misol: "Savdo tushumini hisobla. Miqdor B ustunda, narx C ustunda."',
    }),
    isExample: true,
    assumptions: [],
    formulas: [
      {
        label: t({ en: "Example: total of a column", ru: "Пример: сумма столбца", uz: "Misol: ustun yig‘indisi" }),
        formula: "=SUM(B2:B100)",
        explanation: t({
          en: "Example only — adds the numbers in B2:B100. Replace B with your column.",
          ru: "Только пример — складывает числа в B2:B100. Замените B на ваш столбец.",
          uz: "Faqat misol — B2:B100 dagi sonlarni qo‘shadi. B ni o‘z ustuningizga almashtiring.",
        }),
        targetCell: null,
        fillDown: false,
      },
    ],
    cellReferences: [],
    exampleCalculation: "",
    pasteInstructions: [],
    alternatives: [],
  };
}

export function generateDemoFormula(
  prompt: string,
  lang: Language,
  context?: SheetContext | null,
): FormulaResult {
  const ctx = buildCtx(prompt, lang, context);
  const intent = detectIntent(prompt, ctx.cols);
  if (!intent) return clarification(lang);

  const draft = BUILDERS[intent](ctx);
  const t = ctx.t;
  const isExample = ctx.assumed.length > 0;

  const assumptions: string[] = ctx.assumed.map((role) =>
    t({
      en: `Column ${ctx.cols[role]} is assumed to contain ${ROLE_LABEL[role].en} — change it if your data is elsewhere.`,
      ru: `Предполагается, что в столбце ${ctx.cols[role]} — ${ROLE_LABEL[role].ru}. Измените, если данные в другом месте.`,
      uz: `${ctx.cols[role]} ustunida ${ROLE_LABEL[role].uz} bor deb faraz qilindi — ma’lumot boshqa joyda bo‘lsa, o‘zgartiring.`,
    }),
  );
  if (!ctx.rangeKnown) {
    assumptions.push(
      t({
        en: `Row 1 holds headers and data runs from row ${ctx.first} to row ${ctx.last}. Adjust the row numbers to your data.`,
        ru: `В строке 1 — заголовки, данные со строки ${ctx.first} по ${ctx.last}. Подправьте номера строк под свои данные.`,
        uz: `1-qatorda sarlavhalar, ma’lumotlar ${ctx.first}-qatordan ${ctx.last}-qatorgacha. Qator raqamlarini o‘z ma’lumotingizga moslang.`,
      }),
    );
  }

  const usedCols = new Set<string>();
  for (const f of draft.formulas) for (const m of f.formula.matchAll(/\$?([A-Z]{1,2})\$?\d+/g)) usedCols.add(m[1]);
  const roleByCol = new Map<string, Role>();
  for (const [role, letter] of Object.entries(ctx.cols) as [Role, string][]) if (!roleByCol.has(letter)) roleByCol.set(letter, role);

  const cellReferences = [...usedCols].sort().map((letter) => {
    const role = roleByCol.get(letter);
    const header = ctx.headers.get(letter);
    const meaning = header
      ? `"${header}"`
      : role
        ? t(ROLE_LABEL[role])
        : t({ en: "result column (new)", ru: "столбец результата (новый)", uz: "natija ustuni (yangi)" });
    return { ref: `${letter}${ctx.first}:${letter}${ctx.last}`, meaning };
  });

  const result: FormulaResult = {
    title: t(draft.title),
    summary: t(draft.summary),
    needsClarification: false,
    clarifyingQuestion: isExample
      ? t({
          en: "Which columns contain your data? Tell me (e.g. “quantity is in column B”) or upload your file and I'll use the real layout.",
          ru: "В каких столбцах ваши данные? Укажите (например, «количество в столбце B») или загрузите файл — я учту реальную структуру.",
          uz: "Ma’lumotlaringiz qaysi ustunlarda? Yozing (masalan, “miqdor B ustunda”) yoki faylni yuklang — haqiqiy tuzilishdan foydalanaman.",
        })
      : null,
    isExample,
    assumptions,
    formulas: draft.formulas.map<FormulaItem>((f) => ({
      label: t(f.label),
      formula: f.formula,
      explanation: t(f.explanation),
      targetCell: f.targetCell,
      fillDown: f.fillDown,
    })),
    cellReferences,
    exampleCalculation: t(draft.example),
    pasteInstructions: pasteSteps(ctx, draft),
    alternatives: draft.alternatives.map((a) => ({ formula: a.formula, note: t(a.note) })),
  };
  return result;
}

