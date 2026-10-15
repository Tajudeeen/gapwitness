import type {CheckResult} from './checker';

export type MeanImpact = {
  expectedHours: number;
  retainedHours: number;
  missingHours: number;
  fullMean: number;
  submittedMean: number;
  relativeChangePercent: number;
};

/** Descriptive arithmetic for two measured versions of the SAME declared hourly window.
 * This does not estimate missing readings or establish why observations disappeared.
 */
export function compareObservedMeans(complete: CheckResult, incomplete: CheckResult): MeanImpact {
  if (complete.stationId !== incomplete.stationId ||
      complete.windowStart !== incomplete.windowStart ||
      complete.windowEnd !== incomplete.windowEnd ||
      complete.policyHash !== incomplete.policyHash ||
      complete.seriesType !== 'pm25' ||
      complete.expectedHours !== incomplete.expectedHours ||
      complete.verdict !== 'INTACT' || incomplete.verdict !== 'GAPPED') {
    throw new Error('Means can only be compared for a complete and a gapped PM2.5 file with the same declared window and policy.');
  }
  const expected = new Map(complete.observations.map(point => [point.timestamp, point.value]));
  if (expected.size !== complete.expectedHours ||
      incomplete.observations.length !== incomplete.observedHours ||
      incomplete.missingTimestamps.length !== complete.expectedHours - incomplete.observedHours ||
      incomplete.observations.some(point => expected.get(point.timestamp) !== point.value) ||
      complete.observations.some(point => !Number.isFinite(point.value) || point.value < 0)) {
    throw new Error('Comparison requires a pure omission with unchanged non-negative observations.');
  }
  const average = (points: CheckResult['observations']) =>
    points.reduce((sum, point) => sum + point.value, 0) / points.length;
  const fullMean = average(complete.observations);
  const submittedMean = average(incomplete.observations);
  if (!Number.isFinite(fullMean) || fullMean === 0 || !Number.isFinite(submittedMean)) {
    throw new Error('A percentage comparison requires finite means and a non-zero source mean.');
  }
  return {
    expectedHours: complete.expectedHours,
    retainedHours: incomplete.observedHours,
    missingHours: incomplete.missingTimestamps.length,
    fullMean, submittedMean,
    relativeChangePercent: (submittedMean / fullMean - 1) * 100
  };
}
