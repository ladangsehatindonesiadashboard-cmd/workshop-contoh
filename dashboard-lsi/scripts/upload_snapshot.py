#!/usr/bin/env python3
"""Unggah (upsert) snapshot data dashboard ke Supabase.

Pemakaian:
  export SUPABASE_URL=https://ecjhttvuvexdxklnalkz.supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=...   # service_role (JWT) atau secret key sb_secret_...
  python3 scripts/upload_snapshot.py data_nov.json --period 2026-11 --label "November 2026"

Hanya memakai library standar Python. Kunci rahasia dibaca dari environment,
tidak pernah ditulis ke repo. Baris dengan period yang sama akan ditimpa.
"""
import argparse, datetime, json, os, re, sys, urllib.error, urllib.request

BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
         'September', 'Oktober', 'November', 'Desember']
TABLE = 'dashboard_snapshots'


def main():
    ap = argparse.ArgumentParser(description='Upsert snapshot JSON dashboard ke Supabase')
    ap.add_argument('json_file', help='file JSON data dashboard (keluaran build_*_data.py)')
    ap.add_argument('--period', required=True, help='format YYYY-MM, mis. 2026-11')
    ap.add_argument('--label', help='label tampilan, default "<Bulan> <Tahun>"')
    ap.add_argument('--dry-run', action='store_true', help='cek file saja, tanpa mengunggah')
    a = ap.parse_args()

    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', a.period):
        sys.exit('period harus berformat YYYY-MM')
    y, m = a.period.split('-')
    label = a.label or f'{BULAN[int(m) - 1]} {y}'

    with open(a.json_file, encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, dict) or not data:
        sys.exit('JSON harus berupa objek yang tidak kosong')
    print(f'File OK: {len(data)} kunci tingkat atas · period={a.period} · label={label!r}')
    if a.dry_run:
        return

    url = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
    if not url or not key:
        sys.exit('Set environment SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terlebih dahulu')

    body = json.dumps([{
        'period': a.period, 'label': label, 'data': data,
        'updated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }], ensure_ascii=False).encode('utf-8')
    headers = {
        'apikey': key,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
    }
    if key.startswith('eyJ'):  # kunci legacy berbentuk JWT; kunci sb_secret_ cukup lewat header apikey
        headers['Authorization'] = f'Bearer {key}'
    req = urllib.request.Request(f'{url}/rest/v1/{TABLE}?on_conflict=period&select=id,period,label,updated_at',
                                 data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f'HTTP {r.status}:', r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        sys.exit(f'Gagal (HTTP {e.code}): {e.read().decode("utf-8", "replace")[:500]}')


if __name__ == '__main__':
    main()
