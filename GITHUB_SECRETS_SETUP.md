# GitHub Secrets Setup for Automated Event Fetching

This guide shows you how to add your Google Calendar API credentials as GitHub Secrets so the deployment automatically fetches fresh events without exposing your API key.

## 🔐 Why Use GitHub Secrets?

- **Secure**: API keys are encrypted and never visible in code or logs
- **Automatic**: Events update automatically on every deployment
- **Daily Updates**: Optional scheduled task refreshes events daily at 6 AM UTC
- **No Manual Work**: Set it once, forget it

## 📝 Step-by-Step Setup

### Step 1: Get Your Credentials

You should already have:
- **API Key**: `Your actual API key from Google Cloud Console`
- **Calendar ID**: `Your actual calendar ID`

### Step 2: Add Secrets to GitHub

1. Go to your repository on GitHub:
   ```
   https://github.com/astral-grove-studios/veterans-diary-map
   ```

2. Click **Settings** (top menu)

3. In the left sidebar, expand **Secrets and variables** → Click **Actions**

4. Click **New repository secret** button

5. Add the first secret:
   - **Name**: `GOOGLE_CALENDAR_API_KEY`
   - **Secret**: Paste your API key
   - Click **Add secret**

6. Click **New repository secret** again

7. Add the second secret:
   - **Name**: `GOOGLE_CALENDAR_ID`
   - **Secret**: `veteransdiarynortheast@gmail.com`
   - Click **Add secret**

### Step 3: Verify Secrets

You should now see two secrets listed:
- ✅ `GOOGLE_CALENDAR_API_KEY`
- ✅ `GOOGLE_CALENDAR_ID`

**Note**: You won't be able to view the secret values after creating them (for security).

### Step 4: Trigger Deployment

The next time you push code or manually trigger the workflow, it will automatically fetch fresh events!

**Manual Trigger:**
1. Go to **Actions** tab
2. Click "Deploy to GitHub Pages"
3. Click **Run workflow** → Select branch → **Run workflow**

## 🔄 How It Works

### Automatic Updates

The workflow now:
1. **Checks out your code**
2. **Fetches latest events** from Google Calendar using your secret API key
3. **Saves events** to `google-calendar-events` file
4. **Deploys to GitHub Pages** with fresh event data

### Daily Refresh (Optional)

The workflow includes a scheduled task that runs daily at 6 AM UTC to fetch fresh events automatically. This means your site always shows current events without any manual work!

To disable daily updates, remove these lines from `.github/workflows/deploy.yml`:
```yaml
schedule:
  - cron: '0 6 * * *'
```

## 🎯 Benefits

✅ **API key stays secret** - Never exposed in code or logs
✅ **Fresh events** - Auto-updates on every deployment
✅ **Daily refresh** - Optional scheduled updates
✅ **No manual work** - Set and forget
✅ **Safe to share** - Repository can be public

## 🧪 Testing

### Test Locally First

You can test the fetch script locally:

```bash
node fetch-events.js YOUR_API_KEY veteransdiarynortheast@gmail.com
```

This will update your local `google-calendar-events` file.

### Check GitHub Actions Logs

After deployment:
1. Go to **Actions** tab
2. Click the latest workflow run
3. Expand "Fetch latest calendar events" step
4. You should see: `Successfully saved X events to google-calendar-events`

## 🛠️ Troubleshooting

### Secrets Not Working?

- Verify secret names match exactly (case-sensitive):
  - `GOOGLE_CALENDAR_API_KEY`
  - `GOOGLE_CALENDAR_ID`
- Secrets are only available to workflows, not in pull requests from forks
- Re-create the secret if you think it's incorrect

### No Events Showing?

- Check Actions logs for errors in "Fetch latest calendar events" step
- Verify Calendar ID is correct
- Ensure calendar is set to public
- Check that API key has Calendar API enabled

### Workflow Fails?

The workflow is set to `continue-on-error: true` for the fetch step, meaning:
- If fetch fails, deployment continues with existing events
- Check logs to see if there's an API error
- Verify API key restrictions allow GitHub Actions IPs

## 🔒 Security Best Practices

✅ **Never commit config.js** - Already in .gitignore
✅ **Use restricted API keys** - Limit to Calendar API only
✅ **Rotate keys periodically** - Update secrets annually
✅ **Monitor usage** - Check Google Cloud Console for unexpected activity

## 📞 Need Help?

- Check Actions logs for detailed error messages
- Verify secrets are set correctly in Settings → Secrets
- Ensure calendar permissions are correct
- Test fetch script locally first

---

**Once set up, your GitHub Pages site will always show current events automatically!** 🎉
