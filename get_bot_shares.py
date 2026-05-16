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
        text = soup.get_text(separator=' ', strip=True)
        # Look for shares outstanding
        matches = re.findall(r'.{0,50}shares outstanding.{0,50}', text, re.IGNORECASE)
        for m in matches[:5]:
            print(m)
            
        print("--- Net Assets ---")
        matches_na = re.findall(r'.{0,50}Net Assets.{0,50}', text, re.IGNORECASE)
        for m in matches_na[:5]:
            print(m)
except Exception as e:
    print(e)
