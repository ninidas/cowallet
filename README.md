# CoWallet

<p align="center">
  <img src="docs/logo.png" alt="CoWallet" width="120" />
</p>

A mobile-first PWA for couples to manage their shared budget. Track monthly expenses, split costs automatically, plan ahead with recurring charges - and keep an eye on spending trends over time.

## Features

### Budget & Expenses
- **Monthly tracking** - create a month, add charges, mark transfers as done
- **Configurable split** - 50/50, 60/40, or any ratio you want
- **Recurring charges** - automatically copied to the next month
- **Installment payments** - split a purchase over N months, auto-carried forward
- **Actual vs planned** - enter real amounts alongside budgeted ones, see the delta
- **Month validation** - mark a month as closed once transfers are done
- **Bulk delete** - select and delete multiple months at once

### Categories & Organization
- **Charge suggestions** - autocomplete based on past entries
- **Custom categories** - create categories with icon and color
- **Custom payment methods** - add your own payment methods

### Bank Sync (optional)
- **Connect your bank** - link a joint account via Enable Banking (supports 2000+ banks across Europe)
- **Import transactions** - manually import transactions month by month, with debit filter and duplicate detection
- **Auto-categorization** - transactions are automatically categorized based on past imports
- **Budget vs actual** - compare planned charges against real spending, category by category

### History & Analytics
- **History & charts** - monthly evolution, breakdown by category, top recurring costs
- **Sankey diagram** - visualize income, shared expenses, personal spending and investments
- **CSV export** - keep a backup of all your data

### Collaboration
- **Multi-user** - invite your partner via a private invite link
- **Push notifications** - get notified when your partner validates a month (iOS & Android)
- **Group isolation** - each couple's data is fully isolated

### App & Security
- **PWA** - installable on iOS (Safari) and Android home screen
- **Sticky header** - validate button always accessible while scrolling on mobile
- **Rate-limited login** - brute-force protection on the auth endpoint
- **Password policy** - minimum 8 characters, at least 1 digit
- **First-run setup** - no config file needed, just open the app

## Screenshots

<p align="center">
  <img src="docs/cowallet-homepage.png" alt="Mes mois" width="80%" />
  <img src="docs/cowallet-monthly-page.png" alt="Détail d'un mois" width="80%" />
  <img src="docs/cowallet-history.png" alt="Historique" width="80%" />
</p>

## Quick Start

### 1. Create a `docker-compose.yml`

A `docker-compose.example.yml` is provided as a starting point. Copy it and adjust to your setup:

```bash
cp docker-compose.example.yml docker-compose.yml
```

Replace `<host_folder_data>` with the folder on your host where data will be stored (e.g. `/home/user/cowallet/data`).

```yaml
services:
  cowallet-frontend:
    image: ghcr.io/ninidas/cowallet-frontend:latest
    container_name: cowallet-frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - cowallet-backend

  cowallet-backend:
    image: ghcr.io/ninidas/cowallet-backend:latest
    container_name: cowallet-backend
    restart: unless-stopped
    environment:
      - PUID=1000
      - PGID=1000
      - APP_LANG=en  # Default language for seeded data: en or fr
    volumes:
      - <host_folder_data>:/data
```

Then start with `docker compose up -d`. The app is available at `http://localhost:3000`. Point your reverse proxy (Traefik, nginx, Caddy…) to port 3000 of the `cowallet-frontend` container.

### 2. First run

Open the app in your browser - you'll be guided through a setup wizard to create two user accounts and configure the default split ratio.

## Bank Sync

Bank sync is **optional**. The app works fully without it - it only adds the ability to import real transactions from your bank and compare them to your planned budget.

It uses [Enable Banking](https://enablebanking.com), an open banking aggregator supporting 2000+ banks across Europe (France, Belgium, Spain, Germany, Italy, Netherlands…). A free tier is available and is sufficient for personal use.

### 1. Generate an RSA key pair

```bash
openssl genpkey -algorithm RSA -out enablebanking.pem -pkeyopt rsa_keygen_bits:4096
openssl rsa -in enablebanking.pem -pubout -out enablebanking_pub.pem
```

Keep `enablebanking.pem` private - you will mount it into the container.  
You will upload `enablebanking_pub.pem` to the Enable Banking dashboard in the next step.

### 2. Create an Enable Banking account

1. Go to [enablebanking.com](https://enablebanking.com) and sign up
2. Create a new application in the dashboard
3. Upload `enablebanking_pub.pem` as the public key for your application
4. Note your **App ID**

### 3. Register your callback URL

In your Enable Banking application settings, add the following redirect URI:

```
https://your-domain.com/bank/callback
```

### 4. Update your `docker-compose.yml`

Add the following environment variables and volume to the `cowallet-backend` service. Replace `<host_folder_secrets>` with the folder containing your `enablebanking.pem` file (e.g. `/home/user/cowallet/secrets`).

```yaml
    environment:
      - ENABLEBANKING_APP_ID=your-app-id
      - ENABLEBANKING_PRIVATE_KEY_PATH=/backend/secrets/enablebanking.pem
    volumes:
      - <host_folder_secrets>:/backend/secrets
```

Once configured, a **Bank connection** section appears in the app settings where you can connect your bank account.

## Push Notifications

Push notifications are supported on mobile (iOS and Android). To receive them, install the app on your phone first (Chrome or Safari: use "Add to Home Screen"), then open the app, go to settings and toggle "Notifications". No server configuration needed.

## Configuration

All variables are optional. The app runs without any of them.

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key - auto-generated and persisted on first run if not set |
| `PUID` | User ID to run the backend process as (default: 0 / root) |
| `PGID` | Group ID to run the backend process as (default: 0 / root) |
| `APP_LANG` | Default language for seeded data: `en` (default) or `fr`. Sets the language of default categories and payment methods on first setup. |
| `ENABLEBANKING_APP_ID` | Enable Banking app ID - required for bank sync |
| `ENABLEBANKING_PRIVATE_KEY_PATH` | Path to the RSA private key inside the container - required for bank sync |

## Tech Stack

- **Frontend** - React, Vite, Tailwind CSS, Recharts, PWA
- **Backend** - FastAPI, SQLAlchemy, SQLite
- **Auth** - JWT (python-jose), bcrypt
- **Push** - Web Push API, VAPID (pywebpush), compatible iOS 16.4+ and Android
- **Proxy** - nginx

## License

AGPL-3.0 - see [LICENSE](LICENSE)
