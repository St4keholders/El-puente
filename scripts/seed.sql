-- Limpiar datos de prueba anteriores si existen
DELETE FROM public.cause_results WHERE cause_id IN (SELECT id FROM public.causes WHERE is_seed = true);
DELETE FROM public.cause_media WHERE cause_id IN (SELECT id FROM public.causes WHERE is_seed = true);
DELETE FROM public.donation_methods WHERE cause_id IN (SELECT id FROM public.causes WHERE is_seed = true);
DELETE FROM public.comments WHERE cause_id IN (SELECT id FROM public.causes WHERE is_seed = true);
DELETE FROM public.saves WHERE cause_id IN (SELECT id FROM public.causes WHERE is_seed = true);
DELETE FROM public.causes WHERE is_seed = true;
DELETE FROM public.profiles WHERE is_seed = true;
DELETE FROM auth.users WHERE id IN (
  '11111111-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000004',
  '11111111-0000-0000-0000-000000000005',
  '11111111-0000-0000-0000-000000000006',
  '11111111-0000-0000-0000-000000000007',
  '11111111-0000-0000-0000-000000000008'
);

-- 1. Insertar usuarios en auth.users para satisfacer foreign key
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, is_sso_user, is_anonymous
) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'luz_ortiz@elpuente.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'mehmet_kaya@elpuente.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'guadalupe_h@elpuente.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'haruki_tanaka@elpuente.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'youssef_amrani@elpuente.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'pasang_sherpa@elpuente.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'fundacion_cerrovivo@elpuente.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'olena_kovalenko@elpuente.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', false, false)
ON CONFLICT (id) DO NOTHING;

-- 2. 8 Perfiles coherentes con sus países
INSERT INTO public.profiles (id, username, full_name, city, country_code, is_seed, bio)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'luz_ortiz', 'Luz Marina Ortiz', 'Quibdó', 'CO', true, 'Líder comunitaria del barrio El Caraño, defensora de iniciativas de apoyo mutuo en el Chocó.'),
  ('11111111-0000-0000-0000-000000000002', 'mehmet_kaya', 'Mehmet Kaya', 'Antakya', 'TR', true, 'Voluntario en reconstrucción comunitaria tras sismos en Hatay.'),
  ('11111111-0000-0000-0000-000000000003', 'guadalupe_h', 'Guadalupe Hernández', 'Oaxaca', 'MX', true, 'Coordinadora de cocinas comunitarias y redes de apoyo vecinal.'),
  ('11111111-0000-0000-0000-000000000004', 'haruki_tanaka', 'Haruki Tanaka', 'Wajima', 'JP', true, 'Voluntario comunitario en la península de Noto.'),
  ('11111111-0000-0000-0000-000000000005', 'youssef_amrani', 'Youssef El Amrani', 'Marrakech', 'MA', true, 'Coordinador de brigadas rurales de socorro en las montañas del Alto Atlas.'),
  ('11111111-0000-0000-0000-000000000006', 'pasang_sherpa', 'Pasang Sherpa', 'Gorkha', 'NP', true, 'Docente comunitario enfocado en la reconstrucción de escuelas rurales.'),
  ('11111111-0000-0000-0000-000000000007', 'fundacion_cerrovivo', 'Fundación Cerro Vivo', 'Viña del Mar', 'CL', true, 'Organización comunitaria dedicada a la reconstrucción post-incendios forestales.'),
  ('11111111-0000-0000-0000-000000000008', 'olena_kovalenko', 'Olena Kovalenko', 'Járkov', 'UA', true, 'Médica y voluntaria en centros de atención materno-infantil.')
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  city = EXCLUDED.city,
  country_code = EXCLUDED.country_code,
  is_seed = true,
  bio = EXCLUDED.bio;

-- 2. Causas (12 activas, 7 cerradas, 5 finalizadas = 24 causas)
INSERT INTO public.causes (
  id, author_id, category, status, title, description, city, country_code, lat, lng,
  goal_amount, raised_reported, currency, published_at, closed_at, finalized_at, is_seed
) VALUES
  -- 12 ACTIVAS
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'terremoto', 'activa',
   'Refugio temporal para 40 familias que perdieron su vivienda en Antakya',
   'Tras el devastador terremoto en Hatay, 40 familias de nuestro barrio están viviendo bajo plásticos y lonas precarias. Hemos habilitado un terreno seguro comunitario donde levantaremos módulos habitacionales provisionales con aislamiento térmico y piso impermeable. Necesitamos fondos urgentes para maderas de estructura, paneles térmicos, clavos y lona reforzada. Todo aporte llega directo a la cuenta comunitaria del comité vecinal sin intermediarios.',
   'Antakya', 'TR', 36.20, 36.16, 15000, 6420, 'USD', now() - interval '8 days', null, null, true),

  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'alimentacion', 'activa',
   'Reconstruir la cocina comunitaria de nuestra colonia en Oaxaca',
   'Nuestra cocina comunitaria alimenta diariamente a más de 120 niñas, niños y adultos mayores que no tienen acceso seguro a alimentos. El último sismo cuarteó los muros de adobe y destruyó el fogón principal. Requerimos cemento, tabique, láminas galvanizadas para el techado y un quemador industrial de bajo consumo para continuar sirviendo raciones calientes todos los mediodías.',
   'Oaxaca', 'MX', 17.06, -96.73, 7000, 3100, 'USD', now() - interval '6 days', null, null, true),

  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'inundacion', 'activa',
   'Mercados y agua potable para 60 familias damnificadas por creciente en Quibdó',
   'La creciente del río Atrato inundó nuestras viviendas en el barrio El Silencio, alcanzando más de un metro de altura dentro de las casas. Las familias perdieron enseres, colchones y provisiones de alimentos. Estamos canalizando apoyo directo para kits de mercado con arroz, granos, aceite y agua potable embotellada para evitar brotes de enfermedades diarreicas en los niños.',
   'Quibdó', 'CO', 5.69, -76.66, 9000, 4310, 'USD', now() - interval '5 days', null, null, true),

  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'vivienda', 'activa',
   'Techos nuevos para viviendas afectadas por el sismo en Portoviejo',
   'Varios temblores sucesivos colapsaron techumbres de zinc y caña en ocho viviendas de familias vulnerables en las afueras de Portoviejo. Las lluvias estacionales amenazan con dañar lo poco que quedó a salvo. Compramos zinc corrugado, vigas de pino y anclajes metálicos para reparar los techos antes del temporal mayor.',
   'Portoviejo', 'EC', -1.05, -80.45, 6000, 2780, 'USD', now() - interval '4 days', null, null, true),

  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000007', 'salud', 'activa',
   'Abrigo térmico y frazadas para niños de comunidades altoandinas en Puno',
   'El friaje en las zonas altas de Puno ha alcanzado los -14°C, provocando neumonías severas en menores de cinco años. Estamos comprando frazadas de alpaca, casacas térmicas impermeables y calzado abrigado para 150 niños de la comunidad de Mazocruz.',
   'Puno', 'PE', -15.84, -70.02, 8000, 5400, 'USD', now() - interval '4 days', null, null, true),

  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000007', 'incendio', 'activa',
   'Reconstruir viviendas consumidas por los incendios forestales en Viña del Mar',
   'Los incendios consumieron por completo 12 casas de madera en nuestro cerro. Las familias están levantando los primeros radieres con ayuda voluntaria. Los fondos se usan para comprar fardos de madera estructural, planchas de fibrocemento incombustible y herramientas de carpintería.',
   'Viña del Mar', 'CL', -33.02, -71.55, 40000, 21400, 'USD', now() - interval '3 days', null, null, true),

  ('22222222-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000005', 'terremoto', 'activa',
   'Víveres y mantas para aldeas del Atlas que siguen incomunicadas',
   'Tras el terremoto en la cordillera del Atlas, caminos rurales continúan cortados por derrumbes. Con mulas y porteadores locales estamos llevando sacos de harina, té, aceite vegetal y mantas térmicas directamente a las familias de las cumbres.',
   'Marrakech', 'MA', 31.63, -8.00, 8000, 4890, 'USD', now() - interval '3 days', null, null, true),

  ('22222222-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000006', 'educacion', 'activa',
   'Reconstruir la escuela del pueblo de Gorkha tras el sismo',
   'El aula donde estudiaban 65 niñas y niños sufrió fisuras estructurales irreparables. Los fondos se destinan a levantar una estructura sismorresistente con vigas de acero y techo ligero, permitiendo reanudar clases en un entorno seguro.',
   'Gorkha', 'NP', 28.00, 84.63, 25000, 11200, 'USD', now() - interval '2 days', null, null, true),

  ('22222222-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000006', 'tormenta', 'activa',
   'Botes nuevos para pescadores artesanales en Tacloban tras el tifón',
   'El oleaje del tifón destrozó las pequeñas lanchas de fibra de vidrio de 8 familias de pescadores, dejándolas sin sustento económico diario. Financiaremos los materiales de resina, madera y motores fuera de borda reacondicionados.',
   'Tacloban', 'PH', 11.24, 125.00, 6500, 2300, 'USD', now() - interval '2 days', null, null, true),

  ('22222222-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000004', 'terremoto', 'activa',
   'Albergue cálido y comidas calientes para adultos mayores en Wajima',
   'El terremoto en la península de Noto dañó la infraestructura de agua y calefacción en el centro de retiro comunitario. Acondicionamos un espacio seguro con calentadores de queroseno, raciones nutritivas y sábanas limpias.',
   'Wajima', 'JP', 37.39, 136.90, 9000, 5100, 'USD', now() - interval '1 day', null, null, true),

  ('22222222-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000008', 'salud', 'activa',
   'Generadores portátiles para la maternidad de emergencia en Járkov',
   'Los cortes eléctricos sistemáticos ponen en riesgo las incubadoras de neonatos y quirófanos de parto. Adquirimos generadores diésel insonorizados y combustible para asegurar energía ininterrumpida.',
   'Járkov', 'UA', 49.99, 36.23, 20000, 14300, 'USD', now() - interval '1 day', null, null, true),

  ('22222222-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000005', 'sequia', 'activa',
   'Tanques de agua para tres escuelas rurales afectadas por la sequía en Lodwar',
   'La sequía prolongada secó los pozos cercanos a las escuelas primarias de Turkana. Instalaremos tres tanques de almacenamiento de 10.000 litros cada uno y organizaremos suministros quincenales en camiones cisterna.',
   'Lodwar', 'KE', 3.12, 35.60, 6000, 4100, 'USD', now() - interval '18 hours', null, null, true),

  -- 7 CERRADAS (repartidas en los últimos 6 días para alimentar Historias)
  ('22222222-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000001', 'salud', 'cerrada',
   'Silla de ruedas especializada y terapias para Samuel en Barranquilla',
   'Samuel tiene 9 años y requiere una silla ortopédica para poder asistir al colegio y recibir fisioterapia.',
   'Barranquilla', 'CO', 10.96, -74.80, 2600, 2750, 'USD', now() - interval '7 days', now() - interval '4 hours', null, true),

  ('22222222-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000002', 'salud', 'cerrada',
   'Medicinas y fisioterapia para adultos mayores heridos en Malatya',
   'Atención directa y medicamentos para personas mayores con fracturas tras el colapso de edificios.',
   'Malatya', 'TR', 38.35, 38.31, 4000, 4200, 'USD', now() - interval '8 days', now() - interval '18 hours', null, true),

  ('22222222-0000-0000-0000-000000000015', '11111111-0000-0000-0000-000000000003', 'inundacion', 'cerrada',
   'Agua potable para comunidades aisladas por deslaves en Puebla',
   'Filtros comunitarios y botellones de agua tras el corte del acueducto rural.',
   'Puebla', 'MX', 19.04, -98.20, 12000, 12100, 'USD', now() - interval '9 days', now() - interval '1 day 6 hours', null, true),

  ('22222222-0000-0000-0000-000000000016', '11111111-0000-0000-0000-000000000005', 'vivienda', 'cerrada',
   'Refuerzo de techos y estufas de leña para familias de Imlil',
   'Madera y chimeneas para enfrentar las primeras nevadas en las montañas.',
   'Imlil', 'MA', 31.13, -7.92, 5000, 5200, 'USD', now() - interval '10 days', now() - interval '2 days 12 hours', null, true),

  ('22222222-0000-0000-0000-000000000017', '11111111-0000-0000-0000-000000000007', 'incendio', 'cerrada',
   'Herramientas y palas para brigadistas voluntarios de Valparaíso',
   'Kits de seguridad, palas y bombas de espalda para controlar rebrotes forestales.',
   'Valparaíso', 'CL', -33.05, -71.62, 3500, 3600, 'USD', now() - interval '11 days', now() - interval '3 days 8 hours', null, true),

  ('22222222-0000-0000-0000-000000000018', '11111111-0000-0000-0000-000000000004', 'terremoto', 'cerrada',
   'Mantas térmicas y linternas recargables para evacuados de Noto',
   'Suministros de abrigo para personas en centros de refugio municipal.',
   'Suzu', 'JP', 37.43, 137.25, 4500, 4700, 'USD', now() - interval '12 days', now() - interval '4 days 14 hours', null, true),

  ('22222222-0000-0000-0000-000000000019', '11111111-0000-0000-0000-000000000007', 'salud', 'cerrada',
   'Insumos médicos para posta de salud rural en Macusani',
   'Antibióticos pediátricos, nebulizadores y tanques de oxígeno portátiles.',
   'Macusani', 'PE', -14.07, -70.43, 3000, 3100, 'USD', now() - interval '14 days', now() - interval '5 days 10 hours', null, true),

  -- 5 FINALIZADAS (3 cerradas en los últimos 7 días)
  ('22222222-0000-0000-0000-000000000020', '11111111-0000-0000-0000-000000000001', 'otra', 'finalizada',
   'Rehabilitación del puente peatonal de vereda La Platina en Quibdó',
   'El puente de madera colapsó tras una tormenta tropical dejando incomunicadas a 80 familias.',
   'Quibdó', 'CO', 5.69, -76.66, 5000, 5200, 'USD', now() - interval '10 days', now() - interval '2 days', now() - interval '12 hours', true),

  ('22222222-0000-0000-0000-000000000021', '11111111-0000-0000-0000-000000000002', 'terremoto', 'finalizada',
   'Kits de abrigo y carpas para campamento de Adıyaman',
   'Familias damnificadas por el sismo necesitaban carpas con aislante térmico.',
   'Adıyaman', 'TR', 37.76, 38.28, 3200, 3400, 'USD', now() - interval '12 days', now() - interval '3 days', now() - interval '1 day', true),

  ('22222222-0000-0000-0000-000000000022', '11111111-0000-0000-0000-000000000003', 'educacion', 'finalizada',
   'Reapertura de la biblioteca comunitaria infantil El Sol en Oaxaca',
   'Las lluvias inundaron el salón de lectura y destruyeron el mobiliario de madera.',
   'Oaxaca', 'MX', 17.06, -96.73, 2800, 2900, 'USD', now() - interval '14 days', now() - interval '5 days', now() - interval '2 days', true),

  ('22222222-0000-0000-0000-000000000023', '11111111-0000-0000-0000-000000000006', 'otra', 'finalizada',
   'Tanque de agua potable para la aldea de Barpak en Gorkha',
   'Construcción de un depósito de captación de manantial para proveer agua limpia.',
   'Gorkha', 'NP', 28.00, 84.63, 7500, 7800, 'USD', now() - interval '25 days', now() - interval '14 days', now() - interval '8 days', true),

  ('22222222-0000-0000-0000-000000000024', '11111111-0000-0000-0000-000000000008', 'salud', 'finalizada',
   'Calefactores eléctricos para albergue de invierno en Leópolis',
   'Instalación de radiadores para salas comunales con personas desplazadas.',
   'Leópolis', 'UA', 49.84, 24.03, 6000, 6100, 'USD', now() - interval '30 days', now() - interval '20 days', now() - interval '12 days', true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  closed_at = EXCLUDED.closed_at,
  finalized_at = EXCLUDED.finalized_at,
  is_seed = true;

-- 3. Resultados de las 5 causas finalizadas
INSERT INTO public.cause_results (cause_id, owner_id, amount_received, currency, summary)
VALUES
  ('22222222-0000-0000-0000-000000000020', '11111111-0000-0000-0000-000000000001', 5200, 'USD',
   'Con el apoyo de 48 donantes directos logramos comprar vigas de acero y tablones de madera tratada. La comunidad aportó la mano de obra durante dos jornadas consecutivas. Hoy los niños vuelven a cruzar seguros a la escuela sin arriesgarse en canoas.'),
  ('22222222-0000-0000-0000-000000000021', '11111111-0000-0000-0000-000000000002', 3400, 'USD',
   'Entregamos 85 estufas portátiles y 140 frazadas térmicas a familias en tiendas temporales. Cada entrega fue documentada y verificada por el comité de vecinos.'),
  ('22222222-0000-0000-0000-000000000022', '11111111-0000-0000-0000-000000000003', 2900, 'USD',
   'Reemplazamos estanterías mojadas, pintamos con pintura antihumedad y recibimos 320 libros donados por la comunidad. Los talleres de lectura infantil se reanudaron este lunes.'),
  ('22222222-0000-0000-0000-000000000023', '11111111-0000-0000-0000-000000000006', 7800, 'USD',
   'Se instalaron 1.200 metros de manguera de alta presión y un tanque comunitario de 10.000 litros. Tres barrios ahora tienen acceso directo a agua limpia sin caminar 2 horas por la montaña.'),
  ('22222222-0000-0000-0000-000000000024', '11111111-0000-0000-0000-000000000008', 6100, 'USD',
   'Compramos e instalamos 18 radiadores de bajo consumo para 4 salas comunales. El albergue aloja actualmente a 62 personas desplazadas de la zona oriental.')
ON CONFLICT (cause_id) DO UPDATE SET
  amount_received = EXCLUDED.amount_received,
  summary = EXCLUDED.summary;

-- 4. Medios de prueba para las 24 causas (storage_path = 'seed/{cause_id}/placeholder-{n}', 1600x1200)
-- Insertar 2 a 3 imágenes por causa
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT id, author_id, status FROM public.causes WHERE is_seed = true LOOP
    -- Imagen 1 (Portada)
    INSERT INTO public.cause_media (cause_id, owner_id, bucket, storage_path, kind, phase, position, width, height)
    VALUES (c.id, c.author_id, 'causas-imagenes', 'seed/' || c.id || '/placeholder-1', 'imagen', 'causa', 0, 1600, 1200);

    -- Imagen 2
    INSERT INTO public.cause_media (cause_id, owner_id, bucket, storage_path, kind, phase, position, width, height)
    VALUES (c.id, c.author_id, 'causas-imagenes', 'seed/' || c.id || '/placeholder-2', 'imagen', 'causa', 1, 1600, 1200);

    -- Si es finalizada, agregar medios de resultado (el "después")
    IF c.status = 'finalizada' THEN
      INSERT INTO public.cause_media (cause_id, owner_id, bucket, storage_path, kind, phase, position, width, height)
      VALUES (c.id, c.author_id, 'causas-imagenes', 'seed/' || c.id || '/placeholder-resultado-1', 'imagen', 'resultado', 0, 1600, 1200);
      INSERT INTO public.cause_media (cause_id, owner_id, bucket, storage_path, kind, phase, position, width, height)
      VALUES (c.id, c.author_id, 'causas-imagenes', 'seed/' || c.id || '/placeholder-resultado-2', 'imagen', 'resultado', 1, 1600, 1200);
    END IF;
  END LOOP;
END $$;

-- 5. Métodos de donación ficticios de prueba
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT id, author_id FROM public.causes WHERE is_seed = true LOOP
    INSERT INTO public.donation_methods (cause_id, owner_id, kind, provider, account_holder, account_value, details, position)
    VALUES
      (c.id, c.author_id, 'transferencia_bancaria', 'Banco Comunitario Solidario', 'Comité de Ayuda Vecinal', 'ES91 0000 0000 0000 0000', 'Dato de prueba · Fondos directos a la comunidad', 0),
      (c.id, c.author_id, 'billetera_digital', 'Billetera Móvil', 'Apoyo Directo', '+57 300 000 0000', 'Dato de prueba · Verificado', 1);
  END LOOP;
END $$;

-- 6. Comentarios de prueba en 5 causas
INSERT INTO public.comments (cause_id, author_id, body, thread, replies_count)
VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', '¡Mucho ánimo desde Oaxaca! Ya enviamos un aporte directo por transferencia.', 'causa', 1),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000007', 'Fuerza Quibdó. Desde Viña del Mar compartimos la causa con nuestra red.', 'causa', 0),
  ('22222222-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000008', 'Gran labor con los abuelos en Wajima. Transferencia enviada.', 'causa', 0),
  ('22222222-0000-0000-0000-000000000020', '11111111-0000-0000-0000-000000000002', 'Qué orgullo ver el puente terminado y a los niños cruzando seguros. Gracias por la transparencia.', 'resultado', 0);
