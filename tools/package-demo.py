"""Create reviewable local delivery archives without deleting workspace files."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'deliverables' / '2026-10-11'
TITLE = '装机创业记'
IGNORED_DIRS = {'.git', 'node_modules', '__pycache__'}
IGNORED_NAMES = {'project.private.config.json', '.DS_Store', 'Thumbs.db'}
SECRET = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}|AKIA[A-Z0-9]{16}')


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def tree(source: Path):
    # Resolve only named project directories; never follow links into another checkout.
    if not source.exists():
        raise FileNotFoundError(source.relative_to(ROOT))
    for file in sorted(source.rglob('*')):
        relative = file.relative_to(source)
        if file.is_symlink():
            raise ValueError(f'Symlink needs explicit review: {file.relative_to(ROOT)}')
        if (not file.is_file() or any(p in IGNORED_DIRS for p in relative.parts)
                or file.name in IGNORED_NAMES or file.name.startswith('.env')
                or file.suffix.lower() in {'.pem', '.key', '.p12', '.pfx', '.pyc'}):
            continue
        yield file, relative.as_posix()


def digest(source: Path):
    # Match the historical verifier's path + individual-file digest algorithm.
    files = [(f, p) for f, p in tree(source) if f.name != 'project.config.json']
    h = hashlib.sha256()
    for file, relative in files:
        h.update((relative + '\0' + sha(file.read_bytes()) + '\n').encode())
    return {'sha256': h.hexdigest(), 'files': len(files),
            'bytes': sum(f.stat().st_size for f, _ in files)}


class Bundle:
    def __init__(self, name: str):
        self.name = name
        self.entries: dict[str, bytes | Path] = {}

    def add(self, name: str, data: bytes | Path):
        name = name.replace('\\', '/')
        if name.startswith('/') or '..' in Path(name).parts or name in self.entries:
            raise ValueError(f'Invalid or duplicate archive path: {name}')
        self.entries[name] = data

    def directory(self, source: str, destination: str, config_title: bool = False):
        for file, relative in tree(ROOT / source):
            if file.name == 'project.config.json':
                # Distribute a portable project, keeping the working account configuration local.
                config = read_json(file)
                config['appid'] = ''
                if config_title:
                    config['projectname'] = TITLE
                self.add(destination + '/' + relative, json_bytes(config))
            else:
                self.add(destination + '/' + relative, file)

    def write(self):
        target = OUT / self.name
        records = []
        with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=6) as archive:
            for name, source in sorted(self.entries.items()):
                data = source.read_bytes() if isinstance(source, Path) else source
                if SECRET.search(data):
                    raise ValueError(f'Credential pattern in {name}; archive not approved')
                records.append({'path': name, 'bytes': len(data), 'sha256': sha(data)})
                archive.writestr(name, data)
            manifest = {'gameTitle': TITLE, 'files': records,
                        'accountSettings': 'excluded; distributed WeChat AppID is blank'}
            archive.writestr('manifest.json', json_bytes(manifest))
        # Read every compressed entry and compare its SHA-256 to the original payload.
        with ZipFile(target) as archive:
            if archive.testzip() is not None:
                raise ValueError(f'ZIP CRC check failed: {target.name}')
            names = archive.namelist()
            assert len(names) == len(set(names)) == len(records) + 1
            for record in records:
                assert sha(archive.read(record['path'])) == record['sha256'], record['path']
            for name in names:
                assert not any(p in IGNORED_DIRS for p in Path(name).parts), name
                assert Path(name).name not in IGNORED_NAMES, name
                if name.endswith('/project.config.json'):
                    assert json.loads(archive.read(name))['appid'] == '', name
        return {'name': self.name, 'files': len(records) + 1,
                'payloadBytes': sum(r['bytes'] for r in records),
                'archiveBytes': target.stat().st_size,
                'sha256': sha(target.read_bytes()), 'roundTripVerified': True}


def main():
    # This dated archival delivery is immutable; a later release needs a new output folder.
    if OUT.exists() and any(OUT.glob('*.zip')):
        raise SystemExit('Existing archival ZIPs are immutable. Choose a new output folder for a later release and restore the required historical inputs.')
    OUT.mkdir(parents=True, exist_ok=True)
    previous = read_json(ROOT / '.local/package/previous-verification.json')
    historical = ROOT / '.local/package/previous-builds'
    # Historical UI evidence must remain attached to the exact original build.
    for platform, key in [('web-desktop', 'web'), ('wechatgame', 'wechat')]:
        assert digest(historical / platform)['sha256'] == previous['builds'][key]['sha256']

    instructions = (ROOT / 'docs/release-packaging.md').read_bytes()
    demo = Bundle(TITLE + '-试玩包.zip')
    demo.directory('build/web-desktop', 'web-desktop')
    demo.directory('build/wechatgame', 'wechatgame', config_title=True)
    demo.add('试玩说明.md', instructions)
    demo.add('preview.cjs', (ROOT / 'tools/preview.cjs').read_bytes()
             .replace(b"path.resolve(__dirname,'../build/web-desktop')", b"path.resolve(__dirname,'web-desktop')"))
    launcher = ('@echo off\r\nrem Start the local game server and browser on the selected port.\r\n'
                'cd /d "%~dp0"\r\nset "DEMO_PORT=%~1"\r\n'
                'if not defined DEMO_PORT set "DEMO_PORT=7456"\r\n'
                'where node >nul 2>nul\r\nif errorlevel 1 (\r\n'
                '  echo Install Node.js before opening this demo.\r\n  pause\r\n  exit /b 1\r\n)\r\n'
                'node preview.cjs %DEMO_PORT% --open\r\npause\r\n')
    demo.add('启动浏览器试玩.cmd', launcher.encode('ascii'))

    source = Bundle(TITLE + '-项目素材包.zip')
    for directory in ['assets', 'design', 'docs', 'settings', 'build-templates', 'tools', 'tests', 'ui-demos']:
        source.directory(directory, directory)
    for directory in ['source', 'prompts', 'exports', 'figma', 'reference']:
        source.directory('art/' + directory, 'art/' + directory)
    for file in ['AGENTS.md', 'README.md', 'package.json', 'package-lock.json',
                 'tsconfig.json', 'tsconfig.tests.json', '.gitignore', '.gitattributes', 'art/production-plan.json']:
        source.add(file, ROOT / file)
    source.directory('.local/figma-import', 'archive/figma-import')

    evidence = Bundle(TITLE + '-验收资料包.zip')
    for directory in ['v3', 'rules', 'v2']:
        evidence.directory('.local/playtests/' + directory, 'evidence/playtests/' + directory)
    evidence.add('evidence/playtests/browser-scale-exploration.json', ROOT / '.local/playtests/browser-scale-exploration.json')
    evidence.directory('art/preview', 'art/preview')
    for directory in ['web-desktop', 'wechatgame']:
        evidence.directory('.local/package/previous-builds/' + directory, 'historical-builds/' + directory)
    evidence.directory('build/art-import-check', 'historical-builds/art-import-check')
    for file in ['six-month-verification.json', 'six-month-demo.md', 'demo-verification.json',
                 'demo-playtest.md', 'wechat-simulator-test.md', 'release-packaging.md', 'cleanup-list.md']:
        evidence.add('docs/' + file, ROOT / 'docs' / file)
    for file in ['name-smoke.json', 'current-checks.json', 'tests.log', 'cleanup-inventory.json']:
        evidence.add('evidence/' + file, ROOT / '.local/package' / file)
    for file in ['design-verification.json', 'ui-art-verification.json', 'package-measurement.json']:
        if (ROOT / '.local' / file).exists():
            evidence.add('evidence/' + file, ROOT / '.local' / file)
    evidence.add('试玩说明.md', instructions)

    bundles = [bundle.write() for bundle in [demo, source, evidence]]
    manifest = {'gameTitle': TITLE, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'creatorVersion': read_json(ROOT / 'package.json')['creator']['version'],
                'builds': {key: digest(ROOT / 'build' / platform)
                           for key, platform in [('web', 'web-desktop'), ('wechat', 'wechatgame')]},
                'sixMonthEvidenceBuilds': previous['builds'],
                'currentCheck': read_json(ROOT / '.local/package/current-checks.json'),
                'nameSmoke': read_json(ROOT / '.local/package/name-smoke.json'),
                'packages': bundles, 'deletedFiles': 0}
    (OUT / 'package-manifest.json').write_bytes(json_bytes(manifest))
    rows = '\n'.join(f"| {b['name']} | {b['archiveBytes'] / 1024**2:.2f} | {b['files']} |" for b in bundles)
    sums = '\n\n'.join(f"{b['name']}\n\n`{b['sha256']}`" for b in bundles)
    index = f'''# 装机创业记 交付目录

## 1 文件入口

依据本轮打包记录，压缩包均已逐项解压读取并核对文件摘要；文件目录包含各包自身的清单

体积来自压缩文件实际字节数，按每 MiB 等于 1,048,576 字节换算

<div align="center">

表 1.1 交付压缩包

| 文件 | 体积 MiB | 文件数量 |
| --- | ---: | ---: |
{rows}

</div>

## 2 文件校验

SHA-256 是文件内容校验摘要，以下值来自本轮生成的压缩文件，可用于核对传输或复制是否完整

{sums}

## 3 使用说明

解压试玩包，双击启动入口打开浏览器版；微信开发者工具导入 `wechatgame` 目录后填写自己的小游戏 AppID

项目素材包保留原图、提示词、Figma 切图和资源唯一标识，包含 `archive/figma-import` 下的旧导入中间文件

详细步骤见工程的 `docs/release-packaging.md`，可以清理的原文件见 `docs/cleanup-list.md`

六个月界面试玩证据绑定原构建；本次更名构建只新增首页显示及旧存档兼容检查

微信模拟器完整验收、真机验收和真人体验时长仍待验证，本轮没有删除工程文件
'''
    (OUT / '交付目录.md').write_text(index, encoding='utf-8')
    print(json.dumps({'packages': bundles, 'deletedFiles': 0}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
