import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from verify_real_corpus import verify

def test_retained_multi_provider_sources_reproduce_all_results():
    results=verify()
    assert len(results)==13
    assert sum(item['missing']>0 for item in results)==3
    assert all(item['matched'] for item in results)
