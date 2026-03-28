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

  // Copy mode
  if (options.s) args.push("/S");
  if (options.e) args.push("/E");
  if (options.mir) args.push("/MIR");
  if (options.purge) args.push("/PURGE");
  if (options.mov) args.push("/MOV");
  if (options.move) args.push("/MOVE");
  if (options.create) args.push("/CREATE");

  // Copy flags
  if (options.z) args.push("/Z");
  if (options.b) args.push("/B");
  if (options.zb) args.push("/ZB");
  if (options.j) args.push("/J");
  if (options.copy) args.push(`/COPY:${options.copy}`);
  if (options.dcopy) args.push(`/DCOPY:${options.dcopy}`);
  if (options.sec) args.push("/SEC");
  if (options.copyall) args.push("/COPYALL");
  if (options.nodcopy) args.push("/NODCOPY");

  // Junctions
  if (options.sj) args.push("/SJ");
  if (options.xj) args.push("/XJ");

  // File selection
  for (const xd of options.xd) {
    if (xd) args.push("/XD", `"${xd}"`);
  }
  for (const xf of options.xf) {
    if (xf) args.push("/XF", `"${xf}"`);
  }
  if (options.maxage) args.push(`/MAXAGE:${options.maxage}`);
  if (options.minage) args.push(`/MINAGE:${options.minage}`);
  if (options.maxlad) args.push(`/MAXLAD:${options.maxlad}`);
  if (options.minlad) args.push(`/MINLAD:${options.minlad}`);
  if (options.max != null) args.push(`/MAX:${options.max}`);
  if (options.min != null) args.push(`/MIN:${options.min}`);

  // Performance
  if (options.mt != null) args.push(`/MT:${options.mt}`);
  if (options.r != null) args.push(`/R:${options.r}`);
  if (options.w != null) args.push(`/W:${options.w}`);

  // Log (always added)
  const logPath = options.log || `${logDirectory}\\${taskName.replace(/[^a-zA-Z0-9_-]/g, "-")}.log`;
  args.push(`/LOG:${logPath}`);

  // Output
  if (options.tee) args.push("/TEE");

  // Always-on flags for consistent behavior
  args.push("/BYTES", "/ETA");

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
