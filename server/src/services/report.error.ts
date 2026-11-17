export class ReportError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ReportError";
  }
}
