#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"

mkdir -p "$project_root/ios/ChainIOS/ChainIOS/Web"
mkdir -p "$project_root/android/ChainAndroid/app/src/main/assets/web"

rsync -a "$project_root/assets" "$project_root/css" "$project_root/data" "$project_root/js" "$project_root/legal" "$project_root/vendor" "$project_root/index.html" "$project_root/ios/ChainIOS/ChainIOS/Web/"
rsync -a "$project_root/assets" "$project_root/css" "$project_root/data" "$project_root/js" "$project_root/legal" "$project_root/vendor" "$project_root/index.html" "$project_root/android/ChainAndroid/app/src/main/assets/web/"

echo "CHAIN web assets synced to iOS and Android."
