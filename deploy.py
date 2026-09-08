"""Publish one verified static release to the existing independent BOH game site."""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import tarfile
import tempfile
import textwrap
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("label")
parser.add_argument("--expected", required=True, help="Current release directory name, verified before switching")
parser.add_argument("--note", required=True)
parser.add_argument("--verify-release", help="Verify an already-switched release without publishing again")
args = parser.parse_args()
assert re.fullmatch(r"[a-z0-9-]+", args.label)
assert re.fullmatch(r"[a-zA-Z0-9-]+", args.expected)

checks = subprocess.run(["node", "test.cjs"], cwd=ROOT, text=True, capture_output=True)
if checks.returncode:
    print(checks.stdout + checks.stderr)
    raise SystemExit(checks.returncode)
print(checks.stdout.strip().splitlines()[-1], flush=True)
for filename in ["world.js", "engine.js", "game.js", "art.js", "audio.js"]:
    subprocess.run(["node", "--check", filename], cwd=ROOT, check=True)

# Lint and formatting gate the release too, but only when the dev tooling is installed:
# the published site itself has no dependencies, so a clean checkout can still deploy.
if (ROOT / "node_modules").is_dir():
    for tool in (["npx", "eslint", "."], ["npx", "prettier", "--check", "."]):
        subprocess.run(tool, cwd=ROOT, check=True)
    print("eslint and prettier clean", flush=True)
else:
    print("node_modules missing: skipping eslint / prettier (run npm install to gate on them)", flush=True)

files = json.loads((ROOT / "release-files.json").read_text())
assert len(files) == len(set(files))
assert all(not pathlib.Path(f).is_absolute() and ".." not in pathlib.Path(f).parts and (ROOT / f).is_file() for f in files)
hashes = {f: hashlib.sha256((ROOT / f).read_bytes()).hexdigest() for f in files}
release = args.verify_release or datetime.datetime.now().strftime("%Y%m%d-%H%M%S-") + args.label
assert re.fullmatch(r"[a-zA-Z0-9-]+", release)
remote_archive = "/tmp/tundra-" + release + ".tar.gz"
if not args.verify_release:
    with tempfile.TemporaryDirectory(prefix="tundra-release-") as folder:
        archive = pathlib.Path(folder) / "release.tar.gz"
        with tarfile.open(archive, "w:gz") as tar:
            for filename in files:
                tar.add(ROOT / filename, arcname=filename, recursive=False)
        subprocess.run(["scp", str(archive), "boh:" + remote_archive], check=True)

        script = f"""
    import hashlib, os, pathlib, tarfile
    base=pathlib.Path('/personal/tundra-chess')
    previous=os.readlink(base/'current')
    assert previous == str(base/'releases'/{args.expected!r}), 'Current release changed; inspect before overwriting'
    release=base/'releases'/{release!r}
    release.mkdir(mode=0o755)
    expected={hashes!r}
    with tarfile.open({remote_archive!r}) as archive:
        assert set(archive.getnames()) == set(expected)
        assert all(entry.isfile() for entry in archive.getmembers())
        archive.extractall(release, filter='data')
    for name, digest in expected.items():
        assert hashlib.sha256((release/name).read_bytes()).hexdigest()==digest, name
    for path in release.rglob('*'):
        path.chmod(0o755 if path.is_dir() else 0o644)
    link=base/('next-'+{release!r})
    link.symlink_to(release)
    os.replace(link,base/'current')
    pathlib.Path({remote_archive!r}).unlink()
    print(str(release))
    """
        subprocess.run(["ssh", "boh", "python3", "-"], input=textwrap.dedent(script), text=True, check=True)

# Recheck the actual current release before public verification or recording success.
source_check = f"""
import hashlib, os, pathlib, urllib.request
base=pathlib.Path('/personal/tundra-chess')
assert os.readlink(base/'current')==str(base/'releases'/{release!r})
for name,digest in {hashes!r}.items():
    assert hashlib.sha256((base/'current'/name).read_bytes()).hexdigest()==digest, name
opener=urllib.request.build_opener(urllib.request.ProxyHandler({{}}))
assert opener.open('http://127.0.0.1:8879/',timeout=10).status==200
print('SOURCE 200 / all hashes match')
"""
subprocess.run(["ssh", "boh", "python3", "-"], input=source_check, text=True, check=True)
# Fetch every published resource straight from the public origin and compare digests.
# The browser route this used to take needed a tool that is not always installed, and it ran
# after `current` had already been switched, so a missing tool left the site updated but the
# release records unwritten. A direct fetch checks the same thing with no extra dependency.
public = urllib.request.build_opener(urllib.request.ProxyHandler({}))
# Cloudflare answers the default Python-urllib agent with 403, so present a normal browser one.
public.addheaders = [
    (
        "User-Agent",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    ),
    ("Accept", "*/*"),
    ("Cache-Control", "no-cache"),
]
rows = []
for name, digest in hashes.items():
    url = "https://chess.jyork.de/" + name
    row = {"name": name, "status": None, "match": False, "normalization": None}
    for _ in range(4):
        try:
            with public.open(url, timeout=30) as response:
                row["status"] = response.status
                body = response.read()
        except Exception as error:  # noqa: BLE001 - reported below, then retried
            row["error"] = str(error)[:200]
            time.sleep(2)
            continue
        actual = hashlib.sha256(body).hexdigest()
        if actual != digest and name == "index.html":
            # Cloudflare injects its analytics beacon into HTML on some routes.
            stripped = re.sub(
                rb'<script[^>]*src="https://static\.cloudflareinsights\.com/beacon\.min\.js[^" ]*"[^>]*></script>\n?',
                b"",
                body,
            )
            if hashlib.sha256(stripped).hexdigest() == digest:
                actual, row["normalization"] = digest, "Cloudflare analytics script only"
        row["match"] = actual == digest
        if not row["match"]:
            row["expected"], row["actual"], row["bytes"] = digest, actual, len(body)
        if row["match"]:
            break
        time.sleep(2)
    rows.append(row)
print(json.dumps(rows, ensure_ascii=False), flush=True)
assert all(row["status"] == 200 and row["match"] for row in rows), "Public verification failed"

record = {"release": release, "previous": args.expected, "note": args.note, "hashes": hashes}
(ROOT / ".last-release.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
with (ROOT / "RELEASES.md").open("a") as log:
    log.write(f"\n- `{release}` — {args.note}。规则检查通过，{len(files)} 个公网资源已加载并核对 SHA-256（首页排除 Cloudflare 自动统计脚本）；回退 `{args.expected}`。\n")
deployment = ROOT / "DEPLOYMENT.md"
text = deployment.read_text()
text = re.sub(r"当前版本：`[^`]+`", "当前版本：`/personal/tundra-chess/releases/" + release + "`", text)
text = re.sub(r"保留回退版本：`[^`]+`", "保留回退版本：`/personal/tundra-chess/releases/" + args.expected + "`", text)
deployment.write_text(text)
print("PUBLISHED " + release, flush=True)
