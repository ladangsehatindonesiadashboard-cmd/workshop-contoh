#!/usr/bin/env python3
"""Accurate OAuth helper (READ-ONLY usage).
  python3 oauth.py url [redirect_uri]          -> print authorize URL (only client_id inside)
  ACC_CODE=... python3 oauth.py exchange [redirect_uri]  -> swap code for tokens, save to .oauth.json (chmod 600)
  python3 oauth.py refresh                     -> refresh access token
  python3 oauth.py dbs                         -> list databases (alias/id only) + open-db host (session saved, not printed)
Secrets: ACCURATE_API_TOKEN (= Client ID), ACCURATE_CLIENT_SECRET from env. Never printed."""
import os,sys,json,base64,time,urllib.request,urllib.parse
_CF=os.path.join(os.path.dirname(os.path.abspath(__file__)),'.client.json')
CID=json.load(open(_CF))['client_id'] if os.path.exists(_CF) else os.environ['ACCURATE_API_TOKEN'].strip(); CS=os.environ.get('ACCURATE_CLIENT_SECRET','').strip()
STORE=os.path.join(os.path.dirname(os.path.abspath(__file__)),'.oauth.json')
REDIRECT=os.environ.get('ACC_REDIRECT_URI','http://localhost/aol-oauth-callback')
SCOPES='sales_invoice_view sales_return_view item_view customer_view'
def save(d):
    fd=os.open(STORE,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as f: json.dump(d,f)
    os.chmod(STORE,0o600)
def load(): return json.load(open(STORE))
def token(data):
    b=base64.b64encode(f'{CID}:{CS}'.encode()).decode()
    r=urllib.request.Request('https://account.accurate.id/oauth/token',data=urllib.parse.urlencode(data).encode(),method='POST',
        headers={'Authorization':'Basic '+b,'Content-Type':'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(r,timeout=30) as x: j=json.loads(x.read())
    except urllib.error.HTTPError as e: sys.exit(f'token endpoint HTTP {e.code} (detail disembunyikan)')
    j['obtained_at']=int(time.time()); old=load() if os.path.exists(STORE) else {}
    j.setdefault('refresh_token',old.get('refresh_token')); save({**old,**j})
    print('OK: token disimpan ke',STORE,'| scope:',j.get('scope'),'| expires_in(s):',j.get('expires_in'),'| user:',(j.get('user') or {}).get('email'))
def api(path,params=None):
    assert path in('/api/db-list.do','/api/open-db.do')
    t=load()['access_token']; u='https://account.accurate.id'+path+('?'+urllib.parse.urlencode(params) if params else '')
    with urllib.request.urlopen(urllib.request.Request(u,headers={'Authorization':'Bearer '+t}),timeout=30) as x: return json.loads(x.read())
cmd=sys.argv[1] if len(sys.argv)>1 else 'url'
ru=sys.argv[2] if len(sys.argv)>2 else REDIRECT
if cmd=='url':
    print('https://account.accurate.id/oauth/authorize?'+urllib.parse.urlencode({'client_id':CID,'response_type':'code','redirect_uri':ru,'scope':os.environ.get('ACC_SCOPES',SCOPES)},quote_via=urllib.parse.quote))
elif cmd=='exchange':
    code=os.environ.get('ACC_CODE') or input('code: ').strip()
    token({'grant_type':'authorization_code','code':code,'redirect_uri':ru})
elif cmd=='refresh':
    token({'grant_type':'refresh_token','refresh_token':load()['refresh_token']})
elif cmd=='dbs':
    d=api('/api/db-list.do'); dbs=[(x.get('id'),x.get('alias')) for x in d.get('d',[])]; print('databases:',dbs)
    st=load(); st['dbs']={}
    for i,a in dbs:
        o=api('/api/open-db.do',{'id':i}); st['dbs'][str(i)]={'alias':a,'host':o.get('host'),'session':o.get('session'),'opened_at':int(time.time())}
        print(' open-db',a,'-> host',o.get('host'),'| s=',o.get('s'),'| admin=',o.get('admin'))
    save(st)
