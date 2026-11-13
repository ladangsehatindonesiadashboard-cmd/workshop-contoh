import os,time,hmac,hashlib,base64,json,urllib.request,urllib.parse
TOK=os.environ['ACCURATE_API_TOKEN']; SEC=os.environ['ACCURATE_SIGNATURE_SECRET'].encode()
def hdr():
    ts=time.strftime('%d/%m/%Y %H:%M:%S')
    sig=base64.b64encode(hmac.new(SEC,ts.encode(),hashlib.sha256).digest()).decode()
    return {'Authorization':'Bearer '+TOK,'X-Api-Timestamp':ts,'X-Api-Signature':sig}
def get(url,params=None,method='GET'):
    # READ-ONLY guard
    assert not any(x in url for x in ['save','delete','bulk','update','create']), url
    if params: url+='?'+urllib.parse.urlencode(params,doseq=True)
    req=urllib.request.Request(url,headers=hdr(),method=method)
    try:
        with urllib.request.urlopen(req,timeout=60) as r: return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {'_http':e.code,'_body':e.read().decode()[:500]}
