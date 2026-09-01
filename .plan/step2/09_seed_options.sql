-- ============================================================
-- M9 · הזנת האופציות בפועל
-- רק שני מוצרים בכל הקטלוג צריכים אופציות: פשטידה וקיש.
-- פיצות ופוקצ'ות הן מגש מעורב — התוספות שלהן הן תיאור.
--
-- shop_option_ingredients נשארת ריקה בכוונה. הכמויות יוזנו
-- מהדשבורד, פר אופציה ופר גודל.
--
-- ביטול: DELETE FROM shop_product_option_groups
--          WHERE shop_product_id IN (SELECT id FROM shop_products
--            WHERE brand_id=(SELECT id FROM brands WHERE slug='shamenet'));
-- ============================================================

INSERT INTO shop_product_option_groups (shop_product_id, name, min_select, max_select, is_required, position)
SELECT p.id, $$בחר טעם$$, 1, 1, true, 0
FROM shop_products p
WHERE p.brand_id = (SELECT id FROM brands WHERE slug = 'shamenet')
  AND p.name IN ($$פשטידה$$, $$קיש$$);

INSERT INTO shop_product_options (group_id, name, price_delta, position)
SELECT g.id, v.option_name, 0.00, v.position
FROM (VALUES
  ($$פשטידה$$, $$כרישה$$,  0),
  ($$פשטידה$$, $$ברוקולי$$, 1),
  ($$קיש$$,    $$בטטה$$,   0),
  ($$קיש$$,    $$בצל$$,    1),
  ($$קיש$$,    $$פטריות$$, 2)
) AS v(product_name, option_name, position)
JOIN shop_products p
  ON p.name = v.product_name
 AND p.brand_id = (SELECT id FROM brands WHERE slug = 'shamenet')
JOIN shop_product_option_groups g
  ON g.shop_product_id = p.id AND g.name = $$בחר טעם$$;

-- ── אימות ─────────────────────────────────────────────────
--  קבוצות: 2   אופציות: 5
