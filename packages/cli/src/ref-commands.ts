import { getApiIndex, getPitfalls } from "@cat-cave/qdcli-core";
import { output } from "./args.js";

export async function refApiCommand(json: boolean): Promise<void> {
  const api = getApiIndex();
  output({ functions: api }, json);
}

export async function refPitfallsCommand(json: boolean): Promise<void> {
  const pitfalls = getPitfalls();
  output({ pitfalls }, json);
}