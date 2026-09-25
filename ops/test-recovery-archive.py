import io
import pathlib
import subprocess
import tarfile
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('extract-recovery-archive.py')

class RecoveryArchiveTests(unittest.TestCase):
    def run_archive(self, members, existing=False):
        with tempfile.TemporaryDirectory() as tmp:
            base = pathlib.Path(tmp)
            archive, dest = base / 'test.tgz', base / 'restore'
            with tarfile.open(archive, 'w:gz') as tf:
                for name, kind in members:
                    item = tarfile.TarInfo(name)
                    if kind == 'link':
                        item.type = tarfile.SYMTYPE
                        item.linkname = '/tmp'
                        tf.addfile(item)
                    else:
                        item.size = 4
                        tf.addfile(item, io.BytesIO(b'test'))
            if existing: dest.mkdir()
            result = subprocess.run(['python3', str(SCRIPT), str(archive), str(dest)], capture_output=True)
            if result.returncode == 0:
                self.assertEqual((dest / 'safe/file.txt').read_bytes(), b'test')
            return result.returncode

    def test_regular_file(self):
        self.assertEqual(self.run_archive([('safe/file.txt', 'file')]), 0)

    def test_rejects_traversal_absolute_links_duplicates_and_overwrite(self):
        for members in [[('../outside', 'file')], [('/absolute', 'file')], [('symlink', 'link')], [('same','file'),('same','file')], [('safe/file.txt','file'),('./safe/file.txt','file')]]:
            with self.subTest(members=members): self.assertNotEqual(self.run_archive(members), 0)
        self.assertNotEqual(self.run_archive([('safe/file.txt','file')], existing=True), 0)

if __name__ == '__main__': unittest.main()
