# helpers_options.py  (new file - import where you need it)
from pathlib import Path
from typing import Dict, List
import os

# Use the same DATA_DIR your existing /list_* routes rely on
DATA_DIR = Path(os.environ.get("DATA_DIR", "data/regular")).resolve()
WEIGHTED_DIR = Path(os.environ.get("WEIGHTED_DIR", "data/weighted")).resolve()

def _list_states() -> List[str]:
    return sorted([p.name for p in DATA_DIR.iterdir() if p.is_dir()])

def _list_counties(state: str) -> List[str]:
    base = DATA_DIR / state
    return sorted([p.name for p in base.iterdir()
                   if p.is_dir() and p.name != "stateWideFiles"])

def _list_categories(state: str, county: str = "") -> List[str]:
    if county:
        base = DATA_DIR / state / county
        skip = "countyWideFiles"
    else:
        base = DATA_DIR / state / "stateWideFiles"
        skip = None
    if not base.is_dir():
        return []
    return sorted([p.name for p in base.iterdir()
                   if p.is_dir() and (skip is None or p.name != skip)])

def _list_datasets(state: str, county: str = "", category: str = "") -> List[str]:
    # Walk down the directory tree that matches the current filter
    parts = [state]
    if county:
        parts.append(county)
    elif not county and not category:
        parts.append("stateWideFiles")
    if category:
        parts.append(category)
    base = DATA_DIR.joinpath(*parts)
    if not base.is_dir():
        return []
    # collect *.* data files (parquet / geojson / json …)
    files = [f.stem for f in base.glob("*.*") if f.suffix.lower() in {".parquet", ".json", ".geojson"}]
    return sorted(files)

def _list_weighted_datasets() -> List[str]:
    if not WEIGHTED_DIR.exists():
        return []
    return sorted([f.stem for f in WEIGHTED_DIR.glob("*.*")
                   if f.suffix.lower() in {".parquet", ".json", ".geojson"}])

def compute_available_options(filters: Dict) -> Dict:
    """
    Replicates the incremental dropdown behaviour of the old JS.
    Parameters
    ----------
    filters : dict   # what the browser currently has selected
        {
          "mode": "regular" | "weighted",
          "state":   "",        # "" means 'nothing selected yet'
          "county":  "",
          "category":""
        }
    Returns
    -------
    {
      "states":     [...],
      "counties":   [...],
      "categories": [...],
      "datasets":   [...]
    }
    """
    mode      = filters.get("mode", "regular")
    state     = filters.get("state", "")
    county    = filters.get("county", "")
    category  = filters.get("category", "")

    if mode == "weighted":
        return {
            "states":     [],          # not used in weighted UI
            "counties":   [],
            "categories": [],
            "datasets":   _list_weighted_datasets()
        }

    states     = _list_states()
    counties   = _list_counties(state)          if state else []
    categories = _list_categories(state, county)if state else []
    datasets   = _list_datasets(state, county, category) if state else []

    return {
        "states":     states,
        "counties":   counties,
        "categories": categories,
        "datasets":   datasets
    }
