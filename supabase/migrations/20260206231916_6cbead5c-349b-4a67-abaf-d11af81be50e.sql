
-- Opção vegetariana de ceia para cutting: Tofu + Vegetais
-- IDs: Tofu=905404de-3758-4206-a2df-b6cc31582e33
-- Cogumelo Champignon=80bb38be-2ad4-4322-9b80-f3e73d91e080 (3.1g proteína, 22 kcal)
-- Abobrinha=67a73e28-e323-43cd-a44f-140fb68e4034 (17 kcal)

INSERT INTO meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order, goal_type)
VALUES
  -- CUT: Opção 22 - Tofu + Cogumelo + Abobrinha (vegetariano, muito baixa caloria)
  ('supper', 22, '905404de-3758-4206-a2df-b6cc31582e33', 'proteina_principal', 150, 1, 'cut'),
  ('supper', 22, '80bb38be-2ad4-4322-9b80-f3e73d91e080', 'vegetal', 100, 2, 'cut'),
  ('supper', 22, '67a73e28-e323-43cd-a44f-140fb68e4034', 'vegetal', 100, 3, 'cut');
