-- ============================================================
-- M7 · עמודת description למוצרי החנות
-- ⚠ חייבת לרוץ לפני M6 — הייבוא כותב לעמודה הזו.
--
-- למה לא announcement_text: הוא לא תיאור. storefront-client.tsx:59
-- פותח בעזרתו מודאל שקופץ ללקוח, ולכן תיאור בכל מוצר היה מקפיץ
-- 25 חלונות. announcement_text נשאר להכרזות נקודתיות.
--
-- סיכון: אפס. עמודה nullable, שום קוד לא קורא אותה עדיין.
-- ביטול: ALTER TABLE shop_products DROP COLUMN description;
-- ============================================================

ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS description text;
