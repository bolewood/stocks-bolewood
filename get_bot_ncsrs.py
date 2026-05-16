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
        # Look for schedule of investments or company names
        companies = ["Figure", "Apptronik", "Dyna Robotics", "Standard Bots", "Dexmate"]
        for c in companies:
            idx = text.find(c)
            if idx != -1:
                print(f"Found {c}:")
                print(text[max(0, idx-50):idx+200])
                print("-" * 40)
except Exception as e:
    print(e)
