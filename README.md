# Auditor Facturas - Front

Run front (port 8080)
```bash
npm i
npm run dev
```

Run GCP communication back (port 3000) 
```bash
cd backend
npm i
node index.js
```

## VM Running
```bash
sudo apt update
sudo apt intall git -y
sudo apt install nodejs npm -y
sudo apt install tmux -y
git clone https://github.com/t-montes/-doc-ai-front front
tmux
cd front
```

A new terminal will open, change the port to 80 and run the front:
```bash
npm install
nano src/App.tsx # change the HOST to the IP
sudo npm run dev -- --host --port 80
```
> To detach the tmux session, press `Ctrl+B` and then `D`. To reattach the session, run `tmux a -t ID`, for listing the sessions run `tmux ls`.

Detach the tmux session, create a new one and run the back:
```bash
tmux
cd backend
mv template.env .env
nano .env # replace the values with the correct ones
nano keyfile.json # paste the content of the keyfile
npm install
node index.js
```
