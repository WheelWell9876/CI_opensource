# geo_open_source/webapp/options_catalog.py
from pathlib import Path
from typing import Dict, List
import os
import logging

logger = logging.getLogger(__name__)

# mirrors your existing DATA dirs; feel free to tweak to your actual absolute paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "static" / "data" / "split_parquet")).resolve()
WEIGHTED_DIR = Path(
    os.environ.get("WEIGHTED_DIR", BASE_DIR / "static" / "data" / "weighted_parquet" / "custom")).resolve()


def _list_states() -> List[str]:
    """List all available states."""
    if not DATA_DIR.exists():
        logger.warning(f"DATA_DIR does not exist: {DATA_DIR}")
        return []

    states = []
    for p in DATA_DIR.iterdir():
        if p.is_dir():
            states.append(p.name)

    logger.debug(f"Found {len(states)} states: {states}")
    return sorted(states)


def _list_counties(state: str) -> List[str]:
    """List counties for a given state."""
    if not state:
        return []

    base = DATA_DIR / state
    if not base.is_dir():
        logger.warning(f"State directory does not exist: {base}")
        return []

    counties = []
    for p in base.iterdir():
        if p.is_dir() and p.name != "stateWideFiles":
            counties.append(p.name)

    logger.debug(f"Found {len(counties)} counties for {state}: {counties}")
    return sorted(counties)


def _list_categories(state: str, county: str = "") -> List[str]:
    """List categories for a given state and optional county."""
    if not state:
        return []

    if county:
        base = DATA_DIR / state / county
        skip = "countyWideFiles"
    else:
        base = DATA_DIR / state / "stateWideFiles"
        skip = None

    if not base.is_dir():
        logger.warning(f"Category base directory does not exist: {base}")
        return []

    categories = []
    for p in base.iterdir():
        if p.is_dir() and (skip is None or p.name != skip):
            categories.append(p.name)

    logger.debug(f"Found {len(categories)} categories for state={state}, county={county}: {categories}")
    return sorted(categories)


def _list_datasets(state: str, county: str = "", category: str = "") -> List[str]:
    """List datasets for given state, county, and category."""
    if not state:
        return []

    # Determine the correct directory path
    if county:
        if category:
            base = DATA_DIR / state / county / category
        else:
            base = DATA_DIR / state / county / "countyWideFiles"
    else:
        if category:
            base = DATA_DIR / state / "stateWideFiles" / category
        else:
            base = DATA_DIR / state / "stateWideFiles"

    if not base.is_dir():
        logger.warning(f"Dataset base directory does not exist: {base}")
        return []

    datasets = []
    for f in base.glob("*.*"):
        if f.suffix.lower() in {".parquet", ".json", ".geojson"}:
            # Clean up the filename
            name = f.stem
            # Remove common suffixes
            name = name.replace("_county", "").replace("_state", "")
            if name not in datasets:
                datasets.append(name)

    logger.debug(f"Found {len(datasets)} datasets for state={state}, county={county}, category={category}: {datasets}")
    return sorted(datasets)


def _list_weighted_datasets() -> List[dict]:
    """
    List all available weighted datasets.
    Returns a list of dicts with 'display' and 'value' keys.
    """
    if not WEIGHTED_DIR.exists():
        logger.warning(f"WEIGHTED_DIR does not exist: {WEIGHTED_DIR}")
        return []

    datasets = []
    for mode in WEIGHTED_DIR.iterdir():
        if not mode.is_dir():
            continue

        for subcat in mode.iterdir():
            if not subcat.is_dir():
                continue

            for f in subcat.glob("*_normalized.parquet"):
                base_name = f.stem.replace("_", " ").replace(" normalized", "")
                display = f"{mode.name.split('_')[0].capitalize()} - {subcat.name}: {base_name}"
                rel = str(f.relative_to(BASE_DIR / "static" / "data")).replace("\\", "/")
                datasets.append({"display": display, "value": rel})

    logger.debug(f"Found {len(datasets)} weighted datasets")
    return sorted(datasets, key=lambda x: x["display"])


def compute_available_options(filters: Dict) -> Dict:
    """
    Compute available options based on current filter state.
    This is the main function called by the frontend.
    """
    mode = filters.get("mode", "regular")
    state = filters.get("state", "")
    county = filters.get("county", "")
    category = filters.get("category", "")

    logger.debug(f"Computing options for: mode={mode}, state={state}, county={county}, category={category}")

    if mode == "weighted":
        return {
            "states": [],
            "counties": [],
            "categories": [],
            "datasets": _list_weighted_datasets()
        }

    # For regular mode, return options based on current selection
    result = {
        "states": _list_states(),
        "counties": _list_counties(state) if state else [],
        "categories": _list_categories(state, county) if state else [],
        "datasets": _list_datasets(state, county, category) if state else [],
    }

    logger.debug(f"Returning options: {[(k, len(v) if isinstance(v, list) else v) for k, v in result.items()]}")
    return result