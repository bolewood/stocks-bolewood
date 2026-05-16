import requests

headers = {
    "User-Agent": "Bolewood Group santhonys@bolewood.com"
}
response = requests.get("https://www.sec.gov/files/company_tickers.json", headers=headers)
data = response.json()

for key, value in data.items():
    if value['ticker'] == 'BOT' or 'robostrategy' in value['title'].lower():
        print(f"Found: {value['title']} (Ticker: {value['ticker']}) - CIK: {str(value['cik_str']).zfill(10)}")
