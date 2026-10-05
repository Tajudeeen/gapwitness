# OpenAQ source record

GapWitness demo data source: OpenAQ public archive.

- Archive: https://openaq-data-archive.s3.amazonaws.com/
- Archive structure: `records/csv.gz/locationid={locationid}/year={year}/month={month}/location-{locationid}-{YYYYMMDD}.csv.gz`
- Parameter: PM2.5 (`pm25`)
- Output columns: `timestamp,value`
- Time handling: preserve OpenAQ timestamps, then normalize to UTC before inspection.
- License: varies by underlying data provider. Record the provider/license for the selected location before submission.
- Acquisition date: record the date the archive object was downloaded.
- Source file URL: record the exact object URL used.
- Location ID: record the selected location ID.
- Date: record the archive date used for the demo.
- Sensor ID: record the exact PM2.5 sensor used for the frozen window.

OpenAQ states that archive files can be retroactively patched. GapWitness therefore commits the exact downloaded CSV bytes and separately records the source object URL and acquisition date. The chain proves the submitted file's temporal evidence, not that the upstream archive will never change.

OpenAQ's hourly timestamps use an exclusive time-ending convention. GapWitness must document that convention beside the selected window rather than silently treating timestamps as interval starts.

## Required provenance manifest

The fetcher can emit a machine-readable manifest with `--manifest`. For a submission-ready source, the manifest must preserve:

- exact archive object URL
- OpenAQ location ID
- selected PM2.5 sensor ID
- archive object SHA-256
- normalized CSV SHA-256
- normalized row count
- UTC acquisition date
- OpenAQ exclusive-time-ending timestamp convention

Do not fill these fields with estimates. The manifest is generated from the downloaded object and the selected sensor filter.

## Sensor and window discovery

When the PM2.5 sensor is not known, run `scripts/discover_openaq_window.py` against a real archive day.

The discovery command:

- downloads exactly one public archive object
- filters to PM2.5
- groups rows by sensor ID
- rejects duplicate hourly instants per sensor
- rejects non-hour UTC timestamps
- finds the earliest complete window for each usable sensor
- sorts candidates by window start, then sensor ID
- records the archive SHA-256 in the candidate manifest

The reported `selection` is a candidate only. It is not a frozen demo fixture until the selected sensor/day is fetched and the exact 24-hour rows are written to the repository with their provenance hashes.

## Window freeze

After selecting a candidate sensor, run `scripts/select_openaq_window.py`.

The selector only accepts exact UTC-hour timestamps, rejects duplicate instants, and chooses the earliest complete window of the requested size. For the demo, the requested size is 24 hours.

The selector writes a frozen source-window CSV and records:

- source file SHA-256
- location ID
- sensor ID
- exact UTC window
- input and selected row counts
- frozen output SHA-256
- selection algorithm
- OpenAQ exclusive-time-ending convention

The frozen window becomes the only source input for the adversarial fixture derivation. No measurement values are altered.
