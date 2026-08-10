require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteStore(storeNumber) {
  try {
    console.log(`Buscando tienda con número: ${storeNumber}`);
    const { data: store, error: findError } = await supabase
      .from('stores')
      .select('id, name')
      .eq('store_number', storeNumber)
      .single();

    if (findError || !store) {
      console.error('Tienda no encontrada:', findError);
      return;
    }

    const storeId = store.id;
    console.log(`Encontrada tienda: ${store.name} (ID: ${storeId}). Procediendo a borrar...`);

    // 1. Obtener todos los productos de la tienda
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('store_id', storeId);

    const productIds = products ? products.map(p => p.id) : [];

    // 2. Eliminar order_items de esos productos
    if (productIds.length > 0) {
      console.log(`Borrando order_items para ${productIds.length} productos...`);
      await supabase
        .from('order_items')
        .delete()
        .in('product_id', productIds);
        
      // 3. Eliminar los productos
      console.log(`Borrando ${productIds.length} productos...`);
      await supabase
        .from('products')
        .delete()
        .in('id', productIds);
    }

    // 4. Eliminar la tienda
    console.log('Borrando la tienda...');
    const { error: storeError } = await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);

    if (storeError) throw storeError;

    console.log('¡Tienda borrada exitosamente!');
  } catch (error) {
    console.error('Error al borrar:', error);
  }
}

deleteStore('898128');
