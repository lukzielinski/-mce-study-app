"""Serwer deweloperski: jak `python -m http.server 8000 --bind 0.0.0.0`, ale
- wymusza poprawne typy MIME (na Windowsie rejestr potrafi podać .js jako text/plain,
  przez co przeglądarka odrzuca ES modules),
- wyłącza cache, żeby zmiany w JSON-ach były widoczne od razu na telefonie,
- wypisuje adresy do wpisania w telefonie.

Użycie:  python serve.py [port]
"""
import http.server
import os
import socket
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".webmanifest": "application/manifest+json",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("192.0.2.1", 80))  # nic nie jest wysyłane; tylko wybór interfejsu
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        print(f"MCE study app działa:\n  komputer: http://localhost:{PORT}\n  telefon:  http://{lan_ip()}:{PORT}\nCtrl+C kończy.", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
