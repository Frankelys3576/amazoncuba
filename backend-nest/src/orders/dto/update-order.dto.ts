import { IsIn } from 'class-validator';

// Los tres únicos estados que usa la aplicación. Espejo de ORDER_STATUSES en
// backend/src/controllers/order.controller.js y en orders.service.ts.
//
// I6: esto admitía además 'confirmed' y 'cancelled', un resto heredado que se
// aplazó por "cosmético". No lo era: OrderUpdateAuthGuard deja pasar a un
// administrador sin más comprobación, así que el único filtro entre un token
// de administrador y un estado arbitrario es la lista blanca. Con la lista
// ancha aquí, borrar la comprobación de OrdersService.update dejaba a Nest
// aceptando dos estados que Express rechaza: una divergencia que se abriría
// justo en el cambio de backend.
export class UpdateOrderDto {
  @IsIn(['pending', 'shipped', 'delivered'], {
    message: 'El estado debe ser "pending", "shipped" o "delivered"',
  })
  status: string;
}
