export type CellType = "code" | "markdown";

export interface CellData {
  id: string;
  type: CellType;
  code: string;
  output: string | null;
  error: string | null;
  running: boolean;
  editing: boolean;
}
