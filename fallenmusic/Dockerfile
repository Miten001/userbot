# Fallen Music — Render-ready image
#
# Upstream used nikolaik/python-nodejs:python3.9-nodejs18.  Node is not needed
# (py-tgcalls 0.9.7 shells out to the ffmpeg binary, it does not use a Node
# library), so this uses the slim Python image: much smaller and faster builds.
# Python 3.11 is verified against the pinned requirements (numpy 1.26.4,
# pillow 10.2.0 and py-tgcalls 0.9.7 all have 3.11 wheels).

FROM python:3.11-slim

# pytgcalls transcodes through ffmpeg — without it /play joins the voice chat
# and then produces silence.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies first so code-only changes reuse this layer.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p downloads cache

# Render injects PORT; config.py falls back to 10000 for local runs.
EXPOSE 10000

CMD ["python3", "web.py"]
