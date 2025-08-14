from pathlib import Path
from typing import Dict, List
import os

DATA_DIR      = Path("static/data/split_parquet").resolve()
WEIGHTED_DIR  = Path("static/data/weighted_parquet/custom").resolve()
ALLOWED_TYPES = {".parquet", ".json", ".geojson"}

# ---------- low-level scans ---------- #
def list_states() -> List[str]:
    return sorted(p.name for p in DATA_DIR.iterdir() if p.is_dir())

def list_counties(state: str) -> List[str]:
    base = DATA_DIR / state
    return sorted(p.name for p in base.iterdir()
                  if p.is_dir() and p.name != "stateWideFiles")

def list_categories(state: str, county: str = "") -> List[str]:
    base = (DATA_DIR / state / county) if county else (DATA_DIR / state / "stateWideFiles")
    skip = "countyWideFiles" if county else None
    if not base.is_dir():
        return []
    return sorted(p.name for p in base.iterdir()
                  if p.is_dir() and p.name != skip)

def list_datasets(state: str, county: str = "", category: str = "") -> List[str]:
    parts = [state]
    if county:
        parts.append(county)
    elif not category:
        parts.append("stateWideFiles")
    if category:
        parts.append(category)
    base = DATA_DIR.joinpath(*parts)
    if not base.is_dir():
        return []
    return sorted(f.stem for f in base.glob("*.*") if f.suffix.lower() in ALLOWED_TYPES)

def list_weighted_datasets() -> List[str]:
    if not WEIGHTED_DIR.exists():
        return []
    return sorted(f.stem for f in WEIGHTED_DIR.glob("*.*") if f.suffix.lower() in ALLOWED_TYPES)

# ---------- one-shot aggregator ---------- #
def compute_available_options(filters: Dict) -> Dict:
    """
    Server-side mirror of the old JS cascade.
    filters = { mode, state, county, category }
    """
    mode     = filters.get("mode", "regular")
    state    = filters.get("state", "")
    county   = filters.get("county", "")
    category = filters.get("category", "")

    if mode == "weighted":
        return {
            "states": [], "counties": [], "categories": [],
            "datasets": list_weighted_datasets()
        }

    return {
        "states":     list_states(),
        "counties":   list_counties(state)               if state else [],
        "categories": list_categories(state, county)     if state else [],
        "datasets":   list_datasets(state, county, category) if state else [],
    }
