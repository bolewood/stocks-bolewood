import requests
import json

headers = {"User-Agent": "Bolewood Group santhonys@bolewood.com"}
data = requests.get("https://data.sec.gov/submissions/CIK0002081119.json", headers=headers).json()

filings = data['filings']['recent']
for i in range(len(filings['accessionNumber'])):
    if filings['accessionNumber'][i] == '0001213900-26-053808':
        print(filings['primaryDocument'][i])
