import asyncio,json
import httpx,pytest
from app.operations import SharedQuota,operations,QUOTA_SCRIPT,client_identity

def test_shared_quota_hashes_client_and_uses_one_atomic_command():
    commands=[]
    def handler(request):
        commands.append(json.loads(request.content));assert request.headers['Authorization']=='Bearer test-token'
        return httpx.Response(200,json={'result':[1,61]})
    quota=SharedQuota('https://quota.example','test-token','s'*32,30,60,3000)
    allowed,retry=asyncio.run(quota.allow('192.0.2.44',httpx.MockTransport(handler)))
    assert allowed and retry==61
    assert '192.0.2.44' not in json.dumps(commands)
    assert commands[0][0]=='EVAL' and 'TIME' in commands[0][1]
    assert commands[0][-3:]==[60,30,3000]

def test_shared_quota_denials_and_bad_responses_do_not_allow_requests():
    quota=SharedQuota('https://quota.example','test-token','s'*32,30,60,3000)
    denied=httpx.MockTransport(lambda request:httpx.Response(200,json={'result':[0,30]}))
    assert asyncio.run(quota.allow('client',denied))==(False,30)
    for result in [None,[],[1,0],[1,9999],['yes',30]]:
        bad=httpx.MockTransport(lambda request:httpx.Response(200,json={'result':result}))
        with pytest.raises(RuntimeError):asyncio.run(quota.allow('client',bad))

def test_shared_quota_configuration_and_metrics_are_bounded_and_private():
    with pytest.raises(RuntimeError):SharedQuota('http://quota.example','token','s'*32,30,60,3000)
    with pytest.raises(RuntimeError):SharedQuota('https://quota.example?token=secret','token','s'*32,30,60,3000)
    snapshot=operations.snapshot()
    assert snapshot['scope']=='this-process since last start'
    assert 'client' not in snapshot and 'csv' not in snapshot

def test_global_admission_precedes_client_key_allocation():
    assert QUOTA_SCRIPT.index('count>tonumber(ARGV[3])')<QUOTA_SCRIPT.index("local client=KEYS[2]")

def test_forwarding_headers_are_only_trusted_on_vercel(monkeypatch):
    scope={'client':('192.0.2.1',1),'headers':[(b'x-vercel-forwarded-for',b'192.0.2.2')]}
    monkeypatch.delenv('VERCEL',raising=False);assert client_identity(scope)=='192.0.2.1'
    monkeypatch.setenv('VERCEL','1');assert client_identity(scope)=='192.0.2.2'

def test_status_reports_actual_quota_scope_without_private_inputs():
    from fastapi.testclient import TestClient
    from app.main import app
    response=TestClient(app).get('/status');assert response.status_code==200
    assert response.json()['quotas']['sharedConfigured'] is False
    assert response.json()['metrics']['scope']=='this-process since last start'

def test_quota_outage_and_exhausted_capacity_reject_before_reading_body(monkeypatch):
    import app.main as main
    async def run(kind):
        messages=[]
        async def forbidden_receive():raise AssertionError('Rejected request body must not be read')
        async def send(message):messages.append(message)
        async def downstream(*args):raise AssertionError('Rejected request must not reach parser')
        class Quota:
            async def allow(self,client):
                if kind=='capacity':raise AssertionError('Exhausted capacity must not call quota backend')
                raise RuntimeError('dependency unavailable')
        monkeypatch.setattr(main,'shared_quota',Quota())
        monkeypatch.setattr(main,'inspection_slots',asyncio.Semaphore(0 if kind=='capacity' else 4))
        scope={'type':'http','method':'POST','path':'/inspect','client':('192.0.2.155',1),'headers':[]}
        await main.InspectionBodyLimit(downstream)(scope,forbidden_receive,send)
        assert messages[0]['status']==503
        assert (b'QUOTA_BACKEND_UNAVAILABLE' if kind=='quota' else b'INSPECTION_CAPACITY_REACHED') in messages[1]['body']
    asyncio.run(run('quota'));asyncio.run(run('capacity'))

def test_readiness_does_not_turn_dependency_failure_into_health(monkeypatch):
    import app.main as main
    from fastapi.testclient import TestClient
    class Quota:
        async def ping(self):raise RuntimeError('offline')
    monkeypatch.setattr(main,'shared_quota',Quota());monkeypatch.setattr(main,'readiness_checked',0)
    response=TestClient(main.app).get('/ready');assert response.status_code==503
    assert response.json()['quotaDependency']=='unavailable'
