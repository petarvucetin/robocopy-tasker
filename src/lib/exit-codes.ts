export type ExitStatus = "success" | "warning" | "error" | "cancelled" | "unknown";

export function getExitStatus(exitCode: number | null): ExitStatus {
  if (exitCode === null) return "unknown";
  if (exitCode === -1) return "cancelled";
  if (exitCode === -2) return "unknown";
  if (exitCode === -3) return "unknown";
  if ((exitCode & 0x18) !== 0) return "error";
  if (exitCode > 3) return "warning";
  return "success";
}

export function getExitLabel(exitCode: number | null): string {
  if (exitCode === null) return "Running...";
  if (exitCode === -1) return "Cancelled";
  if (exitCode === -2) return "Unknown (app closed)";
  if (exitCode === -3) return "Unknown";
  const labels: Record<number, string> = { 0: "Up to date", 1: "Files copied", 2: "Extras found", 3: "Copied + extras", 4: "Mismatches" };
  if (labels[exitCode]) return labels[exitCode];
  if ((exitCode & 0x10) !== 0) return "Fatal error";
  if ((exitCode & 0x08) !== 0) return "Copy failures";
  if (exitCode >= 4 && exitCode <= 7) return "Mixed results";
  return `Code ${exitCode}`;
}

export function getExitColor(status: ExitStatus): string {
  switch (status) {
    case "success": return "text-green-500";
    case "warning": return "text-yellow-500";
    case "error": return "text-red-500";
    case "cancelled": return "text-gray-400";
    case "unknown": return "text-gray-400";
  }
}
