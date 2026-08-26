// Los ids de producto y tienda son UUID v7 desde la migración: cadenas, no
// números. Cualquier `id % n` o `id * n` sobre ellos da NaN, y NaN no lanza
// ningún error — simplemente hace que un filtro no devuelva nada o que un
// porcentaje se pinte como "NaN%".
//
// Esto ya pasó tres veces en sitios distintos (DailyDeals, StoreDetails y
// DealProductCard), así que el cálculo vive aquí una sola vez en lugar de
// repetirse. Si necesitas derivar un número de un id, usa esta función; no
// escribas aritmética nueva sobre un id.
//
// Devuelve un entero de 0 a 255 a partir de los dos últimos dígitos
// hexadecimales del id. Estable por producto, y funciona igual con los ids
// enteros anteriores a la migración que con los uuid.
export const idNumber = (id) => {
  const hex = String(id ?? '').replace(/-/g, '').slice(-2);
  const value = parseInt(hex, 16);
  return Number.isNaN(value) ? 0 : value;
};
