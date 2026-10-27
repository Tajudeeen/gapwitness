import type {CheckResult} from './checker';

/** Bounds use the PM2.5 non-negative policy. Unknown observations have no finite upper bound. */
export function reportingDecision(evidence:CheckResult,threshold:number) {
  if(!Number.isFinite(threshold)||threshold<0)throw new Error('Enter a finite non-negative mean threshold in µg/m³.');
  const availableMean=evidence.observations.reduce((total,row)=>total+row.value/evidence.observedHours,0);
  const lowerMean=evidence.observations.reduce((total,row)=>total+row.value/evidence.expectedHours,0);
  const invalid=evidence.seriesType!=='pm25'||evidence.impossibleTimestamps.length>0;
  const status=invalid?'UNRESOLVED':lowerMean>threshold?'NOT_SUPPORTED':evidence.missingTimestamps.length?'UNRESOLVED':'SUPPORTED';
  return {format:'gapwitness/reporting-decision/v1' as const,seriesHash:evidence.seriesHash,
    stationId:evidence.stationId,windowStart:evidence.windowStart,windowEnd:evidence.windowEnd,
    expectedHours:evidence.expectedHours,observedHours:evidence.observedHours,policyHash:evidence.policyHash,
    claim:'The arithmetic mean over the declared hourly window is at most the threshold.',threshold,
    availableMean,lowerMean:invalid?null:lowerMean,upperMean:invalid||evidence.missingTimestamps.length?null:lowerMean,
    status,availableRowsOnly:invalid?'cannot assess':availableMean<=threshold?'would support':'would not support',
    reason:invalid?'The non-negative PM2.5 policy is not satisfied. Request validated measurements.':
      status==='UNRESOLVED'?'Missing values could change this conclusion. Obtain the missing records before accepting this claim.':
      status==='NOT_SUPPORTED'?'Even assigning zero to every missing hour leaves the mean above the threshold.':
      'All expected hours are present and their arithmetic mean is within the threshold.',
    limits:'Conditional on the declared schedule and non-negative measurements. This is a user-defined arithmetic check, not an AQI, regulatory threshold, sensor certification or measured environmental outcome. Null upper bound means unbounded, not zero.'};
}
