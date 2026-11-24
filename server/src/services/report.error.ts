export class ReportError extends Error {
  constructor(
    message: string,
    public status: number,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ReportError";
  }
}
