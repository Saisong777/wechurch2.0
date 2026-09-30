"""Extract only bounded regular files/directories into a NEW private restore directory."""
import pathlib
import shutil
import sys
import tarfile

archive, destination = map(pathlib.Path, sys.argv[1:])
if destination.exists():
    raise ValueError('Restore destination must be new')
with tarfile.open(archive, 'r:gz') as tf:
    members, seen, total = tf.getmembers(), set(), 0
    for item in members:
        path = pathlib.PurePosixPath(item.name)
        if path.is_absolute() or '..' in path.parts or not (item.isdir() or item.isfile()) or path in seen:
            raise ValueError('Unsafe restore archive')
        seen.add(path); total += item.size
        if total > 2 * 1024**3:
            raise ValueError('Restore size limit exceeded')
    destination.mkdir(mode=0o700)
    # Avoid tar metadata/links and work on Python versions without extraction filters.
    for item in members:
        target = destination / pathlib.PurePosixPath(item.name)
        if item.isdir():
            target.mkdir(mode=0o700, parents=True, exist_ok=True)
        else:
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            with tf.extractfile(item) as source, target.open('xb') as output:
                target.chmod(0o600)
                shutil.copyfileobj(source, output)
