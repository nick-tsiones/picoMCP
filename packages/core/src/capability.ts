import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export interface Pico8CapabilityReport {
  present: boolean;
  binaryPath: string | null;
  version: string | null;
  runtime: {
    runnable: boolean;
    exportable: boolean;
  };
  static: {
    available: boolean;
  };
}

export async function detectPico8Capability(
  binaryPath?: string | null,
): Promise<Pico8CapabilityReport> {
  const resolved =
    binaryPath && binaryPath.trim() ? path.resolve(binaryPath) : await locateBinary();
  const present = resolved !== null;
  return {
    present,
    binaryPath: resolved,
    version: present ? "unknown" : null,
    runtime: {
      runnable: present,
      exportable: present,
    },
    static: {
      available: true,
    },
  };
}

export async function hasPico8Binary(binaryPath?: string | null): Promise<boolean> {
  const report = await detectPico8Capability(binaryPath);
  return report.present;
}

async function locateBinary(): Promise<string | null> {
  const candidates = [
    process.env.PICO8_BIN,
    process.env.PICO_8_BIN,
    process.env.PICO8,
    process.env.PICO_8,
  ].filter((value): value is string => Boolean(value && value.trim()));
  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return path.resolve(candidate);
  }
  return null;
}

async function isExecutable(candidate: string): Promise<boolean> {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
