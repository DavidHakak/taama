# מחקר גולמי #3 — ספירות שורות אמיתיות משני ה-DB (קריאה בלבד, 2026-08-31)

**זה הממצא הכי חשוב בכל המחקר, והוא סותר את הנחת המוצא שניתנה לסוכנים.**
לשני הסוכנים-workflows נמסר "האתר הבשרי עובד היום ומכניס כסף". הנתונים מראים תמונה אחרת.

## taama (jyjgvkmiworryocdwnli, ap-southeast-1) — public schema
```
    209 dish_ingredients        92 ingredients          59 dishes
     90 order_dishes             6 orders               0 order_purchases
      3 profiles                 3 auth.users           2 push_subscriptions
     42 shop_products           43 shop_product_variants  80 shop_product_ingredients
      1 shop_events              2 shop_coupons          2 shop_promotions
      0 shop_orders              0 shop_order_items
     18 tasks                    3 task_categories
      1 saved_shopping_lists    36 saved_shopping_list_items
      6 store_settings
```
הזמנות קייטרינג לפי סטטוס: Completed=4, Paid=2 (סה"כ 6).
הזמנות חנות לפי סטטוס: **אין. הטבלה ריקה.**

### מה זה אומר
- **חנות השבת מעולם לא קיבלה אפילו הזמנה אחת.** 0 shop_orders, 0 shop_order_items.
  כל המנגנון — סל, קופונים, מבצעים, מלאי, cutoff, checkout — נבנה ומעולם לא נבחן בלקוח אמיתי.
- מודול הקייטרינג קיבל 6 הזמנות בלבד, כולן כבר סגורות (Completed/Paid).
- 3 משתמשים בסך הכל במערכת = הבעלים + 2. אין קהל לקוחות רשום.
- **מה שכן חי ואמיתי**: הקטלוג והתמחור. 92 רכיבים, 59 מנות, 209 קישורי מנה-רכיב,
  42 מוצרי חנות עם 43 וריאנטים ו-80 קישורי רכיבים. 18 משימות. 36 פריטי רשימת קניות.
  → **טעמא היא היום בעיקר כלי תפעול פנימי של הבעלים, לא חנות מוכרת.**

## shamenet_metuka (ntoqrtisbnuporyavqyn, us-west-1) — public schema
```
      5 Account          5 User            4 Customer        5 CustomerContact
      0 CustomerMerge    1 CustomerMessage 1 Company
      0 Order            5 BreakfastOrder  2 B2BOrder
      7 OrderItem        9 OrderItemOption 0 OrderItemIngredient
      0 OrderItemComboSelection            0 OrderItemComboSelectionOption
      5 Category        25 Product        40 ProductSize     28 Size
     12 ProductOption    9 Option          0 ProductIngredient  0 Ingredient
      3 BreakfastCategory  17 BreakfastProduct  13 BreakfastOption
     68 BreakfastProductOption   16 BreakfastProductDietary   4 DietaryTag
      0 BreakfastCombo   0 BreakfastComboRule
      0 Session          0 PasswordResetToken
      7 _prisma_migrations
```

### מה זה אומר
- **האתר החלבי מעולם לא יצא למסחר.** 0 Order (טבלת ההזמנות הראשית), 5 BreakfastOrder ו-2 B2BOrder = הזמנות בדיקה.
- 5 משתמשים, 4 לקוחות = הבעלים וסביבתו. **מאשר את מה שהבעלים אמר: אין לקוחות פעילים.**
- **מנוע הקומבו ריק לגמרי: 0 BreakfastCombo, 0 BreakfastComboRule.**
  נבנו שם ~3,000 שורות קוד (router 1208 + עמוד 1488 + ComboSelector 953 + מסכי ניהול)
  עבור מנגנון שמעולם לא הוזן בו נתון אחד ומעולם לא רץ בפרודקשן.
- מה שכן קיים: קטלוג של 25 מוצרים עם 40 גדלים, ו-17 מוצרי ארוחת בוקר עם 68 שיוכי אופציות.

## מסקנות שמשנות את התוכנית
1. **אין בעיית מיגרציית נתונים.** סה"כ הנתונים העסקיים בשני הצדדים הם כמה מאות שורות.
   אין היסטוריית הזמנות לשמר, אין קהל משתמשים להעביר, אין סיכון SEO מהותי.
   כל תוכנית מיגרציה מורכבת (pg_dump חוצה-אזורים, מיפוי cuid→uuid, מיגרציית NextAuth→Supabase)
   היא over-engineering. אפשר פשוט לייצא קטלוג ל-CSV/JSON ולטעון מחדש.
2. **הסיכון "לשבור אתר שמכניס כסף" קטן ממה שנראה** — אבל הדרישה לבידוד עדיין תקפה,
   כי טעמא היא כלי העבודה היומיומי של הבעלים (משימות, קניות, תמחור, קטלוג).
   מה שצריך להגן עליו זה **רציפות הכלי התפעולי**, לא זרם הכנסות מהחנות.
3. **שאלת ה-ROI מתהפכת.** אף אחת משתי החנויות לא מכרה כלום. לבנות פלטפורמה דו-מותגית
   לפני שחנות אחת הוכיחה מכירה — זה לבנות תשתית לביקוש שטרם הודגם.
4. **לא כדאי לנמל את מנוע הקומבו כמו שהוא.** 3,000 שורות קוד ללא נתון אחד ומבלי שרץ מעולם
   = קוד לא מוכח. נכון לקחת את *עיצוב המודל* (groupKey/minSelect/maxSelect) ולממש מחדש, רזה.
5. הנכס האמיתי בטעמא הוא שרשרת התמחור ingredients→dishes→costing→shopping-list. זה עובד ובשימוש.
   הנכס האמיתי בשמנת מתוקה הוא *עיצוב* מודל הזהות (Customer/CustomerContact) ו-B2B — לא הקוד ולא הנתונים.

## מגבלה
ניסיון לקרוא שמות/אימיילים של לקוחות ותאריכי הזמנות נחסם ע"י מסנן ההרשאות, ובצדק.
הספירות לעיל מספיקות למסקנות. לא נבדק: האם הבעלים מקבל הזמנות בערוץ אחר (וואטסאפ/טלפון)
שלא נרשם במערכת — **זו הנחה פתוחה שצריך לשאול אותו**, והיא משנה את מסקנה 3.
