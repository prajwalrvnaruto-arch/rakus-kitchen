/**
 * Kitchen staff layout — minimal, no order-alert system (unlike admin).
 * Kitchen staff see a read-only combined prep sheet and don't get the
 * real-time order queue that drives the admin dashboard's alert modal.
 */
import { KitchenGate } from "@/components/KitchenGate";

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <KitchenGate>{children}</KitchenGate>;
}