import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const list = await prisma.purchaseList.findUnique({
    where: { id },
    include: {
      items: {
        include: { item: true }
      },
      createdBy: true,
    }
  });

  if (!list) return new NextResponse('Not found', { status: 404 });

  const totalCost = list.items.reduce((acc, pli) => acc + (Number(pli.estimatedCost) || 0) * pli.quantity, 0);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Purchase Order ${list.id}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #111827;
          margin: 0;
          padding: 40px;
        }
        .header {
          border-bottom: 2px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .brand {
          font-size: 24px;
          font-weight: bold;
          color: #1e40af;
        }
        .sub-brand {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }
        .meta {
          text-align: right;
        }
        .meta-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .meta-text {
          font-size: 12px;
          color: #4b5563;
        }
        .title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 10px;
          text-align: left;
        }
        th {
          background-color: #f3f4f6;
          font-weight: bold;
          font-size: 14px;
        }
        td {
          font-size: 14px;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .totals {
          margin-top: 30px;
          display: flex;
          justify-content: flex-end;
        }
        .totals-box {
          width: 300px;
          border-top: 2px solid #111827;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          font-weight: bold;
        }
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 10px;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
        }
        @media print {
          @page { margin: 0; }
          body { padding: 40px; }
          button { display: none; }
        }
      </style>
    </head>
    <body onload="window.print()">
      <div class="header">
        <div>
          <div class="brand">MODERN ELECTRONICS</div>
          <div class="sub-brand">TV Repair Shop & Spare Parts Operating System</div>
        </div>
        <div class="meta">
          <div class="meta-title">PURCHASE ORDER</div>
          <div class="meta-text">Ref: #${list.id.substring(0, 8).toUpperCase()}</div>
          <div class="meta-text">Date: ${list.createdAt.toLocaleDateString()}</div>
        </div>
      </div>

      <div class="title">${list.title}</div>
      ${list.notes ? `<div class="meta-text" style="margin-bottom: 20px;">Notes: ${list.notes}</div>` : ''}

      <table>
        <thead>
          <tr>
            <th width="8%">#</th>
            <th width="42%">Required Item / Spare Part</th>
            <th width="35%">Description / Specifications</th>
            <th width="15%" class="text-center">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${list.items.map((pli, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td><strong>${pli.itemName || pli.item?.name || 'Unnamed Item'}</strong></td>
              <td>${pli.description || pli.notes || '—'}</td>
              <td class="text-center"><strong>${pli.quantity} Units</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 20px; display: flex; justify-content: space-between; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
        <span style="color: #6b7280;">Total Line Items: ${list.items.length}</span>
        <span style="font-weight: bold; color: #1e40af;">Total Quantity: ${list.items.reduce((acc, it) => acc + it.quantity, 0)} Units</span>
      </div>

      <div class="footer">
        MODERN ELECTRONICS • Authorized Spare Parts Purchase Requirement • Generated by TV Tech OS
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
