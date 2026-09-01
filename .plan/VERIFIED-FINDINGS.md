# ממצאים שאומתו ידנית (לא דיווח סוכן) — 2026-08-31

כל אחד מאלה נבדק בפקודה ישירה על הקוד או ה-DB. משמש כמקור אמת למסמך הסופי.

## 🔴 1. דף הצעת המחיר ללקוח חסום בפני לקוחות
`src/utils/supabase/middleware.ts:75` — `path.startsWith('/orders')` נכלל ב-`isDashboardRoute`.
תחת `/orders/[id]/` יושבים **שני דפים שפונים ללקוח**:
- `src/app/orders/[id]/client-summary/page.tsx` (393 שורות — סיכום/הצעת מחיר ללקוח)
- `src/app/orders/[id]/print/page.tsx` (354 שורות)
לקוח שלוחץ על הלינק → מופנה ל-`/login` → ואם אינו approved/admin → `/pending`.
**כלומר: הערוץ היחיד שבפועל מכניס כסף (קייטרינג אירועים) לא יכול להראות ללקוח את ההצעה שלו.**
תיקון: להוציא את `/orders/[id]/client-summary` ו-`/print` מרשימת ה-dashboard ולהגן עליהם בטוקן חתום.

## 🟠 2. הרשמה באמצע רכישה משאירה את הלקוח תקוע
`src/app/(shop)/login/page.tsx` — במסלול **התחברות** יש `router.push(redirectTo)`.
במסלול **הרשמה** אין redirect כלל: רק `setSuccess('ההרשמה בוצעה! בדוק את תיבת המייל...')`.
לקוח חדש שנשלח מ-`/checkout` ל-`/login` ונרשם — לא חוזר לסל.

## 🔴 3. הזמנה חדשה לא מייצרת שום התראה
`src/app/(shop)/checkout/actions.ts` — `placeOrder` כותב ל-DB, קורא `revalidatePath('/')` ומחזיר.
אין קריאה ל-`sendToSubscriptions`, אין מייל, אין push. (התשתית קיימת ב-`src/utils/push.ts`
ובשימוש ב-`shop-admin/actions.ts`, פשוט לא מחוברת ל-checkout.)
**אם לקוח כן היה מזמין — הבעלים לא היה יודע.**

## 🟠 4. הצהרה שגויה בעמוד מדיניות הפרטיות
`src/app/(shop)/privacy/page.tsx:58`: "ערוצי הסליקה והתשלום של האתר מופעלים על ידי ספקי סליקה
מורשים צד שלישי העומדים בתקני האבטחה המחמירים ביותר (PCI-DSS). פרטי כרטיס האשראי שלכם אינם נשמרים..."
בפועל `src/app/(shop)/checkout/page.tsx:357` אומר "תשלום במזומן בלבד במועד האיסוף",
ואין שום ספק סליקה ב-package.json או ב-.env.local. **הצהרה לא נכונה במסמך משפטי.**

## 🟡 5. אין שום CTA של וואטסאפ בטעמא
`grep -rn 'wa\.me' src/` מחזיר **0 תוצאות**. אין כפתור וואטסאפ בשום מקום.
(לשם השוואה: באתר החלבי יש `wa.me/972583281175` והוא ערוץ ההמרה המרכזי שלו.)

## 📊 6. סטטיסטיקות DB — תיקון להצהרה קודמת
`pg_stat_user_tables` על טעמא:
```
table                       ins    del   live
order_dishes               1010    920     90
dish_ingredients            740    531    209
saved_shopping_list_items   138    102     36
ingredients                 121     29     92
shop_product_ingredients    105     25     80
shop_product_variants        61     18     43
dishes                       59      0     59
shop_products                45      6     42
tasks                        42     24     18
shop_events                  19     18      1
task_categories              12      9      3
shop_order_items             12     12      0
orders                       10      4      6
push_subscriptions            8      6      2
shop_orders                   7      7      0
```
**תיקון חשוב**: קודם נכתב "חנות השבת מעולם לא קיבלה הזמנה". מדויק יותר:
**7 הזמנות חנות נוצרו דרך המסלול המלא ו-7 נמחקו.** כלומר `placeOrder` רץ מקצה לקצה שבע פעמים
והמסלול הטכני עובד. לא ניתן לקבוע מהסטטיסטיקות אם היו לקוחות אמיתיים או בדיקות של הבעלים —
**זו שאלה לבעלים.**
כמו כן: 19 אירועי מכירה נוצרו ו-18 נמחקו → נשאר אחד. הרבה ניסוי וטעייה.
⚠️ מגבלה: `pg_stat_user_tables` מתאפס ב-restart של ה-DB, ולכן אלה מספרי **רצפה** לחלון זמן לא ידוע.

## 7. git — דרישת הבידוד לא מקוימת היום
`git branch -a` בטעמא: קיים **רק `main`** (ועוד `origin/main`). remote: `github.com:DavidHakak/taama.git`.
כל העבודה נעשית ישירות על main, וההודעות של חמשת הקומיטים האחרונים הן: `.`, `.`, `.`, `alerts`, `alerts`.
בריפו הישן: ענף נוכחי `david`, קיימים גם `main` ו-`base`.
