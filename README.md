# CFB Rankings

I'm testing a gpt coded college football college rankings system. This pulls data from collegefootballdata.com and puts into a UI to be able to tweak and create a computer ranking. The user can drill into the scoring for that team, compare two teams against each other and view conference rankings.


## Screenshots
<img width="1907" height="916" alt="screen1" src="https://github.com/user-attachments/assets/9b0c1dc4-9ec7-49bc-b177-42379ec5d883" />
<img width="1907" height="981" alt="screen2" src="https://github.com/user-attachments/assets/342f6b39-012d-4691-bc89-d828b19f1e18" />
<img width="1905" height="983" alt="screen3" src="https://github.com/user-attachments/assets/64cdd106-7f87-4bd9-a414-729f3c796fc4" />
<img width="1877" height="907" alt="screen4" src="https://github.com/user-attachments/assets/b0b6a46b-9830-4170-bd3e-f823df8ef64a" />
<img width="1894" height="600" alt="screen5" src="https://github.com/user-attachments/assets/82d98569-3924-4d6e-92b5-fc3dd69a11b5" />
<img width="1917" height="994" alt="screen6" src="https://github.com/user-attachments/assets/fee40495-a64f-49e9-97e5-2a8a726b3a1d" />


## Run
```bash
cp .env  # add CFBD_API_KEY
npm install
npm run dev
# open http://localhost:5057

## .env format (put in project root folder)
CFBD_API_KEY=API KEY
PORT=5057
SEASON_YEAR=2025

Credit to https://collegefootballdata.com/ for their great API access to college football data.
