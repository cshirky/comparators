import json
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _school_data import fetch_school, FIELD_LABELS


def handle_school(unitid: str) -> tuple[int, dict]:
    if not unitid:
        return 400, {"error": "unitid required"}
    try:
        data = fetch_school(unitid)
        data["_labels"] = FIELD_LABELS
        return 200, data
    except Exception as exc:
        return 500, {"error": str(exc)}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        unitid = params.get("unitid", [""])[0].strip()
        status, body = handle_school(unitid)
        self._json(status, body)

    def _json(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass
