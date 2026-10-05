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
- Location ID: fill after station selection.
- Date: fill after selecting the 24-hour demo window.
- Sensor ID: fill after confirming which PM2.5 sensor produced the selected rows.

OpenAQ states that archive files can be retroactively patched. GapWitness therefore commits the exact downloaded CSV bytes and separately records the source object URL and acquisition date. The chain proves the submitted file's temporal evidence, not that the upstream archive will never change.

OpenAQ's hourly timestamps use an exclusive time-ending convention. GapWitness must document that convention beside the selected window rather than silently treating timestamps as interval starts.
