"""Check recorded submission evidence without inferring approval or live playback."""
import argparse
import json
import math
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def public_https(value: object, host: str | None = None) -> bool:
    if not isinstance(value, str):
        return False
    try:
        url = urlparse(value)
        return (url.scheme == 'https' and bool(url.hostname) and not url.username
                and not url.password and (not host or url.hostname == host))
    except ValueError:
        return False


def devpost_project(value: object) -> bool:
    return public_https(value, 'devpost.com') and urlparse(value).path.startswith('/software/') and bool(urlparse(value).path.removeprefix('/software/').strip('/'))


def submission_gaps(links: dict) -> list[str]:
    gaps = []
    if not public_https(links.get('videoUrl')):
        gaps.append('Public demo video URL is missing or invalid.')
    seconds = links.get('videoDurationSeconds')
    if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not math.isfinite(seconds) or seconds <= 0:
        gaps.append('Public video duration has not been recorded. Rules require 180–300 seconds.')
    elif not 180 <= seconds <= 300:
        gaps.append(f'Linked public video is {seconds:g} seconds. Rules require 180–300 seconds.')
    if links.get('videoPlaybackChecked') is not True:
        gaps.append('Signed-out playback of the linked video has not been checked.')
    if not devpost_project(links.get('devpostProjectUrl')):
        gaps.append('Devpost project URL is missing or invalid.')
    if links.get('submissionStatus') != 'submitted-publicly-listed' or not devpost_project(links.get('submissionEvidenceUrl')):
        gaps.append('A public submission listing has not been recorded. A draft URL alone is insufficient.')
    if links.get('organizerEligibilityConfirmed') is not True:
        gaps.append('Written organizer eligibility clarification remains unrecorded; overview and rules conflict.')
    return gaps


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--links', type=Path, default=ROOT / 'docs/submission-links.json')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    links = json.loads(args.links.read_text())
    gaps = submission_gaps(links)
    report = {'format': 'gapwitness/submission-check/v1', 'recordedChecksPassed': not gaps,
              'gaps': gaps, 'limits': ['Checks supplied records only. Does not play video, authenticate an organizer reply, or establish acceptance or prize eligibility.']}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return 1 if gaps else 0


if __name__ == '__main__':
    raise SystemExit(main())
