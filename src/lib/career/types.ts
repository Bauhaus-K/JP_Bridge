export type CareerEvent =
  | { type: "progress"; outputChars: number; attempt: number }
  | { type: "result"; id: string }
  | { type: "error"; code: string; message: string };
