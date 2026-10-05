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
  import.meta.env.VITE_CHECKER_URL || "http://localhost:8000"
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
    signal,
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
  const form = new FormData();
  form.append("stationId", input.stationId);
  form.append("windowStart", input.windowStart);
  form.append("windowEnd", input.windowEnd);
  form.append("seriesType", input.seriesType);
  form.append("csv", input.csv, input.csv.name);

  const response = await fetch(`${CHECKER_URL}/inspect`, {
    method: "POST",
    body: form,
    signal: input.signal,
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return (await response.json()) as CheckResult;
}
