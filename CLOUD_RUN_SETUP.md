# Google Cloud Run Deployment Setup

This guide walks you through deploying the backend server to Google Cloud Run with CI/CD.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **GitHub repository** (your code should be pushed to GitHub)
3. **gcloud CLI** installed locally (optional, for manual deploys)

---

## Step 1: Set Up Google Cloud Project

### 1.1 Create or Select a Project

```bash
# List existing projects
gcloud projects list

# Create a new project (or use existing)
gcloud projects create botaplace-prod --name="Botaplace Production"

# Set as active project
gcloud config set project botaplace-prod
```

### 1.2 Enable Required APIs

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 1.3 Create Artifact Registry Repository

```bash
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker images for Cloud Run"
```

---

## Step 2: Create Service Account for GitHub Actions

### 2.1 Create Service Account

```bash
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployer"
```

### 2.2 Grant Required Permissions

```bash
PROJECT_ID=$(gcloud config get-value project)

# Cloud Run Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Artifact Registry Writer
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Service Account User (to deploy as the service)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 2.3 Create and Download Key

```bash
gcloud iam service-accounts keys create ~/github-actions-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com
```

**Important:** Keep this key file secure! You'll add it to GitHub Secrets.

---

## Step 3: Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `GCP_PROJECT_ID` | Your Google Cloud project ID (e.g., `botaplace-prod`) |
| `GCP_SA_KEY` | Contents of `github-actions-key.json` (paste entire JSON) |
| `FRONTEND_URL` | Your frontend URL (e.g., `https://botaplace.com`) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `GOOGLE_GEMINI_API_KEY` | Your Gemini API key |
| `COMPOSIO_API_KEY` | Your Composio API key |
| `TELNYX_API_KEY` | Your Telnyx API key |
| `TELNYX_API_SECRET` | Your Telnyx API secret |
| `TELNYX_VOICE_APP_ID` | Your Telnyx Voice App ID |

---

## Step 4: Deploy

### Option A: Automatic (Push to GitHub)

Simply push changes to the `server/` folder:

```bash
git add .
git commit -m "Deploy backend to Cloud Run"
git push origin main
```

The GitHub Action will automatically:
1. Build the Docker image
2. Push to Artifact Registry
3. Deploy to Cloud Run
4. Output the service URL

### Option B: Manual Deploy (First Time)

```bash
cd server

# Build and deploy directly
gcloud run deploy botaplace-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --set-env-vars "FRONTEND_URL=https://your-frontend.com" \
  --set-env-vars "SUPABASE_URL=your-supabase-url" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=your-key" \
  --set-env-vars "GOOGLE_GEMINI_API_KEY=your-key" \
  --set-env-vars "TELNYX_API_KEY=your-key" \
  --set-env-vars "TELNYX_VOICE_APP_ID=your-app-id"
```

---

## Step 5: Update Telnyx Webhook URLs

After deployment, you'll get a URL like:
```
https://botaplace-backend-xxxxx-uc.a.run.app
```

### Update in Telnyx Portal:

1. Go to [Telnyx Mission Control](https://portal.telnyx.com)
2. Navigate to **Voice** → **TeXML Applications** or **Call Control Applications**
3. Update webhook URL to:
   ```
   https://botaplace-backend-xxxxx-uc.a.run.app/telnyx/webhook
   ```

### Update BACKEND_URL Secret:

Add one more GitHub secret:
| Secret Name | Value |
|-------------|-------|
| `BACKEND_URL` | `https://botaplace-backend-xxxxx-uc.a.run.app` |

Then update the workflow to include it, or set it directly in Cloud Run console.

---

## Step 6: Verify Deployment

### Check Service Status

```bash
gcloud run services describe botaplace-backend --region us-central1
```

### Test Health Endpoint

```bash
curl https://botaplace-backend-xxxxx-uc.a.run.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "uptime": 123.45
}
```

### Test Telnyx Webhook

```bash
curl https://botaplace-backend-xxxxx-uc.a.run.app/telnyx/health
```

---

## Monitoring & Logs

### View Logs

```bash
gcloud run logs read botaplace-backend --region us-central1 --limit 50
```

Or in Cloud Console: **Cloud Run** → **botaplace-backend** → **Logs**

### View Metrics

Cloud Console: **Cloud Run** → **botaplace-backend** → **Metrics**

---

## Rollback

If something goes wrong:

```bash
# List revisions
gcloud run revisions list --service botaplace-backend --region us-central1

# Rollback to previous revision
gcloud run services update-traffic botaplace-backend \
  --region us-central1 \
  --to-revisions REVISION_NAME=100
```

---

## Cost Estimate

Cloud Run pricing (us-central1):
- **CPU**: $0.00002400 / vCPU-second
- **Memory**: $0.00000250 / GiB-second
- **Requests**: $0.40 / million requests

With min-instances=0, you only pay when the service is handling requests.

**Estimated monthly cost for moderate usage**: $5-20/month

---

## Troubleshooting

### WebSocket Connection Issues

Cloud Run supports WebSockets, but ensure:
1. Client connects to `wss://` (not `ws://`)
2. Connection timeout is set appropriately (default 300s)

### Cold Start Latency

First request after idle may take 2-5 seconds. To reduce:
- Set `--min-instances 1` (keeps one instance warm, ~$15/month)

### Environment Variables Not Working

Check in Cloud Console: **Cloud Run** → **Service** → **Edit & Deploy New Revision** → **Variables & Secrets**
