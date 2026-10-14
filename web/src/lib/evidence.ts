import Papa from 'papaparse';
import { keccak256, toUtf8Bytes } from 'ethers';
import type { CheckResult } from './checker';

export function parseUtcHour(value: string): number {
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(text);
  if (!match) throw new Error('Use ISO timestamps with an explicit UTC offset or UTC hours.');
  const [, year, month, day, hour, minute, seconds = '0', fraction = '', offset = 'Z'] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(seconds)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(seconds) > 59 || /[1-9]/.test(fraction)) throw new Error('Invalid or sub-hour timestamp.');
  let shift = 0;
  if (offset !== 'Z') {
    const parts = offset.slice(1).replace(':', '');
    const offsetHour = Number(parts.slice(0, 2)), offsetMinute = Number(parts.slice(2));
    if (offsetHour > 23 || offsetMinute > 59) throw new Error('Invalid timezone offset.');
    shift = (offsetHour * 60 + offsetMinute) * 60000 * (offset[0] === '+' ? 1 : -1);
  }
  const time = date.getTime() - shift;
  if (!Number.isSafeInteger(time) || time % 3600000 !== 0) throw new Error('Timestamp must align to a UTC hour.');
  return time;
}
const utcText = (time: number) => new Date(time).toISOString().replace('.000Z', 'Z');

export function localEvidence(bytes: Uint8Array, input: { stationId: string; windowStart: string; windowEnd: string; seriesType: string }): CheckResult {
  const stationId = input.stationId.trim();
  if (!stationId || new TextEncoder().encode(stationId).length > 31 || stationId.includes('\0')) throw new Error('Station ID must contain 1–31 UTF-8 bytes and no NUL character.');
  if (!bytes.length || bytes.length > 1000000) throw new Error('CSV must contain 1–1,000,000 bytes.');
  const start = parseUtcHour(input.windowStart), end = parseUtcHour(input.windowEnd);
  const expectedHours = (end - start) / 3600000;
  if (start < 0 || expectedHours < 1 || expectedHours > 744) throw new Error('Window must contain 1–744 UTC hours after the Unix epoch.');
  if (!['pm25', 'generic'].includes(input.seriesType)) throw new Error('Unsupported series policy.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const csv = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  if (csv.errors.length || csv.data.length < 2) throw new Error('Invalid CSV.');
  const header = csv.data[0];
  if (new Set(header).size !== header.length || !header.includes('timestamp') || !header.includes('value')) throw new Error('CSV needs unique timestamp and value columns.');
  const timestampIndex = header.indexOf('timestamp'), valueIndex = header.indexOf('value');
  const seen = new Set<number>();
  const observations: {timestamp: string; value: number}[] = [];
  for (const row of csv.data.slice(1)) {
    if (row.length !== header.length) throw new Error('CSV row has a different number of fields from its header.');
    const time = parseUtcHour(row[timestampIndex]);
    if (seen.has(time)) throw new Error('Duplicate observation timestamp.');
    seen.add(time);
    const numeric = row[valueIndex].trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(numeric)) throw new Error('Invalid numeric measurement.');
    const value = Number(numeric);
    if (!Number.isFinite(value)) throw new Error('Measurement must be finite.');
    if (time >= start && time < end) observations.push({ timestamp: utcText(time), value });
  }
  if (!observations.length) throw new Error('No observations inside the declared window.');
  observations.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const missingTimestamps = Array.from({ length: expectedHours }, (_, i) => start + i * 3600000).filter(time => !seen.has(time)).map(utcText);
  const impossibleTimestamps = input.seriesType === 'pm25' ? observations.filter(point => point.value < 0).map(point => point.timestamp) : [];
  const verdict = impossibleTimestamps.length ? 'IMPOSSIBLE' : missingTimestamps.length ? 'GAPPED' : 'INTACT';
  const verdictCode = {INTACT: 0, GAPPED: 1, IMPOSSIBLE: 2}[verdict];
  const seriesHash = keccak256(bytes);
  const gapHash = keccak256(toUtf8Bytes(missingTimestamps.join('\n')));
  const policyHash = keccak256(toUtf8Bytes(`gapwitness/${input.seriesType}/hourly/v1`));
  return {stationId, windowStart: utcText(start), windowEnd: utcText(end), seriesType: input.seriesType,
    expectedHours, observedHours: observations.length, observations, missingTimestamps,
    materialGap: missingTimestamps.length > 2, impossibleTimestamps, verdict, verdictCode,
    seriesHash, gapHash, policyHash,
    chainCommitment: {stationId, windowStart: start / 1000, windowEnd: end / 1000, seriesHash, gapHash, policyHash, verdict: verdictCode}};
}

export function validateEvidence(remote: unknown, local: CheckResult): CheckResult {
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) throw new Error('Checker response is not an evidence object.');
  const result = remote as Record<string, unknown>;
  for (const key of Object.keys(local) as (keyof CheckResult)[]) {
    const expected = local[key];
    const actual = result[key];
    if (key === 'chainCommitment') {
      if (!actual || typeof actual !== 'object') throw new Error('Invalid chain commitment.');
      for (const [field, value] of Object.entries(local.chainCommitment)) {
        if ((actual as Record<string, unknown>)[field] !== value) throw new Error(`Checker commitment mismatch: ${field}`);
      }
    } else if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Checker evidence mismatch: ${key}`);
    }
  }
  return local;
}
