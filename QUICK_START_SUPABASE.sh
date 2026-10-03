#!/bin/bash

# Bantay-Agapay - Quick Supabase Setup Script
# Run this after getting your Supabase credentials

echo "🚀 Bantay-Agapay - Supabase Setup"
echo "=================================="
echo ""
echo "This script will help you connect Supabase to Bantay-Agapay"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local file not found!"
    echo "Please copy .env.example to .env.local first:"
    echo ""
    echo "  cp .env.example .env.local"
    echo ""
    exit 1
fi

echo "📝 Edit .env.local with your Supabase credentials:"
echo ""
echo "You'll need from Supabase:"
echo "  1. Project URL (looks like: https://xxxxx.supabase.co)"
echo "  2. Anon public key (from Settings → API)"
echo "  3. Service role secret (from Settings → API)"
echo ""
echo "Then run:"
echo "  npm run dev"
echo ""
echo "The app will use real Supabase database!"
echo ""
echo "📚 Detailed guide: See SUPABASE_SETUP.md"
echo ""
