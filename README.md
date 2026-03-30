# PT Academy — Assessment Eligibility Report

A simple reporting site that queries the 360Learning API to show which learners have completed a specific learning path, helping identify who is eligible for assessment day booking.

## Features

- **Tab-based view** for Level 2 and Level 3 paths
- **Live learner data** from 360Learning API
- **Sortable table** (click Name or Completed column headers)
- **PT Academy branding** (black, white, and gold)
- **Secure API proxy** — credentials never exposed to the browser
- **Free hosting** on Cloudflare Pages

## Setup Instructions

### 1. Create a GitHub Repository

1. Create a new repository on GitHub (public or private)
2. Clone it locally
3. Copy the files from this project into that repository:
   - `index.html`
   - `functions/api/path-stats.js`
   - `_headers`
   - `.gitignore`
   - `README.md`
4. Push to GitHub: `git add . && git commit -m "Initial commit" && git push`

### 2. Set Up Cloudflare Pages

1. Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com)
2. Click **Create a project** → **Connect to Git**
3. Authorize Cloudflare to access your GitHub account
4. Select the repository you just created
5. **Build settings:**
   - **Framework**: None
   - **Build command**: (leave blank)
   - **Build output directory**: (leave blank)
6. Click **Save and deploy** — it will deploy the site

### 3. Add Environment Variables

⚠️ **Important:** Do NOT commit your credentials to GitHub. Store them in Cloudflare's environment variables.

1. In your Cloudflare Pages project, go to **Settings** → **Environment variables**
2. Under **Production**, click **Add variable** and add:
   - **Name:** `CLIENT_ID`
   - **Value:** (your 360Learning OAuth Client ID)
3. Click **Add variable** again:
   - **Name:** `CLIENT_SECRET`
   - **Value:** (your 360Learning OAuth Client Secret)
   - **Check "Encrypt"** — this hides the value after saving
4. Click **Save** and wait for the deployment to complete

### 4. Test the Site

Once deployed, visit your Cloudflare Pages URL (typically `https://your-project-name.pages.dev`):

1. The page should load with the Level 2 tab active
2. You should see a table of learners who have completed Level 2
3. Click **Level 3** to switch paths
4. Click column headers to sort
5. Click **Refresh** to reload the data

## Local Testing (Optional)

To test locally before deploying:

1. Install [Node.js](https://nodejs.org/) if you haven't already
2. Install Wrangler: `npm install -g wrangler`
3. Create a `.dev.vars` file in the project root (this is `.gitignore`'d):
   ```
   CLIENT_ID=your_client_id_here
   CLIENT_SECRET=your_client_secret_here
   ```
4. Run: `wrangler pages dev .`
5. Open `http://localhost:8788` in your browser

## How It Works

- **Browser** → Your Cloudflare Pages site
- **Site** → Calls `/api/path-stats?pathId=XXX` (server-side)
- **Server** → Fetches OAuth token from 360Learning (keeps credentials safe)
- **Server** → Calls 360Learning API and filters for completed learners
- **Server** → Returns JSON to the browser
- **Browser** → Displays table of eligible learners

The server-side proxy ensures your API credentials are never exposed to the browser.

## Troubleshooting

**"Failed to authenticate with 360Learning"**
- Check that your `CLIENT_ID` and `CLIENT_SECRET` are correct in Cloudflare's environment variables
- Verify they are the right credentials from your 360Learning admin panel

**"Failed to fetch path stats"**
- Ensure the 360Learning API is accessible and your authentication was successful
- Check the browser's DevTools → Network tab → `/api/path-stats` to see the error details

**Names/emails showing as "Unknown"**
- This may happen if the 360Learning API returns different field names than expected
- Open DevTools → Network tab → click `/api/path-stats` → Response tab
- Compare the field names in the response with what the code expects
- Report this to allow the field mapping to be fixed

## Support

For issues or questions, please contact the project owner.
