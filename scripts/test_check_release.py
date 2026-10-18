from check_release import submission_gaps


def test_external_evidence_must_be_explicit_and_public():
    gaps = submission_gaps({'videoUrl': None, 'devpostProjectUrl': 'https://devpost.com.evil.example/project', 'organizerEligibilityConfirmed': 'yes'})
    assert len(gaps) == 3
    assert len(submission_gaps({'videoUrl': 'https://user:secret@youtube.com/watch?v=x', 'devpostProjectUrl': 'https://devpost.com/software/gapwitness', 'organizerEligibilityConfirmed': True})) == 1
    assert submission_gaps({'videoUrl': 'https://youtu.be/example', 'devpostProjectUrl': 'https://devpost.com/software/gapwitness', 'organizerEligibilityConfirmed': True}) == []
