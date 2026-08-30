#!/bin/bash
# render-build.sh - Downloads course data during Render deployment

set -e  # Exit on error

echo "📥 Downloading course data from CUtopia Labs..."

# Create data directory if it doesn't exist
mkdir -p data

# Clone the dataset (shallow clone for speed)
echo "Cloning repository..."
git clone --depth 1 https://github.com/cutopia-labs/cuhk-course-data.git temp-data

# Copy JSON files from courses/ directory
echo "Copying course data..."
cp temp-data/courses/*.json data/

# Clean up
rm -rf temp-data

# Count files to verify
file_count=$(ls -1 data/*.json 2>/dev/null | wc -l)
echo "✅ Downloaded $file_count subject files to data/"

# Show a sample of what was downloaded
if [ $file_count -gt 0 ]; then
    echo "📚 Sample files:"
    ls -1 data/*.json | head -5 | sed 's/^/  - /'
    if [ $file_count -gt 5 ]; then
        echo "  ... and $(($file_count - 5)) more"
    fi
fi

echo "✅ Data download complete!"