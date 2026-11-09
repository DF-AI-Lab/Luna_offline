#!/usr/bin/env python3
"""Build the installable web app: docs/index.html = app/luna-offline.html (Orbit's logic + Luna's look, unchanged)
wrapped with the web parts (Passport, offline brain, connectors, settings). Run after every change to app/luna-offline.html.
Also stamps the service worker cache name so phones pick up the new version."""
import hashlib, pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
app = (root / 'app/luna-offline.html').read_text()
app = re.sub(r'<title>.*?</title>\n?', '', app, count=1)
app = app.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
fonts = re.search(r'<link rel="preconnect".*?\n<link rel="stylesheet" href="https://fonts[^>]*>\n', app, re.S)
app = app.replace(fonts.group(0), '') if fonts else app
head = f'''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Luna Offline</title>
<meta name="description" content="Orbit's brain with Luna's look. Tell it things: diary, to-do, notes, money.">
<meta name="theme-color" content="#03060f">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
{fonts.group(0) if fonts else ''}<link rel="stylesheet" href="passport/passport.css">
<link rel="stylesheet" href="web/web.css">
<script src="passport/config.js"></script>
<script src="passport/google.js"></script>
<script src="passport/passport.js"></script>
<script src="passport/ui.js"></script>
<script src="web/brain.js"></script>
<script src="web/claude.js"></script>
<script src="web/store.js"></script>
<script src="web/connect.js"></script>
<script src="web/shim.js"></script>
</head>
<body class="lw-locked">
<div class="ppcover" id="ppcover"><div id="ppmount"></div></div>
<!-- ===== app/luna-offline.html (do not edit here: edit that file, then run tools/build_web.py) ===== -->
'''
tail = '''<!-- ===== end of app/luna-offline.html ===== -->
<script src="web/settings.js"></script>
</body>
</html>
'''
out = head + app + tail
import json
st = (root / 'docs/web/settings.js').read_text()
ver = re.search(r"const VERSION = '([^']+)'", st).group(1)
notes = json.loads(re.search(r"const NOTES = (\[.*?\]);", st).group(1).replace("'", '"'))
(root / 'docs/version.json').write_text(json.dumps({'version': ver, 'notes': notes}, ensure_ascii=False) + '\n')
(root / 'docs/index.html').write_text(out)
files = sorted(p for p in (root / 'docs').rglob('*') if p.is_file() and p.name not in ('sw.js',) and 'tests' not in p.parts)
h = hashlib.sha1(b''.join(p.read_bytes() for p in files)).hexdigest()[:10]
sw = (root / 'docs/sw.js').read_text()
sw = re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{h}';", sw)
(root / 'docs/sw.js').write_text(sw)
print('built docs/index.html, cache', h)
