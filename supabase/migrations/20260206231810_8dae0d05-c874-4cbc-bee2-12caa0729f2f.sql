
-- Novas âncoras de ceia com Tofu e Peixes (opções 16-21)
-- IDs verificados: Tofu=905404de-3758-4206-a2df-b6cc31582e33, Tilápia=82881297-0af2-43ae-b86a-c79064afd027
-- Merluza=93e0598f-6333-4bdc-97a6-5ae7c62b14e4, Atum=bf9ddc65-9360-490c-bddc-2cdeafeeba13
-- Kiwi=b36eda2a-fb4d-4de4-ad74-66b847343282, Maçã=4ce8a886-63be-47cc-bdf3-d1218b4c7309

INSERT INTO meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order, goal_type)
VALUES
  -- CUT: Opção 16 - Tilápia + Kiwi (leve, alta proteína)
  ('supper', 16, '82881297-0af2-43ae-b86a-c79064afd027', 'proteina_principal', 100, 1, 'cut'),
  ('supper', 16, 'b36eda2a-fb4d-4de4-ad74-66b847343282', 'fruta', 100, 2, 'cut'),
  
  -- CUT: Opção 17 - Atum em Água + Maçã (muito magro)
  ('supper', 17, 'bf9ddc65-9360-490c-bddc-2cdeafeeba13', 'proteina_principal', 80, 1, 'cut'),
  ('supper', 17, '4ce8a886-63be-47cc-bdf3-d1218b4c7309', 'fruta', 100, 2, 'cut'),
  
  -- MAINTAIN: Opção 18 - Tofu + Maçã (vegetariano)
  ('supper', 18, '905404de-3758-4206-a2df-b6cc31582e33', 'proteina_principal', 150, 1, 'maintain'),
  ('supper', 18, '4ce8a886-63be-47cc-bdf3-d1218b4c7309', 'fruta', 120, 2, 'maintain'),
  
  -- MAINTAIN: Opção 19 - Merluza + Kiwi (peixe branco leve)
  ('supper', 19, '93e0598f-6333-4bdc-97a6-5ae7c62b14e4', 'proteina_principal', 120, 1, 'maintain'),
  ('supper', 19, 'b36eda2a-fb4d-4de4-ad74-66b847343282', 'fruta', 100, 2, 'maintain'),
  
  -- BULK: Opção 20 - Tilápia + Tofu (proteína dupla vegetariana)
  ('supper', 20, '82881297-0af2-43ae-b86a-c79064afd027', 'proteina_principal', 150, 1, 'bulk'),
  ('supper', 20, '905404de-3758-4206-a2df-b6cc31582e33', 'proteina_principal', 100, 2, 'bulk'),
  
  -- BULK: Opção 21 - Atum + Maçã (alta proteína)
  ('supper', 21, 'bf9ddc65-9360-490c-bddc-2cdeafeeba13', 'proteina_principal', 120, 1, 'bulk'),
  ('supper', 21, '4ce8a886-63be-47cc-bdf3-d1218b4c7309', 'fruta', 150, 2, 'bulk');
