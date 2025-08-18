import os
import numpy as np
from flask import Blueprint, render_template
import geopandas as gpd
from arcgis.features import FeatureLayer
from geo_open_source.webapp.jsonEditor.pipeline.quant_qual_counter import analyze_fields
from geo_open_source.webapp.jsonEditor.pipeline.json_maker import create_json_object, create_category_json, create_full_summary, export_json
from geo_open_source.webapp.display.weighted_display import build_weighted_figure
from geo_open_source.webapp.display.regular_display import create_regular_display
from urllib.parse import urlencode
import logging
import requests
import urllib
import json
import plotly
import plotly.graph_objects as go
from geo_open_source.webapp.options_catalog import compute_available_options

from geo_open_source.webapp.fetch_and_update import get_api_preview

logger = logging.getLogger(__name__)

main_blueprint = Blueprint('main', __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "static", "data", "split_parquet")
DATASET_DIR = os.path.join(BASE_DIR, 'indDataset')
CATEGORY_DIR = os.path.join(BASE_DIR, 'indCategory')
MODE_DIR = os.path.join(BASE_DIR, 'fullMode')

# --------------------
# Page Routes
# --------------------

@main_blueprint.route('/')
def index():
    return render_template('index.html')

@main_blueprint.route('/about', endpoint='about')
def about_page():
    return render_template('about_page.html')

@main_blueprint.route('/datasets')
def datasets():
    return render_template('datasets.html')

@main_blueprint.route('/docs')
def docs_page():
    return render_template('docs.html')

@main_blueprint.route('/contact')
def contact():
    return render_template('contact.html')

@main_blueprint.route('/editor')
def editor_page():
    return render_template('editor.html')

@main_blueprint.route('/run_pipeline', methods=['POST'])
def run_pipeline_route():
    """
    Receives a JSON payload from the editor and runs the pipeline.
    Expected payload:
    {
        "dataset_name": "Dataset Name",
        "input_geojson": "/path/to/raw/dataset.geojson",
        "options": {
            "clean_config": { ... },
            "quant_qual_config": { ... },
            "weighting_config": { ... },
            "qual_output_dir": "optional/path"
        }
    }
    """
    data = request.get_json()
    dataset_name = data.get("dataset_name")
    input_geojson = data.get("input_geojson")
    options = data.get("options", {})
    try:
        # Import run_pipeline here to ensure proper relative resolution.
        from geo_open_source.webapp.jsonEditor.pipeline.pipeline_runner import run_pipeline
        final_output = run_pipeline(dataset_name, input_geojson, options)
        return jsonify({"status": "success", "final_output": final_output})
    except Exception as e:
        logger.exception("Error running pipeline:")
        return jsonify({"status": "error", "message": str(e)}), 500

# --------------------
# Data Listing and Fetching Routes
# --------------------

# 5) FETCH DATA
@main_blueprint.route('/fetch_data', methods=['POST'])
def fetch_data():
    """
    POST with { state, county, category, dataset } => Load correct .parquet => return lat/lon JSON.
    """
    data = request.get_json() or {}
    state = data.get('state', '')
    county = data.get('county', '')
    category = data.get('category', '')
    dataset = data.get('dataset', '')
    file_path = determine_file_path(state, county, category, dataset)
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": f"File not found: {file_path}"}), 404
    try:
        gdf = gpd.read_parquet(file_path)
        return jsonify(gdf_to_geojson_dict(gdf))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def determine_file_path(state, county, category, dataset):
    """Construct the parquet file path based on user selection."""
    if not state:
        return None

    base = os.path.join(DATA_DIR, state)

    if county:
        if dataset:
            if category:
                return os.path.join(base, county, category, f"{dataset}_county.parquet")
            else:
                return os.path.join(base, county, "countyWideFiles", f"{dataset}_county.parquet")
        else:
            if category:
                return os.path.join(base, county, category, f"{category}_county.parquet")
            else:
                return os.path.join(base, county, "countyWideFiles", "allDatasets_county.parquet")
    else:
        sw = os.path.join(base, "stateWideFiles")
        if dataset:
            if category:
                return os.path.join(sw, category, f"{dataset}_state.parquet")
            else:
                return os.path.join(sw, f"{dataset}_state.parquet")
        else:
            if category:
                return os.path.join(sw, category, f"{category}_state.parquet")
            else:
                return os.path.join(sw, "allDatasets_state.parquet")

# # 6) LIST WEIGHTED DATASETS
# @main_blueprint.route('/list_weighted_datasets', methods=['GET'])
# def list_weighted_datasets():
#     """
#     Scan the weighted_parquet/custom directory and return available weighted datasets.
#     Returns a list of objects with 'display' and 'value'.
#     """
#     base_weighted = os.path.join(BASE_DIR, "static", "data", "weighted_parquet", "custom")
#     dataset_list = []
#     for mode in ['economic_normalized', 'energy_normalized', 'military_normalized']:
#         mode_path = os.path.join(base_weighted, mode)
#         if not os.path.isdir(mode_path):
#             continue
#         for subcat in os.listdir(mode_path):
#             subcat_path = os.path.join(mode_path, subcat)
#             if not os.path.isdir(subcat_path):
#                 continue
#             for filename in os.listdir(subcat_path):
#                 if filename.endswith("_normalized.parquet"):
#                     base_name = filename.replace("_normalized.parquet", "").replace("_", " ")
#                     display_name = f"{mode.split('_')[0].capitalize()} - {subcat}: {base_name}"
#                     relative_path = os.path.join("weighted_parquet", "custom", mode, subcat, filename)
#                     dataset_list.append({"display": display_name, "value": relative_path})
#     dataset_list = sorted(dataset_list, key=lambda x: x["display"])
#     return jsonify({"datasets": dataset_list})

# 7) FETCH WEIGHTED DATA
# @main_blueprint.route('/fetch_weighted_data', methods=['POST'])
# def fetch_weighted_data():
#     data = request.get_json() or {}
#     logger.debug("Received payload for fetch_weighted_data: %s", data)
#     dataset = data.get('dataset', '')
#     if not dataset:
#         logger.error("No dataset provided in payload.")
#         return jsonify({"error": "No dataset provided"}), 400
#     file_path = os.path.join(BASE_DIR, "static", "data", dataset)
#     logger.debug("Computed file path: %s", file_path)
#     if not os.path.exists(file_path):
#         logger.error("File not found: %s", file_path)
#         return jsonify({"error": f"File not found: {file_path}"}), 404
#     try:
#         gdf = gpd.read_parquet(file_path)
#         logger.debug("Successfully read parquet file: %s", file_path)
#         return jsonify(gdf_to_geojson_dict(gdf))
#     except Exception as e:
#         logger.exception("Exception occurred while reading parquet file:")
#         return jsonify({"error": str(e)}), 500

def gdf_to_geojson_dict(gdf):
    if "geometry" not in gdf.columns:
        logger.error("No geometry column found in GeoDataFrame")
        return {"error": "No geometry column found."}
    def convert_geom(geom):
        if geom is None:
            return None
        if isinstance(geom, dict) and "type" in geom:
            return geom
        return geom.__geo_interface__
    gdf["geometry"] = gdf.geometry.apply(convert_geom)
    gdf["longitude"] = gdf.geometry.apply(lambda g: g['coordinates'][0] if g and g['type'] == 'Point' else None)
    gdf["latitude"] = gdf.geometry.apply(lambda g: g['coordinates'][1] if g and g['type'] == 'Point' else None)
    gdf = gdf.replace([np.nan, np.inf, -np.inf], None)
    records = gdf.to_dict(orient="records")
    if records:
        logger.debug("First record keys: %s", list(records[0].keys()))
    else:
        logger.warning("No records produced by GeoDataFrame conversion.")
    return {"data": records}





# ---------------------------------------------------------------------------
# New Generate Map
# ---------------------------------------------------------------------------
from flask import request, jsonify

from geo_open_source.webapp.display.regular_display import create_regular_display        # -> your earlier helper we wrote
from geo_open_source.webapp.display import display


@main_blueprint.route("/generate_map", methods=["POST"])
def generate_map():
    """
    Unified server-side map generation for both regular and weighted data.
    Returns complete Plotly figure as JSON that can be rendered client-side.
    """
    try:
        req = request.get_json(force=True) or {}

        # Enhanced debugging
        print(f"🚀 DEBUG: generate_map called")
        print(f"📊 DEBUG: Request data: {json.dumps(req, indent=2)}")

        mode = req.get("mode", "regular")
        filters = req.get("filters", {})
        display_method = req.get("display_method", "default")
        weight_type = req.get("weight_type", "original")
        config = _extract_config_from_request(req)

        print(f"🔍 DEBUG: Extracted parameters:")
        print(f"  - Mode: {mode}")
        print(f"  - Display Method: {display_method}")
        print(f"  - Weight Type: {weight_type}")
        print(f"  - Filters: {filters}")
        print(f"  - Config: {config}")

        logger.debug(f"Received generate_map request: mode={mode}, display_method={display_method}")

        # Load and filter data based on mode
        if mode == "weighted":
            print(f"🔧 DEBUG: Loading weighted data...")
            gdf = _load_weighted_data(filters, weight_type)
            print(f"📈 DEBUG: Loaded {len(gdf)} rows of weighted data")

            print(f"🎨 DEBUG: Calling build_weighted_figure with method='{display_method}', weight_type='{weight_type}', config={config}")
            fig = build_weighted_figure(gdf, display_method, weight_type, config)
            print(f"✅ DEBUG: build_weighted_figure completed")
        else:
            print(f"🔧 DEBUG: Loading regular data...")
            gdf = _load_regular_data(filters)
            print(f"📈 DEBUG: Loaded {len(gdf)} rows of regular data")
            fig = create_regular_display(gdf, config)

        # --- Enforce basemap style on the figure layout ---
        try:
            # Prefer normalized key from our extractor; fall back to client pass-through
            _style = config.get("map_style") or config.get("mapStyle") or "open-street-map"
            if not hasattr(fig, "layout") or fig.layout is None:
                fig.update_layout(mapbox=dict(style=_style))
            else:
                # Make sure mapbox exists and set style
                mb = dict(fig.layout.mapbox) if getattr(fig.layout, "mapbox", None) else {}
                mb["style"] = _style
                fig.update_layout(mapbox=mb)
            print(f"🗺️ DEBUG: Applied mapbox.style = '{_style}' on server")
        except Exception as _e:
            print(f"⚠️ DEBUG: Could not enforce map style on figure: {_e}")

        # Convert figure to JSON for client-side rendering
        print(f"🔄 DEBUG: Converting figure to JSON...")
        fig_json = fig.to_json()
        print(f"✅ DEBUG: Figure JSON conversion successful")

        # Check figure structure
        if hasattr(fig, 'data'):
            print(f"📊 DEBUG: Figure has {len(fig.data)} traces")

        return jsonify({"success": True, "figure": fig_json})

    except Exception as e:
        print(f"❌ DEBUG: Error in generate_map: {str(e)}")
        print(f"❌ DEBUG: Traceback:")
        import traceback
        traceback.print_exc()

        logger.exception("Error in generate_map:")
        return jsonify({"success": False, "error": str(e)}), 500



def _load_weighted_data(filters: dict, weight_type: str = "original") -> gpd.GeoDataFrame:
    """Load weighted dataset from parquet file."""
    dataset_path = filters.get("dataset")
    if not dataset_path:
        raise ValueError("Dataset path is required for weighted mode")

    file_path = os.path.join(BASE_DIR, "static", "data", dataset_path)
    print(f"🔍 DEBUG: Looking for weighted file at: {file_path}")

    if not os.path.exists(file_path):
        print(f"❌ DEBUG: File not found: {file_path}")
        raise FileNotFoundError(f"Weighted dataset not found: {file_path}")

    print(f"📂 DEBUG: Loading parquet file: {file_path}")
    gdf = gpd.read_parquet(file_path)

    print(f"📊 DEBUG: Loaded GeoDataFrame with shape {gdf.shape}")
    print(f"📊 DEBUG: Columns: {list(gdf.columns)}")

    # Apply weight type if specified
    if weight_type != "original" and weight_type in gdf.columns:
        print(f"⚖️ DEBUG: Setting weight column to {weight_type}")
        gdf["weight"] = gdf[weight_type]

    return gdf


def _load_regular_data(filters: dict) -> gpd.GeoDataFrame:
    """Load regular dataset from parquet file based on filters."""
    state = filters.get("state")
    if not state:
        raise ValueError("State is required for regular mode")

    county = filters.get("county", "")
    category = filters.get("category", "")
    dataset = filters.get("dataset", "")

    file_path = determine_file_path(state, county, category, dataset)
    print(f"🔍 DEBUG: Looking for regular file at: {file_path}")

    if not file_path or not os.path.exists(file_path):
        print(f"❌ DEBUG: File not found: {file_path}")
        raise FileNotFoundError(f"Dataset not found: {file_path}")

    print(f"📂 DEBUG: Loading parquet file: {file_path}")
    gdf = gpd.read_parquet(file_path)
    print(f"📊 DEBUG: Loaded GeoDataFrame with shape {gdf.shape}")

    return gdf


def _extract_config_from_request(req: dict) -> dict:
    """Extract display configuration from request, including basemap style and heatmap settings."""
    config = req.get("config", {}) or {}

    print(f"🔧 DEBUG: Raw config from request: {config}")

    # --- Data fraction (handles either dataFraction or data_fraction) ---
    data_fraction = 0.1  # default 10%
    if "dataFraction" in config:
        data_fraction = config["dataFraction"]
        print(f"🔧 DEBUG: Found dataFraction: {data_fraction}")
    elif "data_fraction" in config:
        data_fraction = config["data_fraction"]
        print(f"🔧 DEBUG: Found data_fraction: {data_fraction}")
    else:
        print(f"🔧 DEBUG: No data fraction found; using default: {data_fraction}")

    if isinstance(data_fraction, (int, float)):
        if data_fraction > 1:
            data_fraction = data_fraction / 100.0
        data_fraction = max(0.01, min(1.0, float(data_fraction)))
    else:
        data_fraction = 0.1

    print(f"🔧 DEBUG: Final data_fraction being used: {data_fraction}")

    # --- Geometry types / availability ---
    geometry_types = config.get("geometryTypes", [])
    show_unavailable = config.get("showUnavailable", False)

    # --- Heatmap points toggle ---
    show_heatmap_points = config.get("showHeatmapPoints", config.get("show_heatmap_points", False))
    print(f"🔥 DEBUG: Heatmap points setting from config: {show_heatmap_points}")

    # --- Basemap style (string, Plotly Mapbox "style") ---
    map_style = config.get("mapStyle") or "open-street-map"
    print(f"🗺️ DEBUG: map_style requested: {map_style}")

    final_config = {
        "data_fraction": data_fraction,
        "geometry_types": geometry_types,
        "show_unavailable": show_unavailable,
        "show_heatmap_points": show_heatmap_points,  # ADD THIS LINE
        "display_method": req.get("display_method", "default"),
        "map_style": map_style,           # normalized key for server-side use
        "raw_mapStyle": config.get("mapStyle")  # keep original for debugging
    }

    print(f"🔧 DEBUG: Final config: {final_config}")
    return final_config



# Add a new route for getting available options dynamically
@main_blueprint.route("/get_options", methods=["POST"])
def get_options():
    """
    Dynamic options loading based on current filter state.
    This replaces the individual list_* endpoints for a more unified approach.
    """
    try:
        filters = request.get_json() or {}
        options = compute_available_options(filters)
        return jsonify({"success": True, "options": options})
    except Exception as e:
        logger.exception("Error computing available options:")
        return jsonify({"success": False, "error": str(e)}), 500

