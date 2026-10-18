"""Bounded service metrics and optional atomic shared quotas. Never logs CSV contents or client IPs."""
import hashlib,hmac,ipaddress,json,logging,os,time
from collections import Counter
from urllib.parse import urlparse
import httpx

log=logging.getLogger('uvicorn.error')
MAX_ACTIVE=int(os.getenv('INSPECT_MAX_CONCURRENT','4'))
if not 1<=MAX_ACTIVE<=32:raise RuntimeError('INSPECT_MAX_CONCURRENT must be 1–32')
class Operations:
    def __init__(self):self.started=time.monotonic();self.statuses=Counter();self.completed=0;self.total_ms=0.;self.max_ms=0.;self.active=0
    def finish(self,status,duration_ms):
        self.completed+=1;self.statuses[str(status)]+=1;self.total_ms+=duration_ms;self.max_ms=max(self.max_ms,duration_ms)
        log.info(json.dumps({'event':'inspection_request','status':status,'durationMs':round(duration_ms,2),'scope':'this-process'}))
    def snapshot(self):return {'scope':'this-process since last start','uptimeSeconds':round(time.monotonic()-self.started),
        'completedRequests':self.completed,'statusCounts':dict(self.statuses),'meanRequestMilliseconds':round(self.total_ms/self.completed,2) if self.completed else None,
        'maxRequestMilliseconds':round(self.max_ms,2),'activeInspections':self.active,'maxConcurrentInspections':MAX_ACTIVE}
operations=Operations()

def client_identity(scope):
    # Vercel overwrites its client IP headers. Trust them only inside that platform.
    if os.getenv('VERCEL')=='1':
        headers=dict(scope.get('headers',[]));value=headers.get(b'x-vercel-forwarded-for',headers.get(b'x-forwarded-for',b'')).decode('ascii',errors='ignore').strip()
        try:return str(ipaddress.ip_address(value))
        except ValueError:pass
    client=scope.get('client');return str(client[0]) if client else 'unknown'

# Redis TIME establishes the clock. Global admission is checked before allocating any per-client key.
QUOTA_SCRIPT="""
local t=redis.call('TIME');local now=tonumber(t[1]);local window=tonumber(ARGV[1]);local ttl=window-(now%window)+1
local bucket=math.floor(now/window);local global=KEYS[1]..':'..bucket;local count=redis.call('INCR',global)
if count==1 then redis.call('EXPIRE',global,ttl) end
if count>tonumber(ARGV[3]) then return {0,ttl} end
local client=KEYS[2]..':'..bucket;local hits=redis.call('INCR',client)
if hits==1 then redis.call('EXPIRE',client,ttl) end
if hits>tonumber(ARGV[2]) then return {0,ttl} end
return {1,ttl}
"""
class SharedQuota:
    def __init__(self,url,token,salt,limit,window,global_limit):
        parsed=urlparse(url)
        if parsed.scheme!='https' or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise RuntimeError('QUOTA_REDIS_REST_URL must be a credential-free HTTPS URL')
        if not token or len(salt)<32:raise RuntimeError('Shared quota requires a token and a salt of at least 32 characters')
        if not 1<=limit<=100000 or not 1<=global_limit<=100000 or not 1<=window<=3600:raise RuntimeError('Invalid shared quota bounds')
        self.url=url.rstrip('/');self.token=token;self.salt=salt;self.limit=limit;self.window=window;self.global_limit=global_limit
    async def allow(self,client,transport=None):
        key=hmac.new(self.salt.encode(),client.encode(),hashlib.sha256).hexdigest()
        command=['EVAL',QUOTA_SCRIPT,2,'gapwitness:{quota}:global','gapwitness:{quota}:client:'+key,self.window,self.limit,self.global_limit]
        async with httpx.AsyncClient(timeout=3.0,transport=transport) as session:
            response=await session.post(self.url,json=command,headers={'Authorization':'Bearer '+self.token})
            response.raise_for_status();body=response.json();result=body.get('result')
        if not isinstance(result,list) or len(result)!=2 or type(result[0]) is not int or result[0] not in [0,1] or type(result[1]) is not int or not 1<=result[1]<=self.window+1:
            raise RuntimeError('Invalid shared quota response')
        return bool(result[0]),result[1]

    async def ping(self,transport=None):
        async with httpx.AsyncClient(timeout=3.0,transport=transport) as session:
            response=await session.post(self.url,json=['PING'],headers={'Authorization':'Bearer '+self.token})
            response.raise_for_status()
            if response.json().get('result')!='PONG':raise RuntimeError('Quota dependency did not answer PING')

def configured_quota(limit,window):
    names=['QUOTA_REDIS_REST_URL','QUOTA_REDIS_REST_TOKEN','QUOTA_HASH_SALT'];values=[os.getenv(name,'') for name in names]
    required=os.getenv('REQUIRE_SHARED_QUOTA','false').strip().lower()
    if required not in {'true','false','1','0'}:raise RuntimeError('REQUIRE_SHARED_QUOTA must be true or false')
    if required in {'true','1'} and not all(values):raise RuntimeError('Shared quota is required for this deployment; configure all protected quota variables')
    if any(values) and not all(values):raise RuntimeError('Shared quota configuration is incomplete')
    return SharedQuota(*values,limit,window,int(os.getenv('INSPECT_GLOBAL_RATE_LIMIT','3000'))) if all(values) else None
