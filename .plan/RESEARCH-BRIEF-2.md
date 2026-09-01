# מחקר גולמי #2 — הריפו האמיתי של שמנת מתוקה נמצא ונסרק

מיקום: `/Users/mymacbook/Desktop/prsonal/shamenet_metuka`
זה מבטל/מתקן חלק מההשערות ב-RESEARCH-BRIEF.md שנגזרו מה-bundle הפומבי בלבד.

## סטאק אמיתי
create-t3-app 7.13.0 — Next.js **13.4.7 Pages Router**, React 18.2, **Prisma 5.11 + PostgreSQL**,
**NextAuth 4** (Credentials+bcrypt, Google OAuth, PasswordResetToken), **tRPC 10** + react-query v4,
Tailwind 3.4 + **DaisyUI 4** + shadcn/Radix, Zod, react-hook-form,
**Google Cloud Storage** (@google-cloud/storage) לאחסון מדיה, **Mailjet + nodemailer** למיילים,
react-pdf/pdf-lib/jspdf להפקת PDF, apexcharts+recharts לגרפים.
~35,200 שורות ב-src (141 קבצים) — **גדול מטעמא (22k)**. סה"כ מיזוג ≈ 57k שורות.

## ✅ הגילוי הקריטי: שני הפרויקטים כבר על Supabase
- taama: project `jyjgvkmiworryocdwnli`, אזור **aws-1-ap-southeast-1** (סינגפור!), פורט 6543 (pooler/transaction)
- shamenet: project `ntoqrtisbnuporyavqyn`, אזור **aws-0-us-west-1**, פורט 5432 (session)
→ אותו ספק, אותו Postgres. מיזוג = pg_dump/restore בין פרויקטים, לא החלפת טכנולוגיה.
→ **אבל ה-DB של טעמא יושב בסינגפור. זה מוסיף ~250-300ms לכל round-trip מישראל, על כל server action.**
   זו בעיית ביצועים אמיתית וקיימת היום, לא קשורה לאיחוד. eu-central-1 היה הנכון.

## מודל הנתונים של שמנת מתוקה (prisma/schema.prisma, 611 שורות, יש migrations אמיתיות)
**חזק יותר מטעמא במסחר. חלש יותר בתפעול.**

זהות לקוח מאוחדת (טעמא לא עושה את זה בכלל):
- `Customer` (firstName/lastName/notes/isActive) ← ישות מרכזית
- `CustomerContact` (type: email|phone, value, isPrimary, verifiedAt) עם `@@unique([type,value])` — לקוח יכול להחזיק כמה אימיילים/טלפונים
- `CustomerMerge` — טבלת אודיט למיזוג כפילויות לקוחות
- `User` (NextAuth) מקושר ל-`Customer` דרך customerId → הזמנת אורח והזמנה מחשבון מתאחדות

שלושה סוגי הזמנה, כולם עם customerId + userId + orderItems:
- `Order` — קמעונאי/קייטרינג עם כתובת משלוח (city/street/zipCode/shippingComments/shippedAt)
- `BreakfastOrder` — ארוחות בוקר, אופציונלית משויכת ל-Company
- `B2BOrder` — עסקי, חובה companyId, orderNumber
כולם: `PaymentStatus` (UNPAID|PARTIAL|PAID) + paidAmount + totalAmount → **תשלום חלקי נתמך**
סטטוסים: OrderStatus(PENDING/PROCESSING/SHIPPED/DELIVERED), B2B+Breakfast(PENDING/CONFIRMED/PREPARING/READY/DELIVERED/CANCELLED)

נרמול שורות הזמנה (טעמא שומרת רק product+size+price):
- `OrderItem` (snapshot של productNameHe/En, sizeLabel, comboNameHe, quantity, price)
- `OrderItemOption`, `OrderItemIngredient`, `OrderItemComboSelection`, `OrderItemComboSelectionOption`
→ שמירה מלאה של מה בדיוק הלקוח בחר, עמידה לשינויי קטלוג. **טעמא חסרה את זה לגמרי.**

מנוע מודיפיירים לארוחות בוקר (לטעמא אין שום מקבילה):
- `BreakfastCombo` → `BreakfastComboRule` (productType, quantity, isRequired, categoryId, extraPrice, **groupKey, minSelect, maxSelect**, sortOrder)
- `BreakfastProduct` (categoryId, price, isFeatured, productType, **maxOptionsCount, optionGroupConstraints Json**)
- `BreakfastOption` (type: BREAD|SAUCE|TOPPING) ↔ `BreakfastProductOption` (isRequired, minSelect)
- `DietaryTag` ↔ `BreakfastProductDietary`
- `BreakfastCategory`

קטלוג רגיל: `Category` → `Product` → `ProductSize`→`Size`, `ProductOption`→`Option`, `ProductIngredient`→`Ingredient`
`Company` (B2B), `CustomerMessage` (טופס צור קשר עם סטטוס טיפול), `PasswordResetToken`
`UserRole` enum: User | Admin | SuperAdmin

**דו-לשוניות מובנית בכל טבלה: nameHe/nameEn, descriptionHe/descriptionEn, language על ההזמנה.**
`src/helper/translations.ts` = 827 שורות he/en. טעמא: עברית hardcoded בלבד.

## tRPC routers (src/server/api/routers/)
users, media, product, emails, orders, messages, companies, b2bOrders, breakfast, account, catalog, customers
+ `src/server/api/logic/customer.ts` (לוגיקת זהות לקוח), `services/create-pdf.ts`, `services/email.ts`, `services/data.ts`

## ❌ תיקונים להשערות קודמות
- **אין תשלום אונליין אמיתי.** `src/components/BitPayment/index.tsx` הוא **מוק**: `bitQRCodeUrl = "/placeholder.svg"`,
  פונקציות `simulatePaymentComplete()` / `simulatePaymentFailed()`. אין ספק סליקה בקוד ואין מפתחות סליקה ב-.env.
  ה-.env מכיל רק: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, GOOGLE_CLIENT_ID/SECRET, MJ_APIKEY_PUBLIC/SECRET, MAIN_EMAIL.
  → PaymentStatus/paidAmount מנוהלים **ידנית מהדשבורד**, לא מסליקה.
- i18n: `next.config.mjs` מגדיר locales:["en"] בלבד, אבל בפועל יש שכבת i18n משלהם (`~/helper/I18nSetup` + translations.ts) עם he/en.

## 🔴 ממצאי אבטחה/איכות בריפו הישן
- **`keyfile.json` (Google Cloud service account) מקומי ב-git פעמיים**: `keyfile.json` וגם `src/server/services/keyfile.json`.
  `git ls-files` מאשר שהם tracked. חובה rotate למפתח ולהוציא מההיסטוריה.
- `next.config.mjs`: `typescript.ignoreBuildErrors: true` + `eslint.ignoreDuringBuilds: true` — שגיאות טיפוסים נבלעות.
- `transpilePackages` מכיל 30 חבילות antd/rc-* שכנראה כבר לא בשימוש (לא ב-package.json) — שאריות.
- `images.dangerouslyAllowSVG: true`.
- git: ענף נוכחי `david`, יש `main` ו-`base` ב-origin. הקומיט האחרון: "Adding a popup explaining that the site is inactive".

## מיתוג ועיצוב אמיתי (tailwind.config.ts + קוד)
- צבעים בקונפיג: black `#2A2A2A`, lightGray `#ECECEC`, gray `#F4F4F4`, yellow `#FFC200`, main `#FDF4E3`, main2 `#FDF6E8`
- זהב-ברונזה מותגי `#b88746` (inline בכל מקום, לא טוקן), טקסט זהב כהה `#8d652f`
- פונטים בקונפיג: Saira, Inter (לטיניים) — בפועל נטענים Heebo + Amatic SC
- DaisyUI + shadcn/Radix מעורבבים
- נגישות: ווידג'ט "נגישלי" ב-`public/nagishli-files/`

## פרטי קשר אמיתיים
טלפון 058-328-1175, אימייל mshamenet.info@gmail.com, WhatsApp wa.me/972583281175, IG/FB @shamenetmetuka

## מסקנת ביניים לתכנון
זה **לא** "לגרור אתר גרוע לתוך אתר טוב". זה מיזוג שבו כל צד תורם:
- טעמא תורמת: תמחור לפי רכיבים (ingredients→dishes→costing), רשימת קניות מאוחדת, משימות, Web Push,
  אנליטיקות, אירועי מכירה לשבת, App Router/React 19/Tailwind 4 מודרניים, Supabase Auth.
- שמנת מתוקה תורמת: מודל Customer מאוחד + CustomerContact + merge, נרמול OrderItem עם snapshots,
  מנוע combos/options עם min/max, B2B + Company, הזמנות טלפוניות, PaymentStatus, דו-לשוניות, CustomerMessage, PDF, migrations תקינות.
