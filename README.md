# CFB Rankings

I'm testing a gpt coded college football college rankings system. This pulls data from collegefootballdata.com and puts into a UI to be able to tweak and create a computer ranking. The user can drill into the scoring for that team, compare two teams against each other and view conference rankings.


## Run
```bash
cp .env  # add CFBD_API_KEY
npm install
npm run dev
# open http://localhost:5057

## .env format
CFBD_API_KEY=API KEY
PORT=5057
SEASON_YEAR=2025

Credit to https://collegefootballdata.com/ for their great API access to college football data.
