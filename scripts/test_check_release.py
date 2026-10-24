from check_release import submission_gaps


def test_external_evidence_must_be_explicit_and_public():
    gaps = submission_gaps({'videoUrl': None, 'devpostProjectUrl': 'https://devpost.com.evil.example/project', 'organizerEligibilityConfirmed': 'yes'})
    assert any('URL' in gap for gap in gaps)
    assert any('clarification' in gap for gap in gaps)
    assert any('duration' in gap for gap in gaps)
