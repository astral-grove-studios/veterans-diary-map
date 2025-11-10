# GitHub Pages Setup Guide

This guide will help you deploy the Veterans Diary Map to GitHub Pages so stakeholders can view and test it.

## 🚀 Quick Setup (5 minutes)

### Step 1: Push Your Code

If you haven't already pushed your changes:

```bash
git push origin codebase_optimisation
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/astral-grove-studios/veterans-diary-map`
2. Click on **Settings** (top menu)
3. In the left sidebar, click **Pages**
4. Under **Build and deployment**:
   - Source: Select **GitHub Actions**
5. Click **Save**

### Step 3: Trigger Deployment

The GitHub Actions workflow will automatically deploy when you push to `main` or `codebase_optimisation` branch.

**Option A: Merge your branch to main**
```bash
git checkout main
git merge codebase_optimisation
git push origin main
```

**Option B: Manual trigger**
1. Go to **Actions** tab on GitHub
2. Click "Deploy to GitHub Pages" workflow
3. Click **Run workflow** → Select your branch → **Run workflow**

### Step 4: Access Your Live Site

Once deployed (usually takes 1-2 minutes), your site will be available at:

**https://astral-grove-studios.github.io/veterans-diary-map/**

## 🔍 Checking Deployment Status

1. Go to the **Actions** tab in your GitHub repository
2. Look for the "Deploy to GitHub Pages" workflow
3. Green checkmark ✓ = Successfully deployed
4. Red X = Failed (click to see error logs)

## 📝 Important Notes

### API Keys Are Safe
- Your `config.js` file with API keys is in `.gitignore`
- It will NOT be deployed to GitHub Pages
- The site will use the `google-calendar-events` backup file instead

### Calendar Updates
Since GitHub Pages won't have your `config.js`, the site will use the static event data from `google-calendar-events` file. 

**To update events:**
1. Run the site locally with your API key
2. Copy the fetched events to `google-calendar-events` file
3. Commit and push the updated file
4. GitHub Pages will show the updated events

### Custom Domain (Optional)
If you want a custom domain like `veterans-diary.vfvic.co.uk`:
1. Go to Settings → Pages
2. Enter your custom domain
3. Follow DNS configuration instructions

## 🎯 Sharing with Stakeholders

Once deployed, you can share:

**Live Demo Link:**
```
https://astral-grove-studios.github.io/veterans-diary-map/
```

**QR Code:**
Generate a QR code for this URL for easy mobile access.

**Embed in Email:**
```html
<a href="https://astral-grove-studios.github.io/veterans-diary-map/">
  View Veterans Diary Map Demo
</a>
```

## 🔄 Future Updates

Any time you push to `main` or `codebase_optimisation`, the site automatically updates:

```bash
# Make your changes
git add .
git commit -m "Update feature X"
git push origin codebase_optimisation
# Wait 1-2 minutes, then refresh the live site
```

## 🛠️ Troubleshooting

**Deployment Failed?**
- Check Actions tab for error details
- Ensure repository has Pages enabled
- Verify workflow file syntax

**Site Not Loading?**
- Wait 2-3 minutes after first deployment
- Clear browser cache
- Check if GitHub Pages is enabled in settings

**Events Not Showing?**
- The live site uses `google-calendar-events` file (not API)
- Update this file locally and push changes

## 📞 Need Help?

- Check GitHub Actions logs for deployment issues
- Verify Pages settings in repository Settings
- Ensure branch name matches workflow configuration

---

**Pro Tip:** Create a separate branch called `gh-pages` if you want to keep your development separate from the deployed version!
