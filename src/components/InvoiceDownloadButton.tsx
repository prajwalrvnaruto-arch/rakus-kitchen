"use client";

import { useState } from "react";
import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface InvoiceDownloadButtonProps {
  orderId: string;
  orderDisplayId: string; // e.g., "RK-00042"
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
}

export function InvoiceDownloadButton({
  orderId,
  orderDisplayId,
  variant = "ghost",
  size = "md",
}: InvoiceDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      if (!auth?.currentUser) {
        throw new Error("Please sign in to download invoice");
      }

      const token = await getIdToken(auth.currentUser, true);

      const response = await fetch(`/api/orders/${orderId}/invoice`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download invoice");
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${orderDisplayId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Invoice download error:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const buttonClass = variant === "primary" ? "btn btn-chili" : "btn btn-ghost";

  const sizeClass = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  return (
    <div className="inline-block">
      <button
        onClick={handleDownload}
        disabled={loading}
        className={`${buttonClass} ${sizeClass} ${loading ? "opacity-50 cursor-wait" : ""}`}
      >
        {loading ? "Generating..." : "📄 Download Invoice"}
      </button>
      {error && <p className="mt-1 text-xs text-chili">{error}</p>}
    </div>
  );
}
