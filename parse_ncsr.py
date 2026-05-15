import urllib.request
import json
url = 'https://data.sec.gov/submissions/CIK0001843974.json'
req = urllib.request.Request(url, headers={'User-Agent': 'test test@test.com'})
try:
    data = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    filings = data['filings']['recent']
    for i in range(min(50, len(filings['accessionNumber']))):
        if 'PORT' in filings['form'][i]:
            print(f"{filings['filingDate'][i]} - {filings['form'][i]} - {filings['accessionNumber'][i]} - {filings['primaryDocument'][i]}")
except Exception as e:
    print(e)
