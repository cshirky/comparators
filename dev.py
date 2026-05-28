#!/usr/bin/env python3
"""Local dev server. Serves root as static files and routes /api/* to handlers."""
import json
import mimetypes
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "api"))
from school import handle_school
from compare import handle_compare

ROOT = Path(__file__).parent
PORT = int(os.environ.get("PORT", 3000))


class DevServer(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        if path == "/api/school":
            unitid = params.get("unitid", [""])[0].strip()
            status, body = handle_school(unitid)
            self._json(status, body)
        elif path == "/api/compare":
            raw = params.get("unitids", [""])[0]
            unitids = [u.strip() for u in raw.split(",") if u.strip()]
            status, body = handle_compare(unitids)
            self._json(status, body)
        else:
            self._static(path)

    def _json(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(payload)

    def _static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        file_path = ROOT / path.lstrip("/")
        if file_path.exists() and file_path.is_file():
            data = file_path.read_bytes()
            mime, _ = mimetypes.guess_type(str(file_path))
            self.send_response(200)
            self.send_header("Content-Type", mime or "application/octet-stream")
            self.end_headers()
            self.wfile.write(data)
        else:
            data = (ROOT / "index.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(data)

    def log_message(self, fmt, *args):
        print(f"  {fmt % args}")


if __name__ == "__main__":
    server = HTTPServer(("localhost", PORT), DevServer)
    print(f"Dev server → http://localhost:{PORT}")
    server.serve_forever()
