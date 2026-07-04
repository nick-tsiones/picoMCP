import { CartRepo, minifyCode, reportCartSize } from "@cat-cave/qdcli-core";
import { output, parsePositiveInteger, requiredArg } from "./args.js";

const repo = new CartRepo();

export async function minifyCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const rename = Boolean(options.rename);

  try {
    const cart = await repo.load(root, resolvedPath);
    const result = minifyCode(cart, { rename });
    await repo.save(root, resolvedPath, cart);
    output(result, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function editRangeCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const fromStr = requiredArg(stringOpt(options.from), "--from");
  const toStr = requiredArg(stringOpt(options.to), "--to");
  const code = requiredArg(stringOpt(options.code), "--code");
  const fromLine = parsePositiveInteger(fromStr, "--from");
  const toLine = parsePositiveInteger(toStr, "--to");

  if (fromLine > toLine) throw new Error("--from must be less than or equal to --to");

  try {
    const cart = await repo.load(root, resolvedPath);
    if (fromLine > cart.code.length) {
      outputError(
        `Tab ${fromLine} does not exist. Cartridge has ${cart.code.length} tab(s).`,
        json,
      );
      return;
    }
    if (toLine > cart.code.length) {
      outputError(`Tab ${toLine} does not exist. Cartridge has ${cart.code.length} tab(s).`, json);
      return;
    }

    cart.code = [
      ...cart.code.slice(0, fromLine - 1),
      ...code.split("\n"),
      ...cart.code.slice(toLine),
    ];
    await repo.save(root, resolvedPath, cart);
    const report = reportCartSize(cart);
    output(
      { ...report, replacedRange: { from: fromLine, to: toLine }, tabCount: cart.code.length },
      json,
    );
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function editReplaceCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const find = requiredArg(stringOpt(options.find), "--find");
  const replace = requiredArg(stringOpt(options.replace), "--replace");

  try {
    const cart = await repo.load(root, resolvedPath);
    let replacedCount = 0;
    const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    for (let i = 0; i < cart.code.length; i++) {
      const original = cart.code[i] ?? "";
      const updated = original.split(find).join(replace);
      if (updated !== original) {
        replacedCount += (original.match(new RegExp(escapedFind, "g")) || []).length;
        cart.code[i] = updated;
      }
    }

    if (replacedCount === 0) {
      output(
        { error: "nothing matched", message: "The find text was not found in the cartridge code" },
        json,
      );
      return;
    }

    await repo.save(root, resolvedPath, cart);
    const report = reportCartSize(cart);
    output({ ...report, replaced: replacedCount }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function editAppendCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const code = requiredArg(stringOpt(options.code), "--code");

  try {
    const cart = await repo.load(root, resolvedPath);
    cart.code = [...cart.code, ...code.split("\n")];
    await repo.save(root, resolvedPath, cart);
    const report = reportCartSize(cart);
    output({ ...report, tabCount: cart.code.length }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

function stringOpt(value: string | string[] | boolean | undefined): string | undefined {
  if (Array.isArray(value)) return value.at(-1);
  return typeof value === "string" ? value : undefined;
}

function outputError(message: string, json: boolean): void {
  if (json) console.log(JSON.stringify({ error: message, message }, null, 2));
  else console.error(message);
}

function handleCartError(error: unknown, json: boolean): void {
  if (error instanceof Error) {
    if (error.message === "cartridge was not found") {
      outputError("cartridge was not found", json);
      return;
    }
    if ((error as { code?: string }).code === "OUTSIDE_PROJECT") {
      outputError(error.message, json);
      return;
    }
  }
  throw error;
}
