# MagicCut Proxy (Store-safe)

Deploy (Render.com):
1. New → Web Service → connect this repo.
2. Environment Variables:
   - `TARGET_URL` = aapka upstream BG-removal API endpoint
   - `API_ID` = 24628
   - `API_SECRET` = 7rplnkcrpqctforuqink39tp5i8ib588m7h0kgge6a0rdpk6p7dl
3. Build command: `npm i`
4. Start command: `node index.js`
5. Deployed HTTPS URL copy karein (e.g., `https://magiccut-proxy.onrender.com`)
6. WPF app me `ProxyHelper.cs` ke `RemoteApiBase` me yahi URL set karein.
