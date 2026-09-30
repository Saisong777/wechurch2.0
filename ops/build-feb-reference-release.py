"""Add the pinned, attributed FEB New Testament; preserve all v2 reference data."""
import hashlib
import html
import importlib.util
import json
import pathlib
import re
import shutil
import sqlite3
import sys
import xml.etree.ElementTree as ET
import zipfile

spec = importlib.util.spec_from_file_location("cuv_builder", pathlib.Path(__file__).with_name("build-cuv-reference-release.py"))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
digest, BOOKS = helpers.digest, helpers.BOOKS
SOURCE, RELEASE = "cmnfeb", "public-20260926-v3"
NAME = "免費易讀聖經（簡體・新約）"
ZIP_HASH = "0d241664fdfdbbbd12c61f7b6df876d5b0bba3f6f558d2b31d0d3d823bb0a510"
BASE_HASH = "eade3bb78bae619e8e14f8d89cd045f935e569e85add871b01b4b72ecf436f92"

def build(base, archive, output):
    if output.exists() or digest(base / "data/core.sqlite") != BASE_HASH or digest(archive) != ZIP_HASH:
        raise ValueError("New destination and pinned v2/source required")
    with zipfile.ZipFile(archive) as z:
        about = z.read("cmnfeb_about.htm")
        if b"creativecommons.org/licenses/by-sa/4.0" not in about or b"2022" not in about:
            raise ValueError("Missing original license")
        root = ET.fromstring(z.read("cmnfeb_vpl.xml"))
    verses, seen, chapters, empty = [], set(), set(), []
    for v in root:
        if v.tag != "v" or list(v) or not re.fullmatch(r"[0-9]+", v.attrib["v"]):
            raise ValueError("Unexpected source structure")
        book, chapter, verse = BOOKS.index(v.attrib["b"]) + 1, int(v.attrib["c"]), int(v.attrib["v"])
        body = (v.text or "").strip()
        ref = book * 1000000 + chapter * 1000 + verse
        if not (40 <= book <= 66 and 1 <= chapter <= 28 and 1 <= verse <= 80) or ref in seen:
            raise ValueError("Invalid or duplicate verse")
        seen.add(ref); chapters.add((book, chapter))
        if not body:
            empty.append(ref)
            continue
        verses.append((v.attrib["b"], chapter, verse, ref, body))
    if len(verses) != 7942 or len(empty) != 17 or len(chapters) != 260 or len({b for b, _ in chapters}) != 27:
        raise ValueError("Incomplete pinned New Testament")
    output.mkdir(parents=True)
    for line in (base / "SHA256SUMS").read_text().splitlines():
        checksum, relative = line.split("  ", 1)
        p = pathlib.PurePosixPath(relative)
        if p.is_absolute() or ".." in p.parts or (base / relative).is_symlink() or digest(base / relative) != checksum:
            raise ValueError("Invalid base inventory")
        dest = output / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(base / relative, dest)
    metadata = {
        "attribution": "Free Easy-to-read Bible. Copyright © 2022 Free Bible Ministry, Inc. Developed from the Free Bible Version. Source: eBible.org.",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "credit_url": "https://ebible.org/cmnfeb/copyright.htm",
        "source": "https://ebible.org/details.php?id=cmnfeb",
        "revision": "cmnfeb; source dated 2025-05-01; archive generated 2026-08-08",
        "download_url": "https://ebible.org/Scriptures/cmnfeb_vpl.zip", "download_sha256": ZIP_HASH,
        "changes": "由上游 XML 建立經節及搜尋索引，僅移除首尾空白；保留簡體原文，未轉繁體或改寫。此資料及轉換貢獻依 CC BY-SA 4.0 提供，不代表原權利人背書。",
        "quality_note": "上游電子包僅含新約 27 卷、260 章；17 處經節正文為空，依來源保留缺節，不自行補寫。授權核對不等於教會已完成譯文審核。",
        "empty_source_references": empty,
        "corpus_family": "free-bible-version", "imported_at": "2026-09-26", "first_book": 40,
    }
    with sqlite3.connect(output / "data/core.sqlite") as db:
        db.execute("INSERT INTO sources VALUES(?,?,?,?,?)", (SOURCE, NAME, "zhs", "CC-BY-SA-4.0", json.dumps(metadata, ensure_ascii=False)))
        for code, chapter, verse, ref, body in verses:
            title = f"{code} {chapter}:{verse}"
            row = db.execute("INSERT INTO entries VALUES(?,?,?,?,?,?,?)", (f"open:{SOURCE}:{title}", SOURCE, title, body, f"https://ebible.org/{SOURCE}/{code}{chapter:02d}.htm", hashlib.sha256(body.encode()).hexdigest(), "{}"))
            db.execute("INSERT INTO passages VALUES(?,?,?)", (row.lastrowid, ref, ref))
            db.execute("INSERT INTO search_index(rowid,title,body) VALUES(?,?,?)", (row.lastrowid, title, body))
        db.commit()
        db.execute("ATTACH DATABASE ? AS original", (str(base / "data/core.sqlite"),))
        for table in ("sources", "entries", "passages", "terms", "xrefs", "settings"):
            if db.execute(f"SELECT count(*) FROM (SELECT * FROM original.{table} EXCEPT SELECT * FROM main.{table})").fetchone()[0]:
                raise ValueError("Original reference data changed")
        if db.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise ValueError("SQLite integrity failed")
    shutil.copyfile(archive, output / "data/cmnfeb-source.zip")
    (output / "licenses/cmnfeb-about.html").write_bytes(about)
    notice = f"\n\n## WeChurch {RELEASE}\n\n{NAME}\n\n{metadata['attribution']}\n\n{metadata['credit_url']}\n\n{metadata['license_url']}\n\n{metadata['changes']}\n\n{metadata['quality_note']}\n"
    with (output / "NOTICE.md").open("a") as stream: stream.write(notice)
    credits = (output / "web/licenses.html").read_text()
    addition = f'<section><h2>{NAME}</h2><p>{html.escape(metadata["attribution"])}</p><p><a href="{metadata["license_url"]}">CC BY-SA 4.0</a> · <a href="{metadata["credit_url"]}">原始授權聲明</a> · <a href="{metadata["download_url"]}">原始資料</a></p><p>{html.escape(metadata["changes"])}</p><p>{html.escape(metadata["quality_note"])}</p></section>'
    (output / "web/licenses.html").write_text(credits.replace("</main>", addition + "</main>"))
    release = json.loads((output / "data/release.json").read_text())
    release.update(release_id=RELEASE, database_sha256=digest(output / "data/core.sqlite"), based_on="public-20260926-v2")
    release["counts"][SOURCE] = len(verses)
    release["sources"].append(dict(id=SOURCE, name=NAME, language="zhs", license="CC-BY-SA-4.0", metadata=metadata))
    (output / "data/release.json").write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n")
    validation = dict(release_id=RELEASE, source_count=14, added_passages=7942, empty_source_references=empty, added_books=27, added_chapters=260, original_tables_preserved=True, database_sha256=release["database_sha256"], physical_phone_acceptance=False)
    (output / "VALIDATION.json").write_text(json.dumps(validation, indent=2) + "\n")
    files = sorted(p for p in output.rglob("*") if p.is_file() and p.name != "SHA256SUMS")
    (output / "SHA256SUMS").write_text("".join(f"{digest(p)}  {p.relative_to(output).as_posix()}\n" for p in files))
    print(json.dumps(dict(**validation, inventory_sha256=digest(output / "SHA256SUMS"))))

if __name__ == "__main__":
    if len(sys.argv) != 4: raise SystemExit("Usage: build-feb-reference-release.py BASE_V2 FEB_ZIP NEW_OUTPUT")
    build(*(pathlib.Path(p).resolve() for p in sys.argv[1:]))
