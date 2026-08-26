-- Se ejecuta INMEDIATAMENTE ANTES de 002_uuid_v7_migration.sql.
--
-- 002 se niega a continuar si alguna de las nueve tablas tiene una política
-- RLS, y con razón: una política sobrevive al renombrado de la sección D
-- apuntando a la columna legacy_*, sin error y sin aviso. La comprobación
-- previa no las borra ella misma a propósito — borrar políticas de seguridad
-- sin que nadie lo decida es exactamente lo que no debe hacer una migración.
--
-- Estas trece son las que producción tenía el 2026-08-25, extraídas del
-- volcado real. Todas son `USING (true)` / `WITH CHECK (true)`: no restringen
-- nada, existen para que RLS quede activado permitiéndolo todo. Por eso
-- 002b puede recrearlas literalmente, sin reescribir ninguna expresión.
--
-- RLS sigue ACTIVADO en las nueve tablas mientras tanto. Sin políticas eso
-- significa denegar a anon/authenticated durante la ventana de migración; el
-- backend usa la SERVICE_ROLE_KEY, que se salta RLS, así que no se ve
-- afectado. Es más seguro que lo contrario.
--
-- Si 002 falla después de esto, ejecuta 002b igualmente: las políticas no
-- dependen de que la migración haya terminado.

begin;

drop policy if exists "Actualización pública para configuraciones" on public.platform_settings;
drop policy if exists "Inserción pública para configuraciones"     on public.platform_settings;
drop policy if exists "Lectura pública para configuraciones"       on public.platform_settings;
drop policy if exists "Allow public insert to product_reviews"     on public.product_reviews;
drop policy if exists "Allow public read to product_reviews"       on public.product_reviews;
drop policy if exists "Allow public insert to product_views"       on public.product_views;
drop policy if exists "Allow public read to product_views"         on public.product_views;
drop policy if exists "Lectura pública para categorías"            on public.categories;
drop policy if exists "Lectura pública para productos"             on public.products;
drop policy if exists "Lectura pública para tiendas"               on public.stores;
drop policy if exists "Permitir actualización de tiendas"          on public.stores;
drop policy if exists "Permitir inserción de tiendas"              on public.stores;
drop policy if exists "Public profiles are viewable by everyone."  on public.store_categories;

-- El índice compuesto que producción tenía sobre product_views(product_id,
-- created_at). Cubre product_id, que la sección D renombra a
-- legacy_product_id: sin quitarlo, seguiría al renombrado y pasaría a indexar
-- la columna legacy, que es null en toda fila nueva. 002b lo recrea sobre la
-- columna uuid.
drop index if exists public.idx_product_views_product_id_created_at;

-- Los dos disparadores de producción. La comprobación previa de 002 se para
-- ante cualquier disparador porque no puede leer el cuerpo de una función y
-- decidir si es seguro — se detiene y obliga a que lo mire una persona. Ya
-- está mirado, el 2026-08-25, contra el volcado real:
--
--   trigger_add_initial_review  -> add_initial_5star_review()
--       Inserta NEW.id en product_reviews.product_id. Ni convierte, ni
--       compara, ni trata el id como texto: copia el valor sea del tipo que
--       sea. Sigue funcionando con uuid.
--
--   trigger_update_product_rating -> update_product_rating()
--       Compara product_id = NEW.product_id e id = NEW.product_id. Los dos
--       lados cambian de tipo a la vez. Sigue funcionando con uuid.
--
-- Ninguna de las dos funciones se toca; sólo se quitan los disparadores para
-- que 002 pueda continuar, y 002b los vuelve a poner tal cual. Si alguna vez
-- se añade un disparador nuevo, hay que leer su función antes de añadirlo
-- aquí: esta lista NO es una plantilla que se rellena sin pensar.
drop trigger if exists trigger_add_initial_review   on public.products;
drop trigger if exists trigger_update_product_rating on public.product_reviews;

do $$
declare quedan int;
begin
  select count(*) into quedan from pg_policies where schemaname = 'public';
  if quedan > 0 then
    raise exception 'quedan % políticas en public; 002 abortará. Revísalas antes de continuar', quedan;
  end if;

  if exists (select 1 from pg_indexes where schemaname = 'public'
             and indexname = 'idx_product_views_product_id_created_at') then
    raise exception 'el índice idx_product_views_product_id_created_at sigue ahí; 002 abortará';
  end if;
end
$$;

commit;
