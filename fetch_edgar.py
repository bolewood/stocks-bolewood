import urllib.request
import json

headers = {'User-Agent': 'Antigravity contact@antigravity.com'}

url = 'https://data.sec.gov/submissions/CIK0001843974.json'
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        filings = data['filings']['recent']
        for i in range(min(20, len(filings['accessionNumber']))):
            form = filings['form'][i]
            acc_num = filings['accessionNumber'][i]
            primary_doc = filings['primaryDocument'][i]
            date = filings['filingDate'][i]
            print(f"{date} - {form} - {acc_num} - {primary_doc}")
except Exception as e:
    print(e)
