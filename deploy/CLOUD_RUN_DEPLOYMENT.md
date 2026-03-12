# TitanMeet — Google Cloud Run Deployment Guide

## Architecture

```
*.titanmeet.com  →  HTTPS Load Balancer (static IP)
                       ↓
                    Cloud Run (titanmeet service)
                       ↓
                    Nginx serving SPA (port 8080)
```

---

## 1. Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed (for local builds)
- GoDaddy domain `titanmeet.com`

---

## 2. Build & Deploy to Cloud Run

### Option A: Quick deploy (source-based)

```bash
gcloud run deploy titanmeet \
  --source . \
  --dockerfile deploy/Dockerfile \
  --region me-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars="" \
  --update-build-env-vars \
    VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co,\
    VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY,\
    VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_ID,\
    VITE_PUBLIC_ROOT_DOMAIN=titanmeet.com
```

### Option B: Build image manually

```bash
# Build
docker build -f deploy/Dockerfile \
  --build-arg VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY \
  --build-arg VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_ID \
  --build-arg VITE_PUBLIC_ROOT_DOMAIN=titanmeet.com \
  -t gcr.io/YOUR_GCP_PROJECT/titanmeet:latest .

# Push
docker push gcr.io/YOUR_GCP_PROJECT/titanmeet:latest

# Deploy
gcloud run deploy titanmeet \
  --image gcr.io/YOUR_GCP_PROJECT/titanmeet:latest \
  --region me-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080
```

### Option C: Cloud Build

```bash
gcloud builds submit \
  --config deploy/cloudbuild.yaml \
  --substitutions \
    _VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co,\
    _VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY,\
    _VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_ID \
  .
```

---

## 3. HTTPS Load Balancer + Wildcard SSL

### 3a. Reserve a static IP

```bash
gcloud compute addresses create titanmeet-ip \
  --global \
  --ip-version IPV4

# Note the IP address:
gcloud compute addresses describe titanmeet-ip --global --format='value(address)'
```

### 3b. Create a Serverless NEG

```bash
gcloud compute network-endpoint-groups create titanmeet-neg \
  --region=me-central1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=titanmeet
```

### 3c. Create Backend Service

```bash
gcloud compute backend-services create titanmeet-backend \
  --global \
  --load-balancing-scheme=EXTERNAL_MANAGED

gcloud compute backend-services add-backend titanmeet-backend \
  --global \
  --network-endpoint-group=titanmeet-neg \
  --network-endpoint-group-region=me-central1
```

### 3d. Create URL Map

```bash
gcloud compute url-maps create titanmeet-urlmap \
  --default-service=titanmeet-backend
```

### 3e. Create Google-Managed SSL Certificate (wildcard)

```bash
# Create a DNS authorization for wildcard cert
gcloud certificate-manager dns-authorizations create titanmeet-dns-auth \
  --domain="titanmeet.com"

# Get the CNAME record to add to DNS (see output)
gcloud certificate-manager dns-authorizations describe titanmeet-dns-auth

# Create the certificate (after adding the CNAME to DNS)
gcloud certificate-manager certificates create titanmeet-cert \
  --domains="titanmeet.com,*.titanmeet.com,www.titanmeet.com" \
  --dns-authorizations=titanmeet-dns-auth
```

### 3f. Create Certificate Map

```bash
gcloud certificate-manager maps create titanmeet-cert-map

gcloud certificate-manager maps entries create titanmeet-cert-entry-root \
  --map=titanmeet-cert-map \
  --hostname="titanmeet.com" \
  --certificates=titanmeet-cert

gcloud certificate-manager maps entries create titanmeet-cert-entry-wildcard \
  --map=titanmeet-cert-map \
  --hostname="*.titanmeet.com" \
  --certificates=titanmeet-cert

gcloud certificate-manager maps entries create titanmeet-cert-entry-www \
  --map=titanmeet-cert-map \
  --hostname="www.titanmeet.com" \
  --certificates=titanmeet-cert
```

### 3g. Create HTTPS Proxy + Forwarding Rule

```bash
gcloud compute target-https-proxies create titanmeet-https-proxy \
  --url-map=titanmeet-urlmap \
  --certificate-map=titanmeet-cert-map

gcloud compute forwarding-rules create titanmeet-https-rule \
  --global \
  --target-https-proxy=titanmeet-https-proxy \
  --address=titanmeet-ip \
  --ports=443
```

### 3h. (Optional) HTTP → HTTPS redirect

```bash
gcloud compute url-maps import titanmeet-http-redirect \
  --source /dev/stdin <<'EOF'
name: titanmeet-http-redirect
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
EOF

gcloud compute target-http-proxies create titanmeet-http-proxy \
  --url-map=titanmeet-http-redirect

gcloud compute forwarding-rules create titanmeet-http-rule \
  --global \
  --target-http-proxy=titanmeet-http-proxy \
  --address=titanmeet-ip \
  --ports=80
```

---

## 4. GoDaddy DNS Configuration

Go to **GoDaddy → DNS Management** for `titanmeet.com`.

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `<STATIC_IP>` | 600 |
| A | www | `<STATIC_IP>` | 600 |
| A | * | `<STATIC_IP>` | 600 |
| CNAME | `_acme-challenge` | *(from dns-authorization output)* | 600 |

Replace `<STATIC_IP>` with the IP from step 3a.

The CNAME record is required for Google-managed wildcard SSL certificate validation.

---

## 5. How SPA Routing Works

1. **All requests** hit the Nginx container on Cloud Run
2. Nginx `try_files $uri $uri/ /index.html` ensures deep links return the SPA
3. React Router handles client-side routing:
   - `titanmeet.com` / `www.titanmeet.com` → main site + dashboard
   - `clientSlug.titanmeet.com/eventSlug` → public event page
4. `getClientSlugFromHostname()` extracts the client slug from the hostname
5. Reserved subdomains (`www`, `app`, `api`, `admin`) are excluded

---

## 6. Test Checklist

- [ ] `docker build -f deploy/Dockerfile -t titanmeet .` succeeds
- [ ] `docker run -p 8080:8080 titanmeet` → `localhost:8080` loads main site
- [ ] Refresh on `localhost:8080/login` returns SPA (not 404)
- [ ] Deploy to Cloud Run → service URL works
- [ ] `titanmeet.com` → main site / landing page
- [ ] `www.titanmeet.com` → main site (not treated as client slug)
- [ ] `acme.titanmeet.com/board-meeting` → loads correct event
- [ ] Refresh on `acme.titanmeet.com/board-meeting` works (not 404)
- [ ] `nonexistent.titanmeet.com/x` → "not found" page
- [ ] SSL certificate is valid for `*.titanmeet.com`

---

## 7. Updating the Deployment

```bash
# Rebuild and redeploy
gcloud run deploy titanmeet \
  --source . \
  --dockerfile deploy/Dockerfile \
  --region me-central1 \
  --allow-unauthenticated \
  --port 8080
```

The load balancer automatically picks up new Cloud Run revisions.
