import PDFDocument from 'pdfkit';
import { formatMinor } from '../utils/money.js';

function renderPdfToBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    buildFn(doc);
    doc.end();
  });
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toISOString().slice(0, 10);
}

export async function buildInvoicePdfBuffer({ workspace, invoice, client }) {
  return renderPdfToBuffer((doc) => {
    // Brand Header
    doc.rect(0, 0, doc.page.width, 96).fill('#11141C');
    doc.fillColor('#8B7CFF').fontSize(20).font('Helvetica-Bold').text('FinLedger', 48, 32);
    doc
      .fillColor('#E2E8F0')
      .fontSize(10)
      .font('Helvetica')
      .text(workspace.name, 48, 58);

    doc
      .fillColor('#FFFFFF')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('INVOICE', 360, 32, { width: 187, align: 'right' });
    doc
      .fillColor('#A7F3D0')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`Status: ${invoice.status}`, 360, 60, { width: 187, align: 'right' });

    doc.fillColor('#111827').font('Helvetica');

    // Invoice Meta & Bill To
    let y = 120;
    doc.fontSize(10).font('Helvetica-Bold').text('BILL TO', 48, y);
    doc.font('Helvetica').fontSize(11).text(client?.name || 'Client', 48, y + 16);
    if (client?.company) doc.fontSize(10).text(client.company, 48, y + 32);
    if (client?.email) doc.fontSize(10).fillColor('#4B5563').text(client.email, 48, y + 48);
    if (client?.billingAddress) {
      doc.fontSize(9).text(client.billingAddress, 48, y + 64, { width: 230 });
    }
    if (client?.taxId) {
      doc.fontSize(9).text(`Tax ID: ${client.taxId}`, 48, y + 96);
    }

    doc.fillColor('#111827');
    doc.fontSize(10).font('Helvetica-Bold').text('Invoice Number:', 340, y);
    doc.font('Helvetica').text(invoice.invoiceNumber, 445, y, { width: 102, align: 'right' });
    doc.font('Helvetica-Bold').text('Issue Date:', 340, y + 18);
    doc.font('Helvetica').text(formatDate(invoice.issueDate), 445, y + 18, {
      width: 102,
      align: 'right',
    });
    doc.font('Helvetica-Bold').text('Due Date:', 340, y + 36);
    doc.font('Helvetica').text(formatDate(invoice.dueDate), 445, y + 36, {
      width: 102,
      align: 'right',
    });
    doc.font('Helvetica-Bold').text('Currency:', 340, y + 54);
    doc.font('Helvetica').text(invoice.currency, 445, y + 54, { width: 102, align: 'right' });

    // Line items table
    y = 245;
    doc.rect(48, y, 499, 24).fill('#F3F4F6');
    doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold');
    doc.text('DESCRIPTION', 56, y + 7, { width: 220 });
    doc.text('QTY', 280, y + 7, { width: 45, align: 'right' });
    doc.text('UNIT PRICE', 330, y + 7, { width: 75, align: 'right' });
    doc.text('TAX %', 410, y + 7, { width: 45, align: 'right' });
    doc.text('TOTAL', 460, y + 7, { width: 80, align: 'right' });

    y += 32;
    doc.font('Helvetica').fontSize(9.5);
    for (const item of invoice.lineItems) {
      if (y > 680) {
        doc.addPage();
        y = 56;
      }
      doc.fillColor('#111827').text(item.description, 56, y, { width: 220 });
      doc.text(String(item.qty), 280, y, { width: 45, align: 'right' });
      doc.text(formatMinor(item.unitPriceMinor, invoice.currency), 330, y, {
        width: 75,
        align: 'right',
      });
      doc.text(`${((item.taxRateBps || 0) / 100).toFixed(2)}%`, 410, y, {
        width: 45,
        align: 'right',
      });
      doc.text(formatMinor(item.lineTotalMinor, invoice.currency), 460, y, {
        width: 80,
        align: 'right',
      });

      y += 22;
      doc.moveTo(48, y - 4).lineTo(547, y - 4).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    }

    // Totals summary
    y += 16;
    const drawSummaryRow = (label, val, bold = false, color = '#111827') => {
      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      doc.text(label, 340, y, { width: 110, align: 'right' });
      doc.text(val, 455, y, { width: 90, align: 'right' });
      y += 18;
    };

    drawSummaryRow('Subtotal:', formatMinor(invoice.subtotalMinor, invoice.currency));
    drawSummaryRow('Tax:', formatMinor(invoice.taxMinor, invoice.currency));
    if (invoice.discountMinor > 0) {
      drawSummaryRow('Discount:', `-${formatMinor(invoice.discountMinor, invoice.currency)}`);
    }
    drawSummaryRow('Total:', formatMinor(invoice.totalMinor, invoice.currency), true);
    drawSummaryRow('Paid:', formatMinor(invoice.paidMinor, invoice.currency), false, '#059669');
    const balanceDue = Math.max(0, invoice.totalMinor - invoice.paidMinor);
    drawSummaryRow('Balance Due:', formatMinor(balanceDue, invoice.currency), true, '#4F46E5');

    // Payment instructions & notes
    y += 20;
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10).text('Payment Instructions & Notes', 48, y);
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#4B5563')
      .text(
        invoice.notes ||
          `Please remit payment quoting reference ${invoice.invoiceNumber} before ${formatDate(invoice.dueDate)}.`,
        48,
        y + 16,
        { width: 499 }
      );
  });
}

export async function buildMonthlyStatementPdfBuffer({
  workspace,
  monthKey,
  summary,
  accounts,
  transactions,
}) {
  return renderPdfToBuffer((doc) => {
    doc.rect(0, 0, doc.page.width, 92).fill('#11141C');
    doc.fillColor('#8B7CFF').fontSize(20).font('Helvetica-Bold').text('FinLedger', 48, 28);
    doc
      .fillColor('#E2E8F0')
      .fontSize(10)
      .font('Helvetica')
      .text(`${workspace.name} (${workspace.baseCurrency})`, 48, 54);
    doc
      .fillColor('#FFFFFF')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('MONTHLY FINANCIAL STATEMENT', 280, 30, { width: 267, align: 'right' });
    doc
      .fillColor('#94A3B8')
      .fontSize(11)
      .font('Helvetica')
      .text(`Period: ${monthKey}`, 280, 54, { width: 267, align: 'right' });

    let y = 114;
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text('Cashflow & Balance Summary', 48, y);
    y += 20;

    const kpis = [
      ['Opening Net Balance', formatMinor(summary.openingBalanceMinor, workspace.baseCurrency)],
      ['Total Income', formatMinor(summary.incomeMinor, workspace.baseCurrency)],
      ['Total Expenses', formatMinor(summary.expenseMinor, workspace.baseCurrency)],
      ['Net Cashflow', formatMinor(summary.netCashflowMinor, workspace.baseCurrency)],
      ['Closing Net Balance', formatMinor(summary.closingBalanceMinor, workspace.baseCurrency)],
    ];

    doc.font('Helvetica').fontSize(10);
    for (const [label, val] of kpis) {
      doc.fillColor('#374151').text(label, 48, y, { width: 220 });
      doc.fillColor('#111827').font('Helvetica-Bold').text(val, 280, y, { width: 150, align: 'right' });
      doc.font('Helvetica');
      y += 18;
    }

    y += 14;
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text('Account Balances', 48, y);
    y += 18;
    doc.fontSize(9.5);
    for (const acc of accounts) {
      doc.font('Helvetica').fillColor('#374151').text(`${acc.name} (${acc.type})`, 48, y, { width: 280 });
      doc
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text(formatMinor(acc.balanceMinor, acc.currency), 340, y, { width: 160, align: 'right' });
      y += 16;
    }

    y += 16;
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text('Itemized Transactions', 48, y);
    y += 20;
    doc.rect(48, y, 499, 20).fill('#F3F4F6');
    doc.fillColor('#111827').fontSize(8.5).font('Helvetica-Bold');
    doc.text('DATE', 54, y + 6, { width: 70 });
    doc.text('TYPE', 128, y + 6, { width: 65 });
    doc.text('CATEGORY', 198, y + 6, { width: 100 });
    doc.text('DESCRIPTION', 302, y + 6, { width: 145 });
    doc.text('AMOUNT', 450, y + 6, { width: 92, align: 'right' });
    y += 26;

    doc.font('Helvetica').fontSize(8.5);
    if (transactions.length === 0) {
      doc.fillColor('#6B7280').text('No posted transactions recorded during this period.', 54, y);
    } else {
      for (const tx of transactions) {
        if (y > 740) {
          doc.addPage();
          y = 48;
        }
        doc.fillColor('#374151').text(formatDate(tx.occurredAt), 54, y, { width: 70 });
        doc.text(tx.type, 128, y, { width: 65 });
        doc.text(tx.category, 198, y, { width: 100 });
        doc.text(tx.description, 302, y, { width: 145 });
        doc
          .fillColor(tx.type === 'INCOME' ? '#059669' : tx.type === 'EXPENSE' ? '#E11D48' : '#111827')
          .text(formatMinor(tx.baseAmountMinor, workspace.baseCurrency), 450, y, {
            width: 92,
            align: 'right',
          });
        y += 16;
      }
    }
  });
}
