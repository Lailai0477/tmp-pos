import {
  type ItemEntity,
  OrderEntity,
  type WithId,
  useItemMaster,
} from "@tmp/common";
import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { ItemAssign } from "../organisms/ItemAssign";

type Props = {
  items: WithId<ItemEntity>[] | undefined;
  orders: OrderEntity[] | undefined;
  wsStatus: "connecting" | "open" | "closed" | "error";
  submitPayload: (order: OrderEntity) => void;
  syncOrder?: (order: OrderEntity) => void;
};

const groupItemsByType = (
  items: WithId<ItemEntity>[],
  itemTypes: { name: string; display_name: string }[],
) => {
  return itemTypes
    .map((itemType) => ({
      typeName: itemType.name,
      label: itemType.display_name,
      items: items.filter((item) => item.item_type.name === itemType.name),
    }))
    .filter((group) => group.items.length > 0);
};

export function CashierTouch({
  items,
  orders,
  wsStatus,
  submitPayload,
  syncOrder,
}: Props) {
  const { itemTypes } = useItemMaster();

  const [queue, setQueue] = useState<WithId<ItemEntity>[]>([]);
  const [receivedText, setReceivedText] = useState("");
  const [description, setDescription] = useState("");
  const [discountNo, setDiscountNo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editableIndex, setEditableIndex] = useState<number | null>(null);

  const nextOrderId = useMemo(() => {
    const latest =
      orders?.reduce((acc, cur) => Math.max(acc, cur.orderId), 0) ?? 0;
    return latest + 1;
  }, [orders]);

  const groupedItems = useMemo(
    () => groupItemsByType(items ?? [], itemTypes ?? []),
    [items, itemTypes],
  );

  const editingOrder = useMemo(() => {
    const order = OrderEntity.createNew({ orderId: nextOrderId });
    order.items = queue;
    return order;
  }, [nextOrderId, queue]);

  const discountOrder = useMemo(() => {
    if (!discountNo) return undefined;
    return orders?.find((order) => order.orderId === Number(discountNo));
  }, [discountNo, orders]);

  const previewOrder = useMemo(() => {
    const order = editingOrder.clone();
    if (description.trim()) {
      order.addComment("cashier", description.trim());
    }
    if (discountOrder) {
      order.applyDiscount(discountOrder);
    } else {
      order.removeDiscount();
    }
    return order;
  }, [description, discountOrder, editingOrder]);

  const received = Number.parseInt(receivedText || "0", 10);
  const normalizedReceived = Number.isNaN(received) ? 0 : received;
  const charge = normalizedReceived - previewOrder.billingAmount;

  const addItem = (item: WithId<ItemEntity>) => {
    setQueue((prev) => [...prev, item.clone()]);
  };

  const removeItem = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
    setEditableIndex((prev) => (prev === index ? null : prev));
  };

  const mutateItem = (
    index: number,
    action: (prev: WithId<ItemEntity>) => WithId<ItemEntity>,
  ) => {
    setQueue((prev) =>
      prev.map((item, i) => (i === index ? action(item) : item)),
    );
  };

  const resetAll = () => {
    setQueue([]);
    setReceivedText("");
    setDescription("");
    setDiscountNo("");
    setConfirmOpen(false);
    setEditableIndex(null);
  };

  const submitOrder = () => {
    if (previewOrder.items.length === 0) return;
    if (charge < 0) return;

    const submitOne = previewOrder.clone();
    submitOne.received = normalizedReceived;
    submitOne.nowCreated();

    submitPayload(submitOne);
    syncOrder?.(OrderEntity.createNew({ orderId: nextOrderId + 1 }));
    resetAll();
  };

  const justPaid = () => {
    setReceivedText(String(previewOrder.billingAmount));
  };

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-[1.7fr_1fr] gap-4 overflow-hidden p-3">
      <div className="flex min-h-0 flex-col rounded-2xl border bg-background p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-semibold text-2xl tracking-tight">レジ</h1>
          <div className="text-muted-foreground text-xs">WS: {wsStatus}</div>
        </div>

        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="space-y-4">
            {groupedItems.map((group) => (
              <section key={group.typeName} className="space-y-2">
                <h2 className="font-semibold text-xl">{group.label}</h2>
                <div className="grid grid-cols-3 gap-3">
                  {group.items.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="secondary"
                      className="h-14 rounded-xl px-2 text-sm leading-tight whitespace-normal"
                      onClick={() => addItem(item)}
                    >
                      {item.name}
                    </Button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-h-0 flex-col rounded-2xl border bg-background p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-muted-foreground text-xs">注文番号</div>
            <div className="font-bold text-2xl">No. {nextOrderId}</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-xs">点数</div>
            <div className="font-bold text-xl">{queue.length}</div>
          </div>
        </div>

        <div className="min-h-0 flex-1 rounded-xl border p-2">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-2">
              {queue.length === 0 && (
                <div className="text-muted-foreground py-6 text-center text-sm">
                  商品を追加してください
                </div>
              )}

              {queue.map((item, index) => (
                <ItemAssign
                  key={`${item.id}-${index}`}
                  item={item}
                  idx={index}
                  mutateItem={mutateItem}
                  removeItem={() => removeItem(index)}
                  highlight={editableIndex === index}
                  focus={editableIndex === index}
                  onClick={() => setEditableIndex(index)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="font-medium text-xs">備考</div>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="備考を入力"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <div className="font-medium text-xs">割引番号</div>
              <Input
                value={discountNo}
                onChange={(e) => setDiscountNo(e.target.value)}
                inputMode="numeric"
                placeholder="例: 123"
                className="h-9"
              />
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="flex justify-between py-0.5 text-sm">
              <span>小計</span>
              <span>¥{previewOrder.total}</span>
            </div>
            <div className="flex justify-between py-0.5 text-sm">
              <span>割引</span>
              <span>- ¥{previewOrder.discount}</span>
            </div>
            <div className="flex justify-between pt-1 font-bold text-lg">
              <span>合計</span>
              <span>¥{previewOrder.billingAmount}</span>
            </div>
          </div>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                className="h-12 w-full rounded-2xl text-lg"
                disabled={queue.length === 0}
              >
                確定
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>会計を確認</AlertDialogTitle>
                <AlertDialogDescription className="space-y-4">
                  <div className="grid grid-cols-2 gap-y-2 rounded-xl border p-4 text-base">
                    <div className="text-muted-foreground">小計</div>
                    <div className="text-right font-medium">
                      ¥{previewOrder.total}
                    </div>

                    <div className="text-muted-foreground">割引</div>
                    <div className="text-right font-medium">
                      - ¥{previewOrder.discount}
                    </div>

                    <div className="border-t pt-2 text-lg font-bold">合計</div>
                    <div className="border-t pt-2 text-right text-2xl font-bold">
                      ¥{previewOrder.billingAmount}
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 shadow-sm">
                    <div className="mb-2 font-semibold text-base">
                      受領額を入力
                    </div>
                    <Input
                      autoFocus
                      id="received"
                      value={receivedText}
                      onChange={(e) => setReceivedText(e.target.value)}
                      inputMode="numeric"
                      placeholder="例: 1000"
                      className="h-14 text-center text-2xl font-bold"
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={justPaid}
                      >
                        ちょうど
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 items-center rounded-xl border p-4">
                    <div className="font-medium text-base">お釣り</div>
                    <div className="text-right text-2xl font-bold">
                      ¥{charge < 0 || Number.isNaN(charge) ? 0 : charge}
                    </div>
                  </div>

                  {charge < 0 && (
                    <p className="font-medium text-red-500">
                      受領額が不足しています
                    </p>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>戻る</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    justPaid();
                  }}
                >
                  ちょうど
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={(e) => {
                    if (charge < 0 || queue.length === 0) {
                      e.preventDefault();
                      return;
                    }
                    submitOrder();
                  }}
                >
                  送信
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
