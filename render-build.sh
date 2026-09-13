#!/bin/bash
# render-build.sh - Verifies course data is present

set -e

echo "📥 Checking course data..."

file_count=$(ls -1 data/*.json 2>/dev/null | wc -l)

if [ "$file_count" -eq 0 ]; then
    echo "❌ No JSON files found in data/"
    exit 1
fi

echo "✅ Found $file_count subject files in data/"
ls -1 data/*.json | head -5 | sed 's/^/  - /'
if [ "$file_count" -gt 5 ]; then
    echo "  ... and $(($file_count - 5)) more"
fi

echo "✅ Data check complete!"