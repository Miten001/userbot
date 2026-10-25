#!/usr/bin/env bash
# Render build script — ffmpeg install karta hai
set -e
apt-get update
apt-get install -y --no-install-recommends ffmpeg
pip install --no-cache-dir -r requirements.txt
