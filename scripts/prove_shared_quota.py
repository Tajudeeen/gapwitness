"""Exercise shared atomic quotas with two independent instances and synthetic clients."""
import argparse,asyncio,json,secrets,sys,urllib.request
import httpx
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'checker'))
from app.operations import SharedQuota

class WorkspaceProxyTransport(httpx.AsyncBaseTransport):
    """Use the workspace's urllib proxy path; production retains its three-second HTTPX timeout."""
    async def handle_async_request(self,request):
        def post():
            req=urllib.request.Request(str(request.url),data=request.content,headers=dict(request.headers)|{'User-Agent':'codex'})
            with urllib.request.urlopen(req,timeout=30) as response:return httpx.Response(response.status,content=response.read(),request=request)
        return await asyncio.to_thread(post)

async def prove(credentials):
    salt=secrets.token_hex(32);client='synthetic-integration-'+secrets.token_hex(8)
    instances=[SharedQuota(credentials['url'],credentials['token'],salt,3,3600,10000) for _ in range(2)]
    results=await asyncio.gather(*(instances[index%2].allow(client,WorkspaceProxyTransport()) for index in range(12)))
    admitted=sum(allowed for allowed,retry in results)
    if admitted!=3:raise RuntimeError('Shared quota did not enforce the same client across instances')
    return {'format':'gapwitness/shared-quota-proof/v1','checkedAt':datetime.now(timezone.utc).isoformat(),
        'independentLimiterInstances':2,'concurrentRequests':12,'clientLimit':3,'admitted':admitted,'denied':12-admitted,
        'matched':True,'clock':'Redis TIME','transport':'Actual HTTPS Redis requests through workspace urllib proxy, 30-second test timeout. Production HTTPX timeout remains three seconds.',
        'clientIdentifiers':'HMAC-hashed synthetic identifiers; no real IPs',
        'storeScope':'Temporary Upstash agent test database. Not production configuration; expires in 72 hours.',
        'limits':['This validates distributed admission logic, not production capacity or uptime.','Production needs an owned persistent Redis REST store and protected environment variables.']}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--credentials',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    report=asyncio.run(prove(json.loads(args.credentials.read_text())));args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
