import type { RobocopyOptions } from "./types";

export interface OptionWarning {
  level: "error" | "warn";
  message: string;
}

export function detectConflicts(opts: RobocopyOptions): OptionWarning[] {
  const warnings: OptionWarning[] = [];

  // /Z and /MT are incompatible — robocopy does not support restartable mode with multithreading
  if (opts.z && opts.mt != null) {
    warnings.push({ level: "error", message: "/Z (restartable) is incompatible with /MT (multithreading). Robocopy may hang or silently ignore /Z." });
  }

  // /B and /MT are incompatible
  if (opts.b && opts.mt != null) {
    warnings.push({ level: "error", message: "/B (backup mode) is incompatible with /MT (multithreading)." });
  }

  // /ZB and /MT are incompatible
  if (opts.zb && opts.mt != null) {
    warnings.push({ level: "error", message: "/ZB (restartable + backup) is incompatible with /MT (multithreading)." });
  }

  // /Z and /J conflict — unbuffered I/O bypasses cache, restartable mode needs position tracking
  if (opts.z && opts.j) {
    warnings.push({ level: "warn", message: "/Z (restartable) and /J (unbuffered I/O) work against each other. /J is ignored when /Z is active." });
  }

  // /ZB and /J same issue
  if (opts.zb && opts.j) {
    warnings.push({ level: "warn", message: "/ZB (restartable + backup) and /J (unbuffered I/O) work against each other." });
  }

  // /Z, /B, /ZB are mutually exclusive
  const copyModes = [opts.z && "/Z", opts.b && "/B", opts.zb && "/ZB"].filter(Boolean);
  if (copyModes.length > 1) {
    warnings.push({ level: "error", message: `${copyModes.join(", ")} are mutually exclusive. Pick one copy mode.` });
  }

  // /MIR implies /E and /PURGE — warn about redundancy
  if (opts.mir && opts.e) {
    warnings.push({ level: "warn", message: "/MIR already includes /E. /E is redundant." });
  }
  if (opts.mir && opts.purge) {
    warnings.push({ level: "warn", message: "/MIR already includes /PURGE. /PURGE is redundant." });
  }

  // /S and /E are redundant — /E is a superset of /S
  if (opts.s && opts.e) {
    warnings.push({ level: "warn", message: "/E includes everything /S does (plus empty dirs). /S is redundant." });
  }

  // /MIR and /S — /MIR includes /E which is a superset of /S
  if (opts.mir && opts.s) {
    warnings.push({ level: "warn", message: "/MIR already includes /E (superset of /S). /S is redundant." });
  }

  // /MOV and /MOVE are mutually exclusive
  if (opts.mov && opts.move) {
    warnings.push({ level: "error", message: "/MOV (move files) and /MOVE (move files+dirs) are mutually exclusive." });
  }

  // /MOV or /MOVE with /MIR is dangerous
  if ((opts.mov || opts.move) && opts.mir) {
    warnings.push({ level: "warn", message: "/MIR with /MOV or /MOVE will delete source files AND purge extra dest files. This is usually not what you want." });
  }

  // /SJ and /XJ conflict — can't copy junctions and exclude them
  if (opts.sj && opts.xj) {
    warnings.push({ level: "error", message: "/SJ (copy junctions) and /XJ (exclude junctions) are contradictory." });
  }

  // /SEC and /COPYALL redundancy
  if (opts.sec && opts.copyall) {
    warnings.push({ level: "warn", message: "/COPYALL already includes security info. /SEC is redundant." });
  }

  // /COPY and /COPYALL redundancy
  if (opts.copy && opts.copyall) {
    warnings.push({ level: "warn", message: "/COPYALL overrides /COPY. /COPY is redundant." });
  }

  // /NODCOPY and /DCOPY conflict
  if (opts.nodcopy && opts.dcopy) {
    warnings.push({ level: "error", message: "/NODCOPY and /DCOPY conflict — can't copy no directory info and specify directory copy flags." });
  }

  // /MT:64+ is very aggressive
  if (opts.mt != null && opts.mt > 32) {
    warnings.push({ level: "warn", message: `/MT:${opts.mt} is very aggressive. For local disk-to-disk copies, 8-16 threads is typically optimal.` });
  }

  // /CREATE with copy modes is unusual
  if (opts.create && (opts.mir || opts.mov || opts.move)) {
    warnings.push({ level: "warn", message: "/CREATE (zero-length files only) combined with /MIR, /MOV, or /MOVE is unusual and may not behave as expected." });
  }

  return warnings;
}
