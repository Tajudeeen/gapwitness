import { localEvidence, validateEvidence } from "./evidence.ts";
export type Verdict = "INTACT" | "GAPPED" | "IMPOSSIBLE";

export type ChainCommitment = {
  stationId: string;
  windowStart: number;
  windowEnd: number;
  seriesHash: string;
  gapHash: string;
  policyHash: string;
  verdict: number;
};

export type CheckResult = {
  stationId: string;
  windowStart: string;
  windowEnd: string;
  seriesType: string;
  expectedHours: number;
  observedHours: number;
  observations: { timestamp: string; value: number }[];
  missingTimestamps: string[];
  materialGap: boolean;
  impossibleTimestamps: string[];
  verdict: Verdict;
  verdictCode: number;
  seriesHash: string;
  gapHash: string;
  policyHash: string;
  chainCommitment: ChainCommitment;
};

export type CheckerError = {
  status: number;
  code: string;
};

export const CHECKER_URL = (
  (import.meta.env ?? {}).VITE_CHECKER_URL || "http://localhost:8000"
).replace(/\/$/, "");

async function readError(response: Response): Promise<CheckerError> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const detail =
      typeof body.detail === "string" ? body.detail : "INSPECTION_FAILED";
    return { status: response.status, code: detail };
  } catch {
    return { status: response.status, code: "INSPECTION_FAILED" };
  }
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`${CHECKER_URL}/health`, {
    method: "GET",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
  });
  return response.ok;
}

export async function inspectCsv(input: {
  stationId: string;
  windowStart: string;
  windowEnd: string;
  seriesType: string;
  csv: File;
  signal?: AbortSignal;
}): Promise<CheckResult> {
  if (input.csv.size < 1 || input.csv.size > 1000000) throw {status: 422, code: "CSV must contain 1–1,000,000 bytes."};
  let local: CheckResult;
  try { local = localEvidence(new Uint8Array(await input.csv.arrayBuffer()), input); }
  catch (error) { throw { status: 422, code: error instanceof Error ? error.message : "INVALID_LOCAL_INPUT" }; }
  if (input.signal?.aborted) throw new DOMException("Inspection cancelled", "AbortError");
  const form = new FormData();
  form.append("stationId", input.stationId);
  form.append("windowStart", input.windowStart);
  form.append("windowEnd", input.windowEnd);
  form.append("seriesType", input.seriesType);
  form.append("csv", input.csv, input.csv.name);

  const response = await fetch(`${CHECKER_URL}/inspect`, {
    method: "POST",
    body: form,
    signal: input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw await readError(response);
  }

  try { return validateEvidence(await response.json(), local); }
  catch (error) { throw { status: 502, code: error instanceof Error ? error.message : "CHECKER_EVIDENCE_MISMATCH" }; }
}
