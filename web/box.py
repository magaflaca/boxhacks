#!/usr/bin/env python3
"""Sube archivos a boxhacks en partes paralelas a traves de Cloudflare.

Uso:
    python box.py video.mp4
    python box.py foto.png notas.txt --expires 1d
    python box.py video.mp4 --slug mi-video

Imprime un enlace por archivo. El token se guarda en ~/.boxhacks-token para
que tus subidas queden agrupadas; tambien se puede pasar en BOX_TOKEN.
Solo usa la biblioteca estandar de Python 3.8 o superior.
"""

import argparse
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE_URL = os.environ.get("BOX_URL", "https://box.hacks.win").rstrip("/")
TOKEN_FILE = Path.home() / ".boxhacks-token"
PARALLEL = 4
RETRIES = 4
USER_AGENT = "boxhacks-cli/1"


class BoxError(Exception):
    pass


def load_token():
    token = os.environ.get("BOX_TOKEN")
    if token:
        return token
    try:
        return TOKEN_FILE.read_text().strip() or None
    except OSError:
        return None


def save_token(token):
    try:
        TOKEN_FILE.write_text(token)
        TOKEN_FILE.chmod(0o600)
    except OSError:
        pass


def call(method, url, token=None, body=None, payload=None):
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            text = response.read().decode()
            return response.headers, json.loads(text) if text else None
    except urllib.error.HTTPError as error:
        try:
            message = json.loads(error.read().decode())["message"]
        except (ValueError, KeyError):
            message = f"HTTP {error.code}"
        raise BoxError(message) from None
    except OSError as error:
        raise BoxError(f"sin conexion: {getattr(error, 'reason', error)}") from None


class Progress:
    def __init__(self, name, total):
        self.name = name
        self.total = total
        self.done = 0
        self.started = time.monotonic()
        self.lock = threading.Lock()

    def add(self, amount):
        with self.lock:
            self.done += amount
            elapsed = max(time.monotonic() - self.started, 0.001)
            speed = self.done / elapsed / 1024 / 1024
            percent = self.done * 100 // self.total
            sys.stderr.write(f"\r  {self.name}  {percent:3d}%  {speed:5.1f} MB/s ")
            sys.stderr.flush()

    def finish(self):
        sys.stderr.write("\n")


def send_chunk(path, session, index, progress):
    size = session["chunk_bytes"]
    with open(path, "rb") as handle:
        handle.seek(index * size)
        data = handle.read(size)
    url = f"{session['upload_url']}/api/uploads/{session['id']}/chunks/{index}"
    for attempt in range(RETRIES + 1):
        try:
            call("PUT", url, body=data)
            progress.add(len(data))
            return
        except BoxError:
            if attempt == RETRIES:
                raise
            time.sleep(2 ** attempt)


def upload(path, slug, expires, token):
    size = path.stat().st_size
    if size == 0:
        raise BoxError("el archivo esta vacio")

    payload = {"name": path.name, "size": size, "expires": expires, "slug": slug}
    headers, session = call("POST", f"{BASE_URL}/api/uploads", token=token, payload=payload)
    token = token or headers.get("X-Box-Token")

    progress = Progress(path.name, size)
    try:
        with ThreadPoolExecutor(PARALLEL) as pool:
            jobs = [pool.submit(send_chunk, path, session, i, progress) for i in range(session["chunks"])]
            for job in jobs:
                job.result()
        _, stored = call("POST", f"{BASE_URL}/api/uploads/{session['id']}/complete", token=token)
    except BaseException:
        try:
            call("DELETE", f"{BASE_URL}/api/uploads/{session['id']}", token=token)
        except BoxError:
            pass
        raise
    finally:
        progress.finish()
    return stored["url"], token


def main():
    parser = argparse.ArgumentParser(description="Sube archivos a boxhacks.")
    parser.add_argument("files", nargs="+", type=Path, help="archivos a subir")
    parser.add_argument("--slug", help="nombre del enlace (solo con un archivo)")
    parser.add_argument("--expires", default="3d", help="caducidad: 30m, 12h, 3d... hasta 7d")
    args = parser.parse_args()

    if args.slug and len(args.files) > 1:
        parser.error("--slug solo vale para un archivo")

    token = load_token()
    failed = False
    for path in args.files:
        try:
            url, new_token = upload(path, args.slug, args.expires, token)
        except (BoxError, OSError) as error:
            print(f"error con {path}: {error}", file=sys.stderr)
            failed = True
            continue
        if new_token and new_token != token:
            token = new_token
            save_token(token)
        print(url)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
