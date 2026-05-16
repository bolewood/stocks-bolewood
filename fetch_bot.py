import requests
import json

headers = {
    "User-Agent": "Bolewood Group santhonys@bolewood.com"
}
response = requests.get("https://data.sec.gov/submissions/CIK0002081119.json", headers=headers)
data = response.json()

filings = data['filings']['recent']
for i in range(min(15, len(filings['accessionNumber']))):
    print(f"{filings['filingDate'][i]} | {filings['form'][i]} | {filings['accessionNumber'][i]}")
