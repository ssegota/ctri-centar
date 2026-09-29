# Deploy na VPS — CTRL

`netlify.toml` i dalje vrijedi za Netlify. Ovo je drugi put: isti kod na
vlastitom VPS-u (Srce, 31.147.207.119), uz EvolveUniTech.

Na Netlifyju API radi kao Netlify Function, a podaci su u Netlify Blobs. Na VPS-u:

- `server/index.mjs` je mali Node server koji zove isti handler
  (`netlify/functions/api.js`), bez izmjena u API-ju.
- Bez Blobsa `store.js` sam prelazi na JSON datoteke. `CTRL_LOCAL_STORE_DIR`
  ih drži u `/var/lib/ctrl`, izvan koda, pa ih deploy ne dira.
- nginx poslužuje `dist/` i prosljeđuje `/api/*` na `127.0.0.1:3001`.

| Što | Gdje na serveru |
| --- | --- |
| kod + `dist/` + `node_modules/` | `/opt/ctrl` |
| podaci (korisnici, prijave, rezervacije) | `/var/lib/ctrl` |
| servis | `ctrl.service` |
| nginx | `/etc/nginx/sites-available/ctrl.unipu.hr` |

---

## Jednom po serveru (zajedničko s MarendAppom)

**Node 22** — sistemski `node` na `/usr/bin/node`:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs && node -v
```

**Dozvola deploy korisniku da restarta servise**, i ništa više:

```bash
echo 'KORISNIK ALL=(root) NOPASSWD: /usr/bin/systemctl restart ctrl, /usr/bin/systemctl restart menzapp' | sudo tee /etc/sudoers.d/deploy-apps && sudo chmod 440 /etc/sudoers.d/deploy-apps && sudo visudo -c
```

`KORISNIK` je isti kao `DEPLOY_USER` u GitHub secretima.

---

## Prvi deploy

**1. DNS** — A zapis za domenu na 31.147.207.119. Provjera:

```bash
dig +short ctrl.unipu.hr
```

**2. Mapa — na serveru**

```bash
sudo mkdir -p /opt/ctrl && sudo chown "$USER": /opt/ctrl
```

**3. GitHub secreti** u ovom repou (Settings → Secrets → Actions), isti kao
kod EvolveUniTech: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`.

**4. Kod gore** — push na `main` ili ručno pokreni workflow *Deploy*. Prvi put
korak *Restart app* pada jer servis još ne postoji; to je očekivano.

**5. Servis — lokalno, pa na serveru**

```bash
scp deploy/ctrl.service deploy/nginx.conf KORISNIK@31.147.207.119:/tmp/
```

```bash
sudo cp /tmp/ctrl.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now ctrl && curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/auth/me
```

Mora vratiti `401` (API radi, nitko nije prijavljen).

**6. Certifikat — na serveru.** Nginx plugin sam privremeno otvori port 80
za ovu domenu, pa ne treba bootstrap konfiguracija:

```bash
sudo certbot certonly --nginx -d ctrl.unipu.hr
```

**7. nginx — na serveru**

```bash
sudo cp /tmp/nginx.conf /etc/nginx/sites-available/ctrl.unipu.hr && sudo ln -sf /etc/nginx/sites-available/ctrl.unipu.hr /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
```

**8. Odmah promijeni admin lozinku.** Prvi zahtjev stvara `admin` / `admin`.
Prijavi se i promijeni je (**Moj račun → Sigurnost**) prije nego što itko
drugi dobije adresu.

---

## Svaki sljedeći deploy

Push na `main`. Workflow pokreće API testove, builda, rsynca na
`/opt/ctrl` i restarta servis. Ako testovi padnu, ništa se ne deploya.

Promjena u `deploy/ctrl.service` ili `deploy/nginx.conf` ide ručno
preko `scp`, kao u koracima 5 i 7.

## Provjera i održavanje

```bash
curl -s https://ctrl.unipu.hr/api/auth/me
```

Mora vratiti JSON s `401`, ne HTML. HTML znači da `/api/` ne ide na Node.

Logovi:

```bash
sudo journalctl -u ctrl -n 100 --no-pager
```

Backup podataka — cijela baza je nekoliko JSON datoteka:

```bash
sudo tar czf ~/ctrl-$(date +%F).tgz -C /var/lib/private ctrl
```

(`DynamicUser` drži stvarnu mapu u `/var/lib/private/ctrl`, a
`/var/lib/ctrl` je poveznica na nju.)

Reset admin lozinke na `admin` / `admin` (umjesto `netlify blobs:delete`):

```bash
sudo systemctl stop ctrl && sudo rm /var/lib/private/ctrl/users.json && sudo systemctl start ctrl
```

Pazi: to briše **sve** korisnike, ne samo admina.
