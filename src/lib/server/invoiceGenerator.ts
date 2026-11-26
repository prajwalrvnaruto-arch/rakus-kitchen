import "server-only";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Order } from "@/types";
import { BUSINESS } from "@/lib/config";
import { formatINR } from "@/lib/menu";
import { getOrderGSTBreakdown } from "@/lib/gst";

/**
 * Generate a GST-compliant invoice PDF for an order.
 * Returns the PDF as a Buffer for server-side API responses.
 */
export function generateInvoicePDF(order: Order): Buffer {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 15;

  // Business name (larger, bold)
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(BUSINESS.name, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 7;

  // Tagline (smaller)
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(BUSINESS.tagline, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 10;

  // Business details box
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(BUSINESS.address, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 4;
  doc.text(
    `Phone: ${BUSINESS.phoneDisplay} | FSSAI: ${BUSINESS.fssaiNumber}`,
    pageWidth / 2,
    yPosition,
    { align: "center" }
  );
  yPosition += 4;
  if (BUSINESS.gstNumber) {
    doc.text(`GSTIN: ${BUSINESS.gstNumber}`, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 4;
  }

  yPosition += 3;

  // Thick separator line
  doc.setLineWidth(0.8);
  doc.line(15, yPosition, pageWidth - 15, yPosition);
  yPosition += 8;

  // TAX INVOICE header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 10;

  // Invoice and Customer details in boxes
  const leftColX = 15;
  const rightColX = pageWidth / 2 + 5;
  const colWidth = (pageWidth - 30) / 2 - 5;

  // Invoice details box
  doc.setFillColor(245, 245, 245);
  doc.rect(leftColX, yPosition, colWidth, 28, "F");
  doc.setDrawColor(200, 200, 200);
  doc.rect(leftColX, yPosition, colWidth, 28, "S");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Details", leftColX + 3, yPosition + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  // Safe date conversion - handle Firestore Timestamp or epoch ms
  const createdAtMs = typeof order.createdAt === 'number'
    ? order.createdAt
    : (order.createdAt as any)?._seconds
      ? (order.createdAt as any)._seconds * 1000
      : Date.now();

  const invoiceDate = new Date(createdAtMs);
  const formattedDate = invoiceDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = invoiceDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  doc.text(`Invoice No: ${order.orderId}`, leftColX + 3, yPosition + 10);
  doc.text(`Date: ${formattedDate}`, leftColX + 3, yPosition + 15);
  doc.text(`Time: ${formattedTime}`, leftColX + 3, yPosition + 20);
  doc.text(`Meal: ${order.mealSlot} · ${order.mealDate}`, leftColX + 3, yPosition + 25);

  // Customer details box
  doc.setFillColor(245, 245, 245);
  doc.rect(rightColX, yPosition, colWidth, 28, "F");
  doc.setDrawColor(200, 200, 200);
  doc.rect(rightColX, yPosition, colWidth, 28, "S");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Customer Details", rightColX + 3, yPosition + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(order.customerName, rightColX + 3, yPosition + 10);
  doc.text(`Phone: ${order.phone}`, rightColX + 3, yPosition + 15);

  if (order.fulfillmentType === "pickup") {
    doc.setFont("helvetica", "bold");
    doc.text("Self Pickup", rightColX + 3, yPosition + 20);
  } else if (order.addressComponents) {
    const address1 = order.addressComponents.doorAndBuilding;
    const address2 = order.addressComponents.displayAddress;
    doc.text(address1.substring(0, 32), rightColX + 3, yPosition + 20);
    if (address2.length > 32) {
      doc.text(address2.substring(0, 32) + "...", rightColX + 3, yPosition + 25);
    } else {
      doc.text(address2, rightColX + 3, yPosition + 25);
    }
  }

  yPosition += 35;

  // Items table
  const gst = getOrderGSTBreakdown(order);

  const tableData = order.items.map((item) => {
    const beforeGST = item.lineTotal / 1.05;
    return [
      item.name + (item.variant ? ` (${item.variant})` : ""),
      item.qty.toString(),
      formatINR(item.pricePerUnit),
      formatINR(item.lineTotal),
    ];
  });

  autoTable(doc, {
    startY: yPosition,
    head: [["Item Description", "Qty", "Rate (Incl. GST)", "Amount"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [209, 69, 59],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 85, halign: "left" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 8;

  // Totals section in a box
  const totalsBoxX = pageWidth - 75;
  const totalsBoxWidth = 60;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Items subtotal
  doc.text("Items Subtotal:", totalsBoxX, yPosition);
  doc.text(formatINR(gst.itemTotalBeforeGST), totalsBoxX + totalsBoxWidth, yPosition, {
    align: "right",
  });
  yPosition += 5;

  // Packaging fee
  doc.text("Packaging Fee:", totalsBoxX, yPosition);
  doc.text(formatINR(gst.packagingFeeBeforeGST), totalsBoxX + totalsBoxWidth, yPosition, {
    align: "right",
  });
  yPosition += 5;

  // Subtotal line
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsBoxX, yPosition, totalsBoxX + totalsBoxWidth, yPosition);
  yPosition += 5;

  // Subtotal before GST
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal (before GST):", totalsBoxX, yPosition);
  doc.text(formatINR(gst.subtotalBeforeGST), totalsBoxX + totalsBoxWidth, yPosition, {
    align: "right",
  });
  yPosition += 5;

  // GST
  doc.setFont("helvetica", "normal");
  doc.text(`GST @ ${gst.gstRate}%:`, totalsBoxX, yPosition);
  doc.text(formatINR(gst.gstAmount), totalsBoxX + totalsBoxWidth, yPosition, {
    align: "right",
  });
  yPosition += 6;

  // Total line (thicker)
  doc.setLineWidth(0.5);
  doc.line(totalsBoxX, yPosition, totalsBoxX + totalsBoxWidth, yPosition);
  yPosition += 6;

  // Grand total (larger, bold)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Total Amount:", totalsBoxX, yPosition);
  doc.text(formatINR(order.grandTotal), totalsBoxX + totalsBoxWidth, yPosition, {
    align: "right",
  });
  yPosition += 8;

  // Payment status box
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const paymentStatus = order.payment?.status === "paid" ? "PAID" : "PENDING";
  const statusColor = order.payment?.status === "paid" ? [34, 139, 34] : [255, 140, 0];

  doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(totalsBoxX, yPosition, totalsBoxWidth, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(`Payment Status: ${paymentStatus}`, totalsBoxX + totalsBoxWidth / 2, yPosition + 4, {
    align: "center",
  });
  doc.setTextColor(0, 0, 0);

  if (order.payment?.paidAt) {
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    // Safe date conversion for payment timestamp
    const paidAtMs = typeof order.payment.paidAt === 'number'
      ? order.payment.paidAt
      : (order.payment.paidAt as any)?._seconds
        ? (order.payment.paidAt as any)._seconds * 1000
        : Date.now();

    const paidDate = new Date(paidAtMs);
    const paidFormatted = paidDate.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.text(`Paid on: ${paidFormatted}`, totalsBoxX, yPosition);
  }

  // Footer section
  const footerY = pageHeight - 25;
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 200);
  doc.line(15, footerY, pageWidth - 15, footerY);

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text("Thank you for choosing Raku's Kitchen!", pageWidth / 2, footerY + 5, {
    align: "center",
  });
  doc.text(
    `Follow us on Instagram: @${BUSINESS.instagram} | Contact: ${BUSINESS.phoneDisplay}`,
    pageWidth / 2,
    footerY + 10,
    { align: "center" }
  );

  doc.setFontSize(6);
  doc.text(
    "This is a computer-generated invoice and does not require a signature.",
    pageWidth / 2,
    footerY + 15,
    { align: "center" }
  );

  // Generate and return buffer
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return pdfBuffer;
}
