#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Eclipse Kitchen Designer — One-Command Deploy Setup
# ============================================================
REPO_NAME="eclipse-kitchen-designer"
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Eclipse Kitchen Designer — Deploy Setup        ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

echo "▸ Step 1/5: Creating GitHub repo..."
if gh repo view "$REPO_NAME" &>/dev/null 2>&1; then
  echo "  Repo $REPO_NAME already exists, skipping creation."
else
  gh repo create "$REPO_NAME" --private --description "Constraint-based kitchen cabinet layout engine with C3 pricing" --source . --push
  echo "  ✓ Created github.com/$(gh api user -q .login)/$REPO_NAME"
fi

if ! git remote get-url origin &>/dev/null; then
  GH_USER=$(gh api user -q .login)
  git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
fi
git push -u origin main 2>/dev/null || echo "  (already pushed)"

echo ""
echo "▸ Step 2/5: Supabase setup"
echo "  1. Go to https://supabase.com → New Project"
echo "  2. Name: eclipse-kitchen-designer"
echo "  3. After creation, go to Settings → API"
echo "  4. Copy your Project URL and anon/public key"
echo ""
read -p "  Paste your Supabase URL (https://xxx.supabase.co): " SUPA_URL
read -p "  Paste your Supabase anon key: " SUPA_KEY
echo ""

cat > frontend/.env <<ENVEOF
VITE_SUPABASE_URL=$SUPA_URL
VITE_SUPABASE_ANON_KEY=$SUPA_KEY
ENVEOF
echo "  ✓ Wrote frontend/.env"

echo ""
echo "  Now run the schema in Supabase:"
echo "  1. Go to SQL Editor in your Supabase dashboard"
echo "  2. Paste the contents of supabase/schema.sql"
echo "  3. Click 'Run'"
echo ""
read -p "  Press Enter when schema is applied..."

echo ""
echo "▸ Step 3/5: Installing frontend dependencies..."
cd frontend && npm install && cd ..
echo "  ✓ Dependencies installed"

echo ""
echo "▸ Step 4/5: Deploying to Netlify..."
if ! command -v netlify &>/dev/null; then
  echo "  Installing Netlify CLI..."
  npm i -g netlify-cli
fi
netlify init
netlify env:set VITE_SUPABASE_URL "$SUPA_URL"
netlify env:set VITE_SUPABASE_ANON_KEY "$SUPA_KEY"
echo "  ✓ Environment variables set on Netlify"
netlify deploy --build --prod
echo ""
echo "  ✓ Deployed to Netlify!"

echo ""
echo "▸ Step 5/5: Running engine tests..."
cd eclipse-engine
node test.js && node test-patterns.js && node test-pricing.js
cd ..

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✓ Setup Complete!                              ║"
echo "║                                                  ║"
echo "║   GitHub:  gh repo view --web                    ║"
echo "║   Netlify: netlify open                          ║"
echo "║   Local:   netlify dev                           ║"
echo "╚══════════════════════════════════════════════════╝"
