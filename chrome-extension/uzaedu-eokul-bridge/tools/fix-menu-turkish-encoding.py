#!/usr/bin/env python3
"""Geriye dönük: tools/fix-turkish-encoding.py kullanın."""
import runpy
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("fix-turkish-encoding.py")), run_name="__main__")
