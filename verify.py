from hashlib import sha256
from pathlib import Path
import sys
for path in sys.argv[1:]: print(f"{path}: sha256={sha256(Path(path).read_bytes()).hexdigest()}")
