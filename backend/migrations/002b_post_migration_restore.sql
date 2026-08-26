-- Se ejecuta INMEDIATAMENTE DESPUÉS de 002_uuid_v7_migration.sql.
--
-- Recrea, literalmente, las trece políticas que 002a quitó. Son las que tenía
-- producción el 2026-08-25 y todas son `USING (true)` / `WITH CHECK (true)`:
-- ninguna menciona una columna, así que la migración a uuid no las afecta y
-- no hay nada que reescribir. Si alguna vez se añade una política que SÍ
-- mencione una columna de id, este fichero deja de ser una copia literal y
-- hay que revisarla a mano.
--
-- Ejecútalo aunque 002 haya fallado: dejar las nueve tablas con RLS activado
-- y sin políticas deniega el acceso a anon y authenticated. El backend usa la
-- SERVICE_ROLE_KEY y no lo notaría, así que el fallo sería silencioso hasta
-- que algo consultara la base de datos directamente.

begin;

create policy "Actualización pública para configuraciones" on public.platform_settings for update using (true);
create policy "Inserción pública para configuraciones"     on public.platform_settings for insert with check (true);
create policy "Lectura pública para configuraciones"       on public.platform_settings for select using (true);
create policy "Allow public insert to product_reviews"     on public.product_reviews    for insert with check (true);
create policy "Allow public read to product_reviews"       on public.product_reviews    for select using (true);
create policy "Allow public insert to product_views"       on public.product_views      for insert with check (true);
create policy "Allow public read to product_views"         on public.product_views      for select using (true);
create policy "Lectura pública para categorías"            on public.categories         for select using (true);
create policy "Lectura pública para productos"             on public.products           for select using (true);
create policy "Lectura pública para tiendas"               on public.stores             for select using (true);
create policy "Permitir actualización de tiendas"          on public.stores             for update using (true) with check (true);
create policy "Permitir inserción de tiendas"              on public.stores             for insert with check (true);
create policy "Public profiles are viewable by everyone."  on public.store_categories   for select using (true);

-- El índice compuesto que 002a quitó, ahora sobre la columna uuid. La
-- sección G de 002 ya crea un índice sobre product_views(product_id) solo;
-- éste es el compuesto con created_at que usan las estadísticas de tienda,
-- así que se recrea tal como estaba en producción.
create index if not exists idx_product_views_product_id_created_at
  on public.product_views using btree (product_id, created_at);

-- Los dos disparadores, tal cual estaban. Las funciones no se han tocado en
-- ningún momento: se revisaron antes de quitarlos (ver 002a) y ninguna de las
-- dos convierte ni compara un id como algo que no sea su propio tipo.
create or replace trigger trigger_add_initial_review
  after insert on public.products
  for each row execute function public.add_initial_5star_review();

create or replace trigger trigger_update_product_rating
  after insert or delete or update on public.product_reviews
  for each row execute function public.update_product_rating();

-- Trece, ni una menos: si el recuento no cuadra, algo no se recreó y el
-- acceso directo a la base de datos queda más restringido de lo que estaba.
do $$
declare total int;
begin
  select count(*) into total from pg_policies where schemaname = 'public';
  if total <> 13 then
    raise exception 'se esperaban 13 políticas en public, hay %', total;
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
