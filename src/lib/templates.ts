import { dateToSerial } from "./formula";
import type { ColumnFormat, Language, SheetData } from "./types";

type Text = Record<Language, string>;

export interface Template {
  id: string;
  icon: "shopping" | "users" | "package" | "wallet" | "trending" | "tag";
  title: Text;
  description: Text;
  formulas: string[];
  build: (lang: Language) => SheetData;
}

const pick = (t: Text, lang: Language) => t[lang];

function sheet(name: string, headers: string[], rows: string[][], formats: ColumnFormat[]): SheetData {
  return { name, cells: [headers, ...rows], formats };
}

export const TEMPLATES: Template[] = [
  {
    id: "sales",
    icon: "shopping",
    title: { en: "Sales calculator", ru: "Калькулятор продаж", uz: "Savdo kalkulyatori" },
    description: {
      en: "Revenue per product, total quantity, total revenue, average sale, discounts and profit margin.",
      ru: "Выручка по товарам, общее количество и выручка, средняя продажа, скидки и маржа.",
      uz: "Mahsulot bo‘yicha tushum, jami miqdor va tushum, o‘rtacha savdo, chegirma va marja.",
    },
    formulas: ["=B2*C2", "=D2*(1-E2)", "=F2-B2*G2", "=SUM(D2:D4)", "=AVERAGE(D2:D4)"],
    build: (lang) => {
      const t = (x: Text) => pick(x, lang);
      const products = lang === "ru" ? ["Вода", "Сок", "Хлеб"] : lang === "uz" ? ["Suv", "Sharbat", "Non"] : ["Water", "Juice", "Bread"];
      return sheet(
        t({ en: "Sales", ru: "Продажи", uz: "Savdo" }),
        [
          t({ en: "Product", ru: "Товар", uz: "Mahsulot" }),
          t({ en: "Quantity", ru: "Количество", uz: "Miqdor" }),
          t({ en: "Unit Price", ru: "Цена за ед.", uz: "Birlik narxi" }),
          t({ en: "Total Revenue", ru: "Выручка", uz: "Jami tushum" }),
          t({ en: "Discount %", ru: "Скидка %", uz: "Chegirma %" }),
          t({ en: "Net Revenue", ru: "Выручка со скидкой", uz: "Chegirmadan keyin" }),
          t({ en: "Unit Cost", ru: "Себестоимость ед.", uz: "Birlik tannarxi" }),
          t({ en: "Profit", ru: "Прибыль", uz: "Foyda" }),
          t({ en: "Margin %", ru: "Маржа %", uz: "Marja %" }),
        ],
        [
          [products[0], "10", "5000", "=B2*C2", "0", "=D2*(1-E2)", "3500", "=F2-B2*G2", "=IF(F2=0,0,H2/F2)"],
          [products[1], "5", "12000", "=B3*C3", "0.1", "=D3*(1-E3)", "8000", "=F3-B3*G3", "=IF(F3=0,0,H3/F3)"],
          [products[2], "8", "4000", "=B4*C4", "0.05", "=D4*(1-E4)", "2500", "=F4-B4*G4", "=IF(F4=0,0,H4/F4)"],
          ["", "", "", "", "", "", "", "", ""],
          [t({ en: "Total", ru: "Итого", uz: "Jami" }), "=SUM(B2:B4)", "", "=SUM(D2:D4)", "", "=SUM(F2:F4)", "", "=SUM(H2:H4)", "=IF(F6=0,0,H6/F6)"],
          [t({ en: "Average sale", ru: "Средняя продажа", uz: "O‘rtacha savdo" }), "", "", "=AVERAGE(D2:D4)", "", "=AVERAGE(F2:F4)", "", "", ""],
          [t({ en: "Products", ru: "Позиций", uz: "Mahsulotlar soni" }), "=COUNTA(A2:A4)", "", "", "", "", "", "", ""],
        ],
        ["general", "general", "currency", "currency", "percent", "currency", "currency", "currency", "percent"],
      );
    },
  },
  {
    id: "payroll",
    icon: "users",
    title: { en: "Employee payroll", ru: "Расчёт зарплаты", uz: "Xodimlar ish haqi" },
    description: {
      en: "Base salary, bonus, overtime above 160 h, 12% income tax and net pay per employee.",
      ru: "Оклад, премия, сверхурочные свыше 160 ч, налог 12% и сумма к выплате.",
      uz: "Asosiy maosh, mukofot, 160 soatdan ortiq ish, 12% daromad solig‘i va qo‘lga tegadigan summa.",
    },
    formulas: ["=IF(D2>160,(D2-160)*B2/160*1.5,0)", "=B2+C2+E2", "=F2*12%", "=F2-G2"],
    build: (lang) => {
      const t = (x: Text) => pick(x, lang);
      const names = ["Aziza Karimova", "Bekzod Rahimov", "Dilnoza Tosheva", "Jasur Aliyev"];
      const rows = [
        ["5000000", "500000", "168"],
        ["6500000", "0", "160"],
        ["4200000", "300000", "175"],
        ["8000000", "1000000", "152"],
      ].map((r, i) => {
        const n = i + 2;
        return [names[i], ...r, `=IF(D${n}>160,(D${n}-160)*B${n}/160*1.5,0)`, `=B${n}+C${n}+E${n}`, `=F${n}*12%`, `=F${n}-G${n}`];
      });
      return sheet(
        t({ en: "Payroll", ru: "Зарплата", uz: "Ish haqi" }),
        [
          t({ en: "Employee", ru: "Сотрудник", uz: "Xodim" }),
          t({ en: "Base salary", ru: "Оклад", uz: "Asosiy maosh" }),
          t({ en: "Bonus", ru: "Премия", uz: "Mukofot" }),
          t({ en: "Hours", ru: "Часы", uz: "Soat" }),
          t({ en: "Overtime pay", ru: "Сверхурочные", uz: "Qo‘shimcha ish haqi" }),
          t({ en: "Gross pay", ru: "Начислено", uz: "Hisoblangan" }),
          t({ en: "Income tax 12%", ru: "Налог 12%", uz: "Soliq 12%" }),
          t({ en: "Net pay", ru: "К выплате", uz: "Qo‘lga tegadi" }),
        ],
        [
          ...rows,
          ["", "", "", "", "", "", "", ""],
          [t({ en: "Total", ru: "Итого", uz: "Jami" }), "=SUM(B2:B5)", "=SUM(C2:C5)", "=SUM(D2:D5)", "=SUM(E2:E5)", "=SUM(F2:F5)", "=SUM(G2:G5)", "=SUM(H2:H5)"],
          [t({ en: "Average", ru: "Среднее", uz: "O‘rtacha" }), "=AVERAGE(B2:B5)", "", "=AVERAGE(D2:D5)", "", "", "", "=AVERAGE(H2:H5)"],
        ],
        ["general", "currency", "currency", "general", "currency", "currency", "currency", "currency"],
      );
    },
  },
  {
    id: "inventory",
    icon: "package",
    title: { en: "Inventory & warehouse", ru: "Склад и остатки", uz: "Ombor va qoldiqlar" },
    description: {
      en: "Closing stock, reorder alerts and missing items found during a stock count.",
      ru: "Конечный остаток, сигнал дозаказа и недостача по итогам инвентаризации.",
      uz: "Yakuniy qoldiq, qayta buyurtma ogohlantirishi va inventarizatsiyadagi kamomad.",
    },
    formulas: ["=B2+C2-D2", '=IF(E2<F2,"Reorder","OK")', "=MAX(0,E2-H2)", '=COUNTIF(G2:G6,"Reorder")'],
    build: (lang) => {
      const t = (x: Text) => pick(x, lang);
      const reorder = t({ en: "Reorder", ru: "Заказать", uz: "Buyurtma" });
      const items =
        lang === "ru" ? ["Сахар 1 кг", "Мука 2 кг", "Масло 1 л", "Рис 1 кг", "Чай 100 г"]
        : lang === "uz" ? ["Shakar 1 kg", "Un 2 kg", "Yog‘ 1 l", "Guruch 1 kg", "Choy 100 g"]
        : ["Sugar 1 kg", "Flour 2 kg", "Oil 1 L", "Rice 1 kg", "Tea 100 g"];
      const data = [
        ["120", "50", "95", "20", "73"],
        ["80", "0", "64", "25", "16"],
        ["60", "40", "70", "15", "30"],
        ["200", "100", "150", "40", "146"],
        ["45", "0", "38", "10", "7"],
      ];
      const rows = data.map((d, i) => {
        const n = i + 2;
        return [items[i], d[0], d[1], d[2], `=B${n}+C${n}-D${n}`, d[3], `=IF(E${n}<F${n},"${reorder}","OK")`, d[4], `=MAX(0,E${n}-H${n})`];
      });
      return sheet(
        t({ en: "Inventory", ru: "Склад", uz: "Ombor" }),
        [
          t({ en: "Product", ru: "Товар", uz: "Mahsulot" }),
          t({ en: "Opening stock", ru: "Начальный остаток", uz: "Boshlang‘ich qoldiq" }),
          t({ en: "Received", ru: "Приход", uz: "Kirim" }),
          t({ en: "Sold", ru: "Продано", uz: "Sotilgan" }),
          t({ en: "Closing stock", ru: "Конечный остаток", uz: "Yakuniy qoldiq" }),
          t({ en: "Min stock", ru: "Мин. остаток", uz: "Minimal qoldiq" }),
          t({ en: "Status", ru: "Статус", uz: "Holat" }),
          t({ en: "Counted", ru: "Факт", uz: "Sanalgan" }),
          t({ en: "Missing", ru: "Недостача", uz: "Kamomad" }),
        ],
        [
          ...rows,
          ["", "", "", "", "", "", "", "", ""],
          [t({ en: "Total", ru: "Итого", uz: "Jami" }), "=SUM(B2:B6)", "=SUM(C2:C6)", "=SUM(D2:D6)", "=SUM(E2:E6)", "", `=COUNTIF(G2:G6,"${reorder}")`, "=SUM(H2:H6)", "=SUM(I2:I6)"],
        ],
        ["general", "general", "general", "general", "general", "general", "general", "general", "general"],
      );
    },
  },
  {
    id: "expenses",
    icon: "wallet",
    title: { en: "Monthly expenses", ru: "Ежемесячные расходы", uz: "Oylik xarajatlar" },
    description: {
      en: "Expense log with totals per month (SUMIFS) and per category (SUMIF).",
      ru: "Журнал расходов с итогами по месяцам (СУММЕСЛИМН) и категориям (СУММЕСЛИ).",
      uz: "Oylar (SUMIFS) va kategoriyalar (SUMIF) bo‘yicha jami bilan xarajatlar jurnali.",
    },
    formulas: ['=SUMIFS(C2:C11,A2:A11,">="&DATE(2025,1,1),A2:A11,"<"&DATE(2025,2,1))', '=SUMIF(B2:B11,"Rent",C2:C11)'],
    build: (lang) => {
      const t = (x: Text) => pick(x, lang);
      const cat = {
        rent: t({ en: "Rent", ru: "Аренда", uz: "Ijara" }),
        util: t({ en: "Utilities", ru: "Коммунальные", uz: "Kommunal" }),
        food: t({ en: "Food", ru: "Продукты", uz: "Oziq-ovqat" }),
        transport: t({ en: "Transport", ru: "Транспорт", uz: "Transport" }),
        internet: t({ en: "Internet", ru: "Интернет", uz: "Internet" }),
      };
      const rows: [number, number, string, string][] = [
        [1, 3, cat.rent, "3000000"],
        [1, 8, cat.food, "650000"],
        [1, 12, cat.util, "420000"],
        [1, 18, cat.transport, "180000"],
        [1, 25, cat.internet, "150000"],
        [2, 3, cat.rent, "3000000"],
        [2, 9, cat.food, "720000"],
        [2, 13, cat.util, "460000"],
        [2, 20, cat.transport, "210000"],
        [2, 25, cat.internet, "150000"],
      ];
      return sheet(
        t({ en: "Expenses", ru: "Расходы", uz: "Xarajatlar" }),
        [t({ en: "Date", ru: "Дата", uz: "Sana" }), t({ en: "Category", ru: "Категория", uz: "Kategoriya" }), t({ en: "Amount", ru: "Сумма", uz: "Summa" })],
        [
          ...rows.map(([m, d, c, a]) => [String(dateToSerial(2025, m, d)), c, a]),
          ["", "", ""],
          [t({ en: "Total", ru: "Итого", uz: "Jami" }), "", "=SUM(C2:C11)"],
          [t({ en: "January", ru: "Январь", uz: "Yanvar" }), "", '=SUMIFS(C2:C11,A2:A11,">="&DATE(2025,1,1),A2:A11,"<"&DATE(2025,2,1))'],
          [t({ en: "February", ru: "Февраль", uz: "Fevral" }), "", '=SUMIFS(C2:C11,A2:A11,">="&DATE(2025,2,1),A2:A11,"<"&DATE(2025,3,1))'],
          [cat.rent, "", `=SUMIF(B2:B11,"${cat.rent}",C2:C11)`],
          [t({ en: "Largest expense", ru: "Крупнейший расход", uz: "Eng katta xarajat" }), "", "=MAX(C2:C11)"],
        ],
        ["date", "general", "currency"],
      );
    },
  },
  {
    id: "pnl",
    icon: "trending",
    title: { en: "Profit & loss", ru: "Прибыли и убытки", uz: "Foyda va zarar" },
    description: {
      en: "Monthly revenue, costs, gross and net profit, margin and a profit/loss label.",
      ru: "Выручка, затраты, валовая и чистая прибыль, маржа и признак прибыли/убытка по месяцам.",
      uz: "Oylik tushum, xarajatlar, yalpi va sof foyda, marja va foyda/zarar belgisi.",
    },
    formulas: ["=B2-C2", "=E2-D2", "=IF(B2=0,0,F2/B2)", '=IF(F2>=0,"Profit","Loss")'],
    build: (lang) => {
      const t = (x: Text) => pick(x, lang);
      const profit = t({ en: "Profit", ru: "Прибыль", uz: "Foyda" });
      const loss = t({ en: "Loss", ru: "Убыток", uz: "Zarar" });
      const months = lang === "ru" ? ["Январь", "Февраль", "Март", "Апрель"] : lang === "uz" ? ["Yanvar", "Fevral", "Mart", "Aprel"] : ["January", "February", "March", "April"];
      const data = [
        ["42000000", "26000000", "9500000"],
        ["38500000", "25000000", "9800000"],
        ["35000000", "24500000", "11200000"],
        ["47000000", "29000000", "10100000"],
      ];
      const rows = data.map((d, i) => {
        const n = i + 2;
        return [months[i], ...d, `=B${n}-C${n}`, `=E${n}-D${n}`, `=IF(B${n}=0,0,F${n}/B${n})`, `=IF(F${n}>=0,"${profit}","${loss}")`];
      });
      return sheet(
        t({ en: "P&L", ru: "ОПиУ", uz: "Foyda-zarar" }),
        [
          t({ en: "Month", ru: "Месяц", uz: "Oy" }),
          t({ en: "Revenue", ru: "Выручка", uz: "Tushum" }),
          t({ en: "Cost of goods", ru: "Себестоимость", uz: "Tannarx" }),
          t({ en: "Operating expenses", ru: "Операционные расходы", uz: "Operatsion xarajatlar" }),
          t({ en: "Gross profit", ru: "Валовая прибыль", uz: "Yalpi foyda" }),
          t({ en: "Net profit", ru: "Чистая прибыль", uz: "Sof foyda" }),
          t({ en: "Net margin %", ru: "Чистая маржа %", uz: "Sof marja %" }),
          t({ en: "Result", ru: "Результат", uz: "Natija" }),
        ],
        [
          ...rows,
          ["", "", "", "", "", "", "", ""],
          [t({ en: "Total", ru: "Итого", uz: "Jami" }), "=SUM(B2:B5)", "=SUM(C2:C5)", "=SUM(D2:D5)", "=SUM(E2:E5)", "=SUM(F2:F5)", "=IF(B7=0,0,F7/B7)", `=IF(F7>=0,"${profit}","${loss}")`],
        ],
        ["general", "currency", "currency", "currency", "currency", "currency", "percent", "general"],
      );
    },
  },
  {
    id: "pricing",
    icon: "tag",
    title: { en: "Price list with discounts & VAT", ru: "Прайс со скидками и НДС", uz: "Chegirma va QQS bilan narxlar" },
    description: {
      en: "Discount amount, final price, 12% VAT and price including VAT for each product.",
      ru: "Сумма скидки, итоговая цена, НДС 12% и цена с НДС для каждого товара.",
      uz: "Har bir mahsulot uchun chegirma summasi, yakuniy narx, 12% QQS va QQS bilan narx.",
    },
    formulas: ["=B2*C2", "=B2-D2", "=E2*12%", "=E2+F2"],
    build: (lang) => {
      const t = (x: Text) => pick(x, lang);
      const items = lang === "ru" ? ["Ноутбук", "Монитор", "Клавиатура", "Мышь"] : lang === "uz" ? ["Noutbuk", "Monitor", "Klaviatura", "Sichqoncha"] : ["Laptop", "Monitor", "Keyboard", "Mouse"];
      const data = [["9500000", "0.1"], ["2800000", "0.05"], ["450000", "0"], ["180000", "0.15"]];
      const rows = data.map((d, i) => {
        const n = i + 2;
        return [items[i], ...d, `=B${n}*C${n}`, `=B${n}-D${n}`, `=E${n}*12%`, `=E${n}+F${n}`];
      });
      return sheet(
        t({ en: "Price list", ru: "Прайс", uz: "Narxlar" }),
        [
          t({ en: "Product", ru: "Товар", uz: "Mahsulot" }),
          t({ en: "Price", ru: "Цена", uz: "Narx" }),
          t({ en: "Discount %", ru: "Скидка %", uz: "Chegirma %" }),
          t({ en: "Discount amount", ru: "Сумма скидки", uz: "Chegirma summasi" }),
          t({ en: "Final price", ru: "Итоговая цена", uz: "Yakuniy narx" }),
          t({ en: "VAT 12%", ru: "НДС 12%", uz: "QQS 12%" }),
          t({ en: "Price incl. VAT", ru: "Цена с НДС", uz: "QQS bilan narx" }),
        ],
        [
          ...rows,
          ["", "", "", "", "", "", ""],
          [t({ en: "Total", ru: "Итого", uz: "Jami" }), "=SUM(B2:B5)", "", "=SUM(D2:D5)", "=SUM(E2:E5)", "=SUM(F2:F5)", "=SUM(G2:G5)"],
        ],
        ["general", "currency", "percent", "currency", "currency", "currency", "currency"],
      );
    },
  },
];

export function sampleSheet(lang: Language): SheetData {
  return TEMPLATES[0].build(lang);
}
