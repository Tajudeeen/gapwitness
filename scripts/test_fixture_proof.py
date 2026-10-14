import sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prove_fixture_onchain import check_rejection, find_revert_data, keccak256, validate_receipt, EVENT_TOPIC

PRIOR = '0x' + 'ab' * 32
NEXT = '0x' + 'cd' * 32
EXPECTED = '0x' + keccak256(b'GapPaperedOver(bytes32,bytes32)')[:8] + PRIOR[2:] + NEXT[2:]

def test_requires_exact_custom_error_and_hash_arguments():
    assert check_rejection({'error': {'data': EXPECTED}}, PRIOR, NEXT) == EXPECTED
    with pytest.raises(RuntimeError, match='exact expected'):
        check_rejection({'error': {'data': EXPECTED}}, NEXT, PRIOR)
    with pytest.raises(RuntimeError, match='unexpectedly succeeded'):
        check_rejection({'result': '0x'}, PRIOR, NEXT)
    with pytest.raises(RuntimeError, match='exact expected'):
        check_rejection({'error': {'message': 'execution reverted'}}, PRIOR, NEXT)

def test_nested_rpc_errors():
    assert find_revert_data({'data': {'originalError': {'data': EXPECTED}}}) == EXPECTED

def test_retained_receipt_must_be_the_original_event_not_a_noop_replay():
    address = '0x' + '11' * 20
    submitter = '0x' + '22' * 20
    stored = {'submitter': submitter, 'seriesHash': PRIOR}
    receipt = {'status': '0x1', 'to': address, 'from': submitter,
               'logs': [{'address': address, 'topics': [EVENT_TOPIC, NEXT, PRIOR]}]}
    validate_receipt(receipt, address, NEXT, stored)
    receipt['logs'] = []
    with pytest.raises(RuntimeError, match='original matching'):
        validate_receipt(receipt, address, NEXT, stored)
