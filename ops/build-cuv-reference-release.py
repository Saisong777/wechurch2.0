"""Build an additive, pinned reference release without modifying the source package."""
import hashlib
import html
import json
import pathlib
import re
import shutil
import sqlite3
import sys
import xml.etree.ElementTree as ET
import zipfile

RELEASE = "public-20260926-v2"
SOURCE = "cmn-cu89t"
NAME = "新標點和合本（繁體）"
ZIP_HASH = "49aca5dffaeeb27c24f05ec30a7e64080f36c0e132095b83f2773b2c9b4455b7"
BASE_HASH = "595e942f856a8fd5aa536606c059afcb73a8292bcdd37a454476f038a54e365c"
BOOKS = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split()


def digest(file):
    with open(file, "rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def build(base, archive, output):
    if output.exists():
        raise ValueError("Destination must be new; existing reference packages are never overwritten")
    if digest(base / "data/core.sqlite") != BASE_HASH or digest(archive) != ZIP_HASH:
        raise ValueError("Pinned source hash mismatch")
    files = []
    for line in (base / "SHA256SUMS").read_text().splitlines():
        checksum, relative = line.split("  ", 1)
        p = pathlib.PurePosixPath(relative)
        if p.is_absolute() or ".." in p.parts:
            raise ValueError("Unsafe asset path")
        if relative.startswith(("data/", "licenses/")) or relative in ("NOTICE.md", "web/licenses.html", "web/style.css", "VALIDATION.json"):
            source = base / relative
            if source.is_symlink() or digest(source) != checksum:
                raise ValueError("Base asset mismatch")
            files.append(relative)
    with zipfile.ZipFile(archive) as z:
        about = z.read("cmn-cu89t_about.htm")
        if b"Public Domain" not in about:
            raise ValueError("Source archive declaration missing")
        root = ET.fromstring(z.read("cmn-cu89t_vpl.xml"))
    verses, covered, chapters = [], set(), set()
    for element in root:
        if element.tag != "v" or list(element):
            raise ValueError("Unexpected source structure")
        book = BOOKS.index(element.attrib["b"]) + 1
        chapter = int(element.attrib["c"])
        match = re.fullmatch(r"([0-9]+)(?:-([0-9]+))?", element.attrib["v"])
        if not match:
            raise ValueError("Unexpected verse reference")
        lo, hi = int(match[1]), int(match[2] or match[1])
        body = (element.text or "").strip()
        if not (1 <= chapter <= 150 and 1 <= lo <= hi <= 176 and body):
            raise ValueError("Invalid verse")
        base_ref = book * 1000000 + chapter * 1000
        for verse in range(lo, hi + 1):
            ref = base_ref + verse
            if ref in covered:
                raise ValueError("Duplicate verse")
            covered.add(ref)
        chapters.add((book, chapter))
        verses.append((element.attrib["b"], chapter, lo, hi, body, base_ref))
    if len(verses) != 31021 or len(chapters) != 1189 or len({b for b, _ in chapters}) != 66:
        raise ValueError("Incomplete pinned Bible")
    output.mkdir(parents=True)
    for relative in files:
        dest = output / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(base / relative, dest)
    metadata = {
        "attribution": "新標點和合本 / Chinese Union Version (traditional). Electronic source: eBible.org; source declares Public Domain.",
        "license_url": "https://ebible.org/cmn-cu89t/copyright.htm",
        "source_url": "https://ebible.org/details.php?id=cmn-cu89t",
        "version": "cmn-cu89t; archive generated 2026-08-08; source page dates files 2025-12-12",
        "download_url": "https://ebible.org/Scriptures/cmn-cu89t_vpl.zip",
        "download_sha256": ZIP_HASH,
        "changes": "從上游 XML 轉為經節與搜尋索引，僅去除行首尾空白；保留上帝用語、標點與合節，不由模型改寫正文。不是先前排除的 cuv1919 電子轉錄。",
        "corpus_family": "cuv", "imported_at": "2026-09-26",
    }
    with sqlite3.connect(output / "data/core.sqlite") as db:
        db.execute("INSERT INTO sources VALUES(?,?,?,?,?)", (SOURCE, NAME, "zht", "Public-Domain", json.dumps(metadata, ensure_ascii=False)))
        for code, chapter, lo, hi, body, base_ref in verses:
            title = f"{code} {chapter}:{lo}" + (f"-{hi}" if lo != hi else "")
            row = db.execute("INSERT INTO entries VALUES(?,?,?,?,?,?,?)", (
                f"open:{SOURCE}:{title}", SOURCE, title, body,
                f"https://ebible.org/{SOURCE}/{code}{chapter:02d}.htm",
                hashlib.sha256(body.encode()).hexdigest(), "{}"))
            db.execute("INSERT INTO passages VALUES(?,?,?)", (row.lastrowid, base_ref + lo, base_ref + hi))
            db.execute("INSERT INTO search_index(rowid,title,body) VALUES(?,?,?)", (row.lastrowid, title, body))
        db.commit()
        db.execute("ATTACH DATABASE ? AS original", (str(base / "data/core.sqlite"),))
        for table in ("sources", "entries", "passages", "terms", "xrefs", "settings"):
            if db.execute(f"SELECT count(*) FROM (SELECT * FROM original.{table} EXCEPT SELECT * FROM main.{table})").fetchone()[0]:
                raise ValueError(f"Original {table} changed")
        if db.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise ValueError("SQLite integrity failed")
        total = db.execute("SELECT count(*) FROM entries").fetchone()[0]
    shutil.copyfile(archive, output / "data/cmn-cu89t-source.zip")
    (output / "licenses/cmn-cu89t-about.html").write_bytes(about)
    notice = f"\n\n## WeChurch {RELEASE} 增補\n\n新增 {NAME}，直接取自 eBible.org 明列 Public Domain 的 cmn-cu89t 下載包。\n{metadata['changes']}\n來源與授權：{metadata['license_url']}\n\n原 v1 資料與授權保留，不重新加入未核定 cuv1919 或私人服務資料。\n"
    with (output / "NOTICE.md").open("a") as stream:
        stream.write(notice)
    credits = (output / "web/licenses.html").read_text()
    addition = f'<section><h2>{NAME}</h2><p>Public Domain（依 eBible.org 此資料包聲明）</p><p>{html.escape(metadata["attribution"])}</p><p><a href="{metadata["license_url"]}">來源授權聲明</a> · <a href="{metadata["download_url"]}">原始電子檔</a></p><p>{html.escape(metadata["changes"])}</p><p>{html.escape(metadata["version"])}</p></section>'
    (output / "web/licenses.html").write_text(credits.replace("</main>", addition + "</main>"))
    release = json.loads((output / "data/release.json").read_text())
    release.update(release_id=RELEASE, built_at="2026-09-26", database_sha256=digest(output / "data/core.sqlite"), based_on="public-20260925-v1")
    release["counts"][SOURCE] = len(verses)
    release["sources"].append(dict(id=SOURCE, name=NAME, language="zht", license="Public-Domain", metadata=metadata))
    (output / "data/release.json").write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n")
    validation = dict(release_id=RELEASE, source_count=13, entry_count=total, added_passages=len(verses), covered_verses=len(covered), chapters=1189, original_tables_preserved=True, database_sha256=release["database_sha256"], limits=["Publisher public-domain declaration, not a universal legal warranty", "Physical device testing not implied", "Greek word-to-Chinese alignment unchanged"])
    (output / "VALIDATION.json").write_text(json.dumps(validation, indent=2) + "\n")
    inventory = sorted(p for p in output.rglob("*") if p.is_file())
    (output / "SHA256SUMS").write_text("".join(f"{digest(p)}  {p.relative_to(output).as_posix()}\n" for p in inventory))
    print(json.dumps(dict(**validation, inventory_sha256=digest(output / "SHA256SUMS"))))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: python3 ops/build-cuv-reference-release.py BASE_PACKAGE CUV_ZIP NEW_OUTPUT")
    build(*(pathlib.Path(p).resolve() for p in sys.argv[1:]))
