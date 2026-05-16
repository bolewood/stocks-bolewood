import urllib.request
import re
from bs4 import BeautifulSoup

url = "https://www.sec.gov/Archives/edgar/data/2081119/000121390026053808/ea0288089-01_ncsrs.htm"
headers = {"User-Agent": "Bolewood Group santhonys@bolewood.com"}
req = urllib.request.Request(url, headers=headers)

try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8', errors='ignore')
        soup = BeautifulSoup(html, 'html.parser')
        
        # We look for tables that have "Schedule of Investments"
        tables = soup.find_all('table')
        for idx, table in enumerate(tables):
            text = table.get_text(separator=' ', strip=True)
            if 'Figure' in text or 'Apptronik' in text:
                print(f"Table {idx}")
                rows = table.find_all('tr')
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    row_text = [c.get_text(strip=True) for c in cells]
                    if len(row_text) > 0:
                        print(" | ".join(row_text))
                print("="*50)
                
except Exception as e:
    print(e)
