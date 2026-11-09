"""Create an archive from tracked, reviewed source plus the fresh static build."""
from pathlib import Path
import subprocess, zipfile, hashlib, json
root=Path(__file__).resolve().parent.parent
version=json.loads((root/'package.json').read_text())['version']
release=root/'release';release.mkdir(exist_ok=True)
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
files=[root/p for p in tracked if p]
files+=list((root/'dist/client').rglob('*'))
files=[p for p in files if p.is_file()]
if not (root/'dist/client/index.html').is_file(): raise SystemExit('Run npm run build first')
archive=release/f'iiteg-workspace-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(set(files)):
        rel=p.relative_to(root)
        if p.name=='.env' or ('storage' in rel.parts and p.name!='.htaccess'): raise SystemExit(f'Private artifact refused: {rel}')
        z.write(p,Path(f'iiteg-workspace-{version}')/rel)
(release/'SHA256SUMS').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(f'Packaged {len(files)} files into {archive.name}')
