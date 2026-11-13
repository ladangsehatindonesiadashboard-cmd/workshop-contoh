#!/usr/bin/env python3
"""Hourly Accurate -> Supabase sales sync, run on the box (READ-ONLY to Accurate).
Accurate secrets stay on the box (.oauth.json chmod 600 + env ACCURATE_CLIENT_SECRET). Sends only computed sales keys
to the Supabase Edge Function sync-accurate (mode=ingest, header x-sync-key from .sync_key)."""
import os,sys,json,time,base64,datetime as dt,urllib.request,urllib.parse,re,concurrent.futures as cf
D=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,D)
from transform import build
CACHE=os.path.join(D,'raw','cache'); os.makedirs(CACHE,exist_ok=True)
FN='https://ecjhttvuvexdxklnalkz.supabase.co/functions/v1/sync-accurate'
DB_ID='2685839'; OK=re.compile(r'^/accurate/api/[a-z-]+/(list|detail)\.do$')
def log(*a): print(dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S WIB'),*a,flush=True)
def store(): return json.load(open(os.path.join(D,'.oauth.json')))
def save(st):
    p=os.path.join(D,'.oauth.json'); fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as f: json.dump(st,f)
def refresh_if_needed(force=False):
    st=store(); exp=st['obtained_at']+int(st['expires_in'])
    if not force and exp-time.time()>2*86400: return st
    cid=json.load(open(os.path.join(D,'.client.json')))['client_id']; cs=os.environ['ACCURATE_CLIENT_SECRET'].strip()
    r=urllib.request.Request('https://account.accurate.id/oauth/token',method='POST',data=urllib.parse.urlencode({'grant_type':'refresh_token','refresh_token':st['refresh_token']}).encode(),
        headers={'Authorization':'Basic '+base64.b64encode(f'{cid}:{cs}'.encode()).decode(),'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(r,timeout=30) as x: j=json.loads(x.read())
    st.update({k:j[k] for k in ('access_token','expires_in','scope') if k in j}); st['refresh_token']=j.get('refresh_token') or st['refresh_token']; st['obtained_at']=int(time.time()); save(st)
    log('token refreshed'); return st
def open_db(st):
    r=urllib.request.Request(f'https://account.accurate.id/api/open-db.do?id={DB_ID}',headers={'Authorization':'Bearer '+st['access_token']})
    with urllib.request.urlopen(r,timeout=30) as x: j=json.loads(x.read())
    if not j.get('s'): raise RuntimeError('open-db gagal')
    return {'host':j['host'],'session':j['session'],'token':st['access_token']}
def get(db,path,params):
    assert OK.match(path),path
    u=db['host']+path+'?'+urllib.parse.urlencode(params,doseq=True)
    for a in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(u,headers={'Authorization':'Bearer '+db['token'],'X-Session-ID':db['session']}),timeout=60) as x: return json.loads(x.read())
        except urllib.error.HTTPError as e:
            if e.code in(429,502,503,504): time.sleep(2+3*a); continue
            raise RuntimeError(f'{path} HTTP {e.code}')
    raise RuntimeError('retry habis')
def month(p):
    y,m=map(int,p.split('-')); last=(dt.date(y+m//12,m%12+1,1)-dt.timedelta(days=1)).day
    return f'01/{m:02d}/{y}',f'{last}/{m:02d}/{y}'
def sync_kind(db,kind,p):
    frm,to=month(p); L=[];pg=1
    while True:
        j=get(db,f'/accurate/api/{kind}/list.do',{'fields':'id,number,transDate,lastUpdate','sp.page':pg,'sp.pageSize':100,'filter.transDate.op':'BETWEEN','filter.transDate.val':[frm,to]})
        L+=j['d']
        if pg>=j['sp']['pageCount']: break
        pg+=1
    cf_path=os.path.join(CACHE,f'{kind}_{p}.json'); cache=json.load(open(cf_path)) if os.path.exists(cf_path) else {}
    todo=[x for x in L if (cache.get(str(x['id'])) or {}).get('_lu')!=x['lastUpdate']]
    with cf.ThreadPoolExecutor(4) as ex:
        for x,d in zip(todo,ex.map(lambda x:get(db,f'/accurate/api/{kind}/detail.do',{'id':x['id']})['d'],todo)):
            d['_lu']=x['lastUpdate']; cache[str(x['id'])]=d
    keep={str(x['id']) for x in L}; cache={k:v for k,v in cache.items() if k in keep}
    json.dump(cache,open(cf_path,'w')); return list(cache.values()),len(L),len(todo)
def items_map(db,docs):
    p=os.path.join(D,'raw','items.json'); items=json.load(open(p)) if os.path.exists(p) else {}
    need={str(l['item']['id']) for d in docs for l in d['detailItem']}-set(items)
    if need:
        items={};pg=1
        while True:
            j=get(db,'/accurate/api/item/list.do',{'fields':'id,no,name,itemType,itemCategory','sp.pageSize':100,'sp.page':pg})
            for x in j['d']: items[str(x['id'])]={'no':x['no'],'name':x['name'],'type':x.get('itemType'),'cat':(x.get('itemCategory') or {}).get('name','')}
            if pg>=j['sp']['pageCount']: break
            pg+=1
        json.dump(items,open(p,'w'))
    return items
def ingest(period,keys):
    body=json.dumps({'mode':'ingest','period':period,'keys':keys},separators=(',',':')).encode()
    r=urllib.request.Request(FN,data=body,method='POST',headers={'Content-Type':'application/json','x-sync-key':open(os.path.join(D,'.sync_key')).read().strip()})
    try:
        with urllib.request.urlopen(r,timeout=120) as x: return json.loads(x.read())
    except urllib.error.HTTPError as e: return {'ok':False,'http':e.code,'body':e.read().decode()[:300]}
def run_once():
    st=refresh_if_needed(); 
    try: db=open_db(st)
    except urllib.error.HTTPError as e:
        if e.code!=401: raise
        db=open_db(refresh_if_needed(True))
    now=dt.datetime.now(); periods=sorted({'2026-10',f'{now.year}-{now.month:02d}'})
    base=json.load(open('/workspace/dashboard/data_okt.json'))['customers']; out={}
    for p in periods:
        inv,ni,fi=sync_kind(db,'sales-invoice',p); ret,nr,fr=sync_kind(db,'sales-return',p)
        items=items_map(db,inv+ret)
        k=build(inv,ret,items,base)
        if p=='2026-10': base=k['customers']
        k['sales_src']={'source':'accurate-api','db':'PT LADANG SEHAT INDONESIA','period':p,'synced_at':dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),'via':'box_sync',
                        'inv':len(k['inv']),'inv_lines':len(k['itl']),'ret':len(k['ret']),'ret_lines':len(k['retd']),'omzet':sum(r[3] for r in k['inv']),
                        'gross':round(sum(r[3] for r in k['dinv']),2),'disc':round(sum(r[4]+r[5] for r in k['dinv']),2)}
        res=ingest(p,k); out[p]={'listed_inv':ni,'fetched_inv':fi,'listed_ret':nr,'fetched_ret':fr,'omzet':k['sales_src']['omzet'],'ingest':res}
        log(p,json.dumps(out[p],ensure_ascii=False))
    return out
if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='loop':
        while True:
            try: run_once()
            except Exception as e: log('ERROR',type(e).__name__,str(e)[:300])
            nxt=(time.time()//3600+1)*3600+300   # menit ke-5 jam berikutnya (jam dinding)
            while time.time()<nxt: time.sleep(30)  # tahan suspend: cek jam dinding tiap 30 dtk
    else: run_once()
