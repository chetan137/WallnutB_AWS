# Deploying to AWS EC2 (CI/CD)

This repo (`WallnutB_AWS`) IS the backend — `server.js` and friends live at the
repo root. Every push to `main` runs
[`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml):

```
push to main
  → GitHub Actions: npm ci + node --check every file  (fails fast on broken code)
  → SSH into the EC2 box
  → git fetch + git reset --hard origin/main
  → npm ci --omit=dev
  → pm2 startOrReload pm2.config.js   (zero-downtime-ish restart)
```

`.env` on the server is **never touched** by this pipeline — it's gitignored, so
`git reset --hard` can't overwrite it. It only needs to be uploaded once (see below).

---

## 1. One-time EC2 setup (run once over SSH, before the first automated deploy)

```bash
ssh -i wallnut.pem ubuntu@<EC2_PUBLIC_IP>

# Node.js 20.x (Ubuntu's apt version is usually too old for engines: >=18 in package.json)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2

# Clone the repo
git clone https://github.com/chetan137/WallnutB_AWS.git /home/ubuntu/WallnutB_AWS
cd /home/ubuntu/WallnutB_AWS
npm ci --omit=dev
```

Then, from your **local machine** (not the server), upload the real `.env`
(this file contains the Postgres password — it's why it can't go through git):

```bash
scp -i wallnut.pem .env.production ubuntu@<EC2_PUBLIC_IP>:/home/ubuntu/WallnutB_AWS/.env
```

Fill in `PG_HOST` / `PG_PASSWORD` etc. in that file with the real Antraweb VM
credentials once you have them (edit directly on the server, or re-upload).

Start it under PM2 and make it survive reboots:

```bash
cd /home/ubuntu/WallnutB_AWS
pm2 start pm2.config.js
pm2 save
pm2 startup            # run the sudo command it prints, once
```

Confirm it's up: `curl http://localhost:5000/api/health`

---

## 2. AWS Security Group

- **Port 5000** (the API) — inbound from wherever the frontend/public needs to reach it.
- **Port 22** (SSH) — GitHub-hosted runners don't have static IPs, so this needs
  to accept `0.0.0.0/0`. Security relies entirely on the private key, so:
  - never commit `wallnut.pem` anywhere
  - password authentication should stay disabled on the box (AWS default)

---

## 3. GitHub repo secrets

**Settings → Secrets and variables → Actions → New repository secret** on
`github.com/chetan137/WallnutB_AWS`:

| Secret        | Value                                                              |
|---------------|---------------------------------------------------------------------|
| `EC2_HOST`    | EC2 public IP, e.g. `65.1.213.79`                                   |
| `EC2_USER`    | `ubuntu`                                                             |
| `EC2_SSH_KEY` | Full contents of `wallnut.pem`, including the `-----BEGIN...-----` / `-----END...-----` lines |
| `EC2_PORT`    | Only add this if SSH isn't on the default port 22                   |

Once these are set, just push to `main` — no manual deploy step needed after that.

---

## 4. Manual redeploy / rollback

Force a redeploy without a new commit: **Actions tab → Deploy Backend → Run workflow**.

To roll back, `git checkout <previous-good-commit>` on the server and
`pm2 restart wallnut-api` manually — the pipeline always deploys whatever is
currently on `main`, so a bad `main` needs a `git revert` pushed to fix forward.

---

## Note on this repo's origin

This backend also lives inside the main `Wallnut-` monorepo (under `backend/`),
where it's kept in sync via `git subtree push --prefix=backend
https://github.com/chetan137/WallnutB_AWS.git main`. Keep making backend
changes in the monorepo and re-run that command to push updates here — don't
edit the two independently, or they'll drift apart.
