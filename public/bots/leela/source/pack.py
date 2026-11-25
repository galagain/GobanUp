"""Pack Leela Zero text tensors as little-endian float32 for the browser loader."""
import array
import gzip
import struct
import sys

with gzip.open(sys.argv[1], 'rb') as source, gzip.GzipFile(sys.argv[2], 'wb', mtime=0) as target:
    version = int(source.readline())
    if version != 2:
        raise ValueError('Expected ELF v1, black value head')
    target.write(struct.pack('<III', version, 224, 20))
    count = 0
    for line in source:
        values = array.array('f', map(float, line.split()))
        if count == 1 and len(values) != 224:
            raise ValueError('Unexpected width')
        if sys.byteorder != 'little':
            values.byteswap()
        target.write(struct.pack('<I', len(values)))
        target.write(values)
        count += 1
    if count != 4 + 8 * 20 + 14:
        raise ValueError('Unexpected tensor count')
