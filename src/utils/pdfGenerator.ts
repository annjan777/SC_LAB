import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportConfig {
  title: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  dateRange?: { from: string; to: string };
}

export interface TableColumn {
  header: string;
  dataKey: string;
}

export interface SummaryItem {
  label: string;
  value: string | number;
}

export class PDFReportGenerator {
  private doc: jsPDF;
  private yPosition: number;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 15;

  constructor(orientation: 'portrait' | 'landscape' = 'portrait') {
    this.doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.yPosition = this.margin;
  }

  addHeader(config: ReportConfig) {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.title, this.pageWidth / 2, this.yPosition, { align: 'center' });
    this.yPosition += 10;

    if (config.subtitle) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(config.subtitle, this.pageWidth / 2, this.yPosition, { align: 'center' });
      this.yPosition += 8;
    }

    if (config.dateRange) {
      this.doc.setFontSize(10);
      this.doc.setTextColor(100);
      const dateText = `Period: ${new Date(config.dateRange.from).toLocaleDateString()} - ${new Date(config.dateRange.to).toLocaleDateString()}`;
      this.doc.text(dateText, this.pageWidth / 2, this.yPosition, { align: 'center' });
      this.yPosition += 8;
    }

    this.doc.setFontSize(9);
    this.doc.setTextColor(150);
    const generatedText = `Generated on: ${new Date().toLocaleString()}`;
    this.doc.text(generatedText, this.pageWidth / 2, this.yPosition, { align: 'center' });
    this.yPosition += 10;

    this.doc.setTextColor(0);
    this.addLine();
  }

  addLine() {
    this.doc.setLineWidth(0.5);
    this.doc.setDrawColor(200);
    this.doc.line(this.margin, this.yPosition, this.pageWidth - this.margin, this.yPosition);
    this.yPosition += 5;
  }

  addSummarySection(title: string, items: SummaryItem[]) {
    this.checkPageBreak(40);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.yPosition);
    this.yPosition += 8;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    items.forEach(item => {
      this.checkPageBreak(10);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${item.label}:`, this.margin + 5, this.yPosition);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(String(item.value), this.margin + 60, this.yPosition);
      this.yPosition += 6;
    });

    this.yPosition += 5;
  }

  addTable(columns: TableColumn[], data: any[], title?: string) {
    this.checkPageBreak(40);

    if (title) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(title, this.margin, this.yPosition);
      this.yPosition += 8;
    }

    autoTable(this.doc, {
      startY: this.yPosition,
      head: [columns.map(col => col.header)],
      body: data.map(row => columns.map(col => row[col.dataKey] ?? '-')),
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { left: this.margin, right: this.margin },
      didDrawPage: (data) => {
        this.addFooter();
      },
    });

    this.yPosition = (this.doc as any).lastAutoTable.finalY + 10;
  }

  addText(text: string, fontSize: number = 10, isBold: boolean = false) {
    this.checkPageBreak(10);
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', isBold ? 'bold' : 'normal');

    const lines = this.doc.splitTextToSize(text, this.pageWidth - 2 * this.margin);
    lines.forEach((line: string) => {
      this.checkPageBreak(7);
      this.doc.text(line, this.margin, this.yPosition);
      this.yPosition += 5;
    });
    this.yPosition += 3;
  }

  addSection(title: string) {
    this.checkPageBreak(15);
    this.yPosition += 5;
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.yPosition);
    this.yPosition += 8;
  }

  private checkPageBreak(requiredSpace: number) {
    if (this.yPosition + requiredSpace > this.pageHeight - this.margin - 15) {
      this.doc.addPage();
      this.yPosition = this.margin;
    }
  }

  private addFooter() {
    const pageCount = (this.doc as any).getNumberOfPages?.() ?? this.doc.internal.getNumberOfPages();
    this.doc.setFontSize(8);
    this.doc.setTextColor(150);

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
    }

    this.doc.setTextColor(0);
  }

  download(filename: string) {
    this.addFooter();
    this.doc.save(`${filename}.pdf`);
  }

  getBlob(): Blob {
    this.addFooter();
    return this.doc.output('blob');
  }
}
