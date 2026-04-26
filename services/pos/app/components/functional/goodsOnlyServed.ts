import type { OrderEntity } from "@tmp/common";

export function goodsOnlyServed(order: OrderEntity): OrderEntity {
  if (order.getDrinkCups().length === 0) {
    order.beServed();
  }
  return order;
}
