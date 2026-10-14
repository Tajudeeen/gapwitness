# Retained real-source evaluation

The application includes thirteen unedited normalized windows from four stations and two providers. Twelve are seven-day PM2.5 windows from Defra UK-AIR stations Leicester University (LECU), Harwell (HM), and York Fishergate (YK11). The thirteenth is the retained complete AirNow Del Norte window accessed through OpenAQ.

The UK windows were selected before inspection: the first seven reporting days of January, April, July, and October 2025. The annual upstream files are linked in data/corpus/manifest.json. Each selected raw slice retains all upstream columns, metadata, and reporting statuses. The normalized CSV preserves numeric measurement text. GMT hour-ending 24:00 labels become next-day 00:00 UTC. Blank PM2.5 cells become unavailable observations. No numeric reading is removed or edited.

All thirteen windows match the independent missing-hour reference. Three York windows contain unavailable readings: January has one, April has two, and October has two. The non-negative PM2.5 policy also flags supplied negative measurements in York's January and July windows. A flag does not establish source error, fraud, or operator misconduct; correction and instrument effects require scientific interpretation. The bounded selection does not estimate national provider reliability.

The experimental schedule follows the published hourly file format. Station operators have not certified the chosen reporting windows. Source hashes establish the retained bytes, not operator endorsement.

Reproduce offline:

```sh
python scripts/verify_real_corpus.py
cd web
npm test
```

Acquire and rebuild from upstream:

```sh
python scripts/build_real_corpus.py --source-dir /tmp/gapwitness-source-data --acquire
```

Upstream revisions can change annual-file hashes. The committed raw slices, normalized bytes, manifest, and independent references make the frozen evaluation reproducible. Both Python and browser implementations recompute the full evidence. The UI checks each selected CSV's SHA-256 before use.

UK attribution: Contains public sector information licensed under the Open Government Licence v3.0. Source: Defra, uk-air.defra.gov.uk. AirNow attribution and its retained provenance are included in the manifest. No provider endorsement is implied.
