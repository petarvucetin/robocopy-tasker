import type { RobocopyOptions } from "../../lib/types";

interface CommandPreviewProps {
  source: string;
  destination: string;
  options: RobocopyOptions;
  logDirectory: string;
  taskName: string;
}

export function buildCommandArgs(
  source: string,
  destination: string,
  options: RobocopyOptions,
  logDirectory: string,
  taskName: string
): string[] {
  const args: string[] = [source, destination];

  if (options.s) args.push("/S");
  if (options.j) args.push("/J");
  if (options.sj) args.push("/SJ");
  if (options.mt != null) args.push(`/MT:${options.mt}`);
  if (options.xj) args.push("/XJ");
  if (options.xjd) args.push("/XJD");
  if (options.xjf) args.push("/XJF");
  if (options.tee) args.push("/TEE");
  if (options.r != null) args.push(`/R:${options.r}`);
  if (options.w != null) args.push(`/W:${options.w}`);
  for (const xd of options.xd) {
    if (xd) args.push("/XD", `"${xd}"`);
  }
  for (const xf of options.xf) {
    if (xf) args.push("/XF", `"${xf}"`);
  }
  const logPath = options.log || `${logDirectory}\\${taskName.replace(/[^a-zA-Z0-9_-]/g, "-")}.log`;
  args.push(`/LOG:${logPath}`);

  return args;
}

export function CommandPreview({ source, destination, options, logDirectory, taskName }: CommandPreviewProps) {
  const args = buildCommandArgs(source, destination, options, logDirectory, taskName);

  return (
    <div className="bg-muted rounded-md p-3">
      <div className="text-xs text-muted-foreground mb-1">Command preview:</div>
      <code className="text-xs break-all whitespace-pre-wrap">
        robocopy {args.join(" ")}
      </code>
    </div>
  );
}
