import pytest
from check_submission import submission_gaps


def complete_record():
    return {'videoUrl': 'https://youtu.be/example', 'videoDurationSeconds': 229,
            'videoPlaybackChecked': True, 'devpostProjectUrl': 'https://devpost.com/software/gapwitness',
            'submissionStatus': 'submitted-publicly-listed',
            'submissionEvidenceUrl': 'https://devpost.com/software/gapwitness',
            'organizerEligibilityConfirmed': True}


def test_complete_record_passes_and_public_short_clip_does_not():
    record = complete_record()
    assert submission_gaps(record) == []
    record['videoDurationSeconds'] = 153
    assert submission_gaps(record) == ['Linked public video is 153 seconds. Rules require 180–300 seconds.']


@pytest.mark.parametrize('duration', [None, True, 0, -1, float('nan'), float('inf'), '229', 179, 301])
def test_invalid_or_out_of_range_duration_does_not_pass(duration):
    record = complete_record() | {'videoDurationSeconds': duration}
    assert len(submission_gaps(record)) == 1


@pytest.mark.parametrize('duration', [180, 300])
def test_rules_include_both_duration_boundaries(duration):
    assert submission_gaps(complete_record() | {'videoDurationSeconds': duration}) == []


def test_url_alone_does_not_prove_submission_or_playback():
    record = complete_record() | {'submissionStatus': 'draft', 'videoPlaybackChecked': False}
    gaps = submission_gaps(record)
    assert len(gaps) == 2
    assert any('draft URL' in gap for gap in gaps)
    assert any('playback' in gap for gap in gaps)


@pytest.mark.parametrize('url', ['https://devpost.com.evil.example/software/x',
                                 'https://user:secret@devpost.com/software/x',
                                 'https://devpost.com/', 'https://devpost.com/software/'])
def test_wrong_host_credentials_and_nonproject_urls_are_rejected(url):
    record = complete_record() | {'devpostProjectUrl': url, 'submissionEvidenceUrl': url}
    assert len(submission_gaps(record)) == 2

