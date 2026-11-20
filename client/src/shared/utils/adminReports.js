const xmlEscape = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const flatten = (value) => {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(flatten).join("; ");
  if (typeof value === "object") return Object.entries(value)
    .map(([key, nested]) => `${key}: ${flatten(nested)}`)
    .join("; ");
  return value;
};

const labelFor = (key) => key
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replaceAll("_", " ")
  .replace(/^./, (letter) => letter.toUpperCase());

const statusStyle = (value, rowIndex) => {
  const text = String(value).toLowerCase();
  if (/resolved|verified|complete|approved|accepted|published|closed/.test(text)) return "StatusGreen";
  if (/rejected|denied|critical|overdue|restricted|takeover|failed/.test(text)) return "StatusRed";
  if (/pending|awaiting|reported|review|warning/.test(text)) return "StatusAmber";
  if (/progress|dispatch|assigned|active/.test(text)) return "StatusBlue";
  return rowIndex % 2 ? "RowAlt" : "Row";
};

export function downloadAdminWorkbook({ filename, title, rows, columns, subtitle }) {
  const records = Array.isArray(rows) ? rows : [];
  const definitions = columns?.length
    ? columns
    : [...new Set(records.flatMap((record) => Object.keys(record ?? {})))]
      .map((key) => ({ key, label: labelFor(key) }));
  const generated = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const sheetName = xmlEscape((title || "Admin Report").slice(0, 31));
  const columnXml = definitions.map(({ width, label, key }) => {
    const estimated = Math.min(260, Math.max(80, (width ?? Math.max(String(label ?? key).length * 8, 100))));
    return `<Column ss:AutoFitWidth="0" ss:Width="${estimated}"/>`;
  }).join("");
  const headerXml = definitions.map(({ label, key }) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(label ?? labelFor(key))}</Data></Cell>`).join("");
  const rowsXml = records.map((record, rowIndex) => `<Row ss:Height="20">${definitions.map(({ key, value, type }) => {
    const raw = flatten(value ? value(record) : record?.[key]);
    const numeric = type === "Number" || (type !== "String" && typeof raw === "number");
    const style = numeric ? "Number" : statusStyle(raw, rowIndex);
    return `<Cell ss:StyleID="${style}"><Data ss:Type="${numeric ? "Number" : "String"}">${xmlEscape(raw)}</Data></Cell>`;
  }).join("")}</Row>`).join("");
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#263246"/></Style>
  <Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="18" ss:Bold="1" ss:Color="#0E5A2E"/><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="Meta"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#60738F"/></Style>
  <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2E8B57" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#256F46"/></Borders></Style>
  <Style ss:ID="Row"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8EB"/></Borders><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  <Style ss:ID="RowAlt" ss:Parent="Row"><Interior ss:Color="#F6FAF8" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Number" ss:Parent="Row"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><NumberFormat ss:Format="0.00;-0.00;0"/></Style>
  <Style ss:ID="StatusGreen" ss:Parent="Row"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#146C43"/><Interior ss:Color="#E7F4ED" ss:Pattern="Solid"/></Style>
  <Style ss:ID="StatusAmber" ss:Parent="Row"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#9A6700"/><Interior ss:Color="#FFF4CE" ss:Pattern="Solid"/></Style>
  <Style ss:ID="StatusRed" ss:Parent="Row"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#B42318"/><Interior ss:Color="#FEECEB" ss:Pattern="Solid"/></Style>
  <Style ss:ID="StatusBlue" ss:Parent="Row"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#175CD3"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="${sheetName}"><Table>
  ${columnXml}
  <Row ss:Height="28"><Cell ss:StyleID="Title" ss:MergeAcross="${Math.max(0, definitions.length - 1)}"><Data ss:Type="String">${xmlEscape(title || "GeoFix 167 Admin Report")}</Data></Cell></Row>
  <Row ss:Height="18"><Cell ss:StyleID="Meta" ss:MergeAcross="${Math.max(0, definitions.length - 1)}"><Data ss:Type="String">${xmlEscape(subtitle || `Generated ${generated} · Barangay 167, Caloocan City`)}</Data></Cell></Row>
  <Row ss:Height="8"/>
  <Row ss:Height="24">${headerXml}</Row>
  ${rowsXml}
 </Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>
</Workbook>`;
  const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function printAdminReport() {
  window.print();
}
