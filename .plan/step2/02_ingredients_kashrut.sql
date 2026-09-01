-- ============================================================
-- M2 · כשרות על הרכיבים
-- סיכון: נמוך. עמודה עם DEFAULT — כל 92 השורות מתמלאות מיד.
-- 'parve' כדיפולט בכוונה: הערך הכי פחות מגביל, כדי שהוספת
-- רכיב חדש לא תיחסם בטעות. ההגנה מגיעה מהסיווג ב-M3.
-- ביטול: ALTER TABLE ingredients DROP COLUMN kashrut;
-- ============================================================

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS kashrut text NOT NULL DEFAULT 'parve';

ALTER TABLE ingredients
  DROP CONSTRAINT IF EXISTS ingredients_kashrut_check;

ALTER TABLE ingredients
  ADD CONSTRAINT ingredients_kashrut_check
  CHECK (kashrut IN ('meat','dairy','parve'));

CREATE INDEX IF NOT EXISTS ingredients_kashrut_idx ON ingredients (kashrut);
