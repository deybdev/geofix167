import { Download, Presentation, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "./ui/toast";
import { downloadAdminWorkbook, printAdminReport } from "../utils/adminReports";

export default function AdminReportActions({ filename, rows, columns, label = "Export Excel", title, presentationPath }) {
  const exportCsv = () => {
    downloadAdminWorkbook({ filename, title: title ?? filename.replaceAll("-", " "), rows, columns });
    toast.add({
      type: "success",
      title: "Report generated",
      description: `${rows.length} filtered record${rows.length === 1 ? "" : "s"} exported to a formatted Excel workbook.`,
    });
  };

  return <div className="admin-report-actions print:hidden">
    <button type="button" onClick={exportCsv} className="gf-btn gf-btn--chip" disabled={!rows.length}>
      <Download size={12} /> {label}
    </button>
    <button type="button" onClick={printAdminReport} className="gf-btn gf-btn--chip">
      <Printer size={12} /> Print / PDF
    </button>
    {presentationPath && <Link to={presentationPath} className="gf-btn gf-btn--chip"><Presentation size={12} /> Presentation</Link>}
  </div>;
}
