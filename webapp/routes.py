import os
import numpy as np
from flask import Blueprint, render_template, request, jsonify
from arcgis.features import FeatureLayer
from .pipeline.json_maker import create_dataset_json
from urllib.parse import urlencode
import geopandas as gpd
import logging
import urllib
import json

from .fetch_and_update import get_api_preview

logger = logging.getLogger(__name__)

main_blueprint = Blueprint('main', __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "static", "data", "split_parquet")

# --------------------
# Page Routes
# --------------------

@main_blueprint.route('/')
def index():
    return render_template('index.html')

@main_blueprint.route('/datasets')
def datasets():
    return render_template('datasets.html')

@main_blueprint.route('/docs')
def docs_page():
    return render_template('docs.html')

@main_blueprint.route('/contact')
def contact():
    return render_template('contact.html')

# New Editor Routes merged into main_blueprint
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
        from geo_open_source.webapp.pipeline.pipeline_runner import run_pipeline
        final_output = run_pipeline(dataset_name, input_geojson, options)
        return jsonify({"status": "success", "final_output": final_output})
    except Exception as e:
        logger.exception("Error running pipeline:")
        return jsonify({"status": "error", "message": str(e)}), 500

# --------------------
# Data Listing and Fetching Routes
# --------------------

# 1) LIST STATES
@main_blueprint.route('/list_states', methods=['GET'])
def list_states():
    """Return subdirectories in DATA_DIR as 'states'."""
    try:
        items = sorted(os.listdir(DATA_DIR))
        states = []
        for it in items:
            path = os.path.join(DATA_DIR, it)
            if os.path.isdir(path):
                states.append({"name": it})
        return jsonify({"states": states})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 2) LIST COUNTIES
@main_blueprint.route('/list_counties', methods=['GET'])
def list_counties():
    """Given a state, return county subdirs (exclude 'stateWideFiles')."""
    state = request.args.get('state')
    if not state:
        return jsonify({"counties": []})
    state_path = os.path.join(DATA_DIR, state)
    if not os.path.isdir(state_path):
        return jsonify({"counties": []})
    subdirs = sorted(os.listdir(state_path))
    counties = [d for d in subdirs if os.path.isdir(os.path.join(state_path, d)) and d != "stateWideFiles"]
    return jsonify({"counties": counties})

# 3) LIST CATEGORIES
@main_blueprint.route('/list_categories', methods=['GET'])
def list_categories():
    """
    If county is given, we look in /state/county/ subdirs (excluding countyWideFiles).
    Else, we look in /state/stateWideFiles subdirs.
    """
    state = request.args.get('state', '')
    county = request.args.get('county', '')
    if not state:
        return jsonify({"categories": []})
    if county:
        county_path = os.path.join(DATA_DIR, state, county)
        if not os.path.isdir(county_path):
            return jsonify({"categories": []})
        subdirs = sorted(os.listdir(county_path))
        categories = [d for d in subdirs if os.path.isdir(os.path.join(county_path, d)) and d != "countyWideFiles"]
        return jsonify({"categories": categories})
    else:
        sw_path = os.path.join(DATA_DIR, state, "stateWideFiles")
        if not os.path.isdir(sw_path):
            return jsonify({"categories": []})
        subdirs = sorted(os.listdir(sw_path))
        categories = [d for d in subdirs if os.path.isdir(os.path.join(sw_path, d))]
        return jsonify({"categories": categories})

# 4) LIST DATASETS
@main_blueprint.route('/list_datasets', methods=['GET'])
def list_datasets():
    """
    Given state, optional county, optional category -> return possible dataset filenames.
    """
    state = request.args.get('state', '')
    county = request.args.get('county', '')
    category = request.args.get('category', '')

    path = determine_dataset_dir(state, county, category)
    if not path or not os.path.isdir(path):
        return jsonify({"datasets": []})
    items = sorted(os.listdir(path))
    dsList = []
    for f in items:
        if f.endswith(".parquet"):
            base = f.replace("_county.parquet", "").replace("_state.parquet", "")
            dsList.append(base)
    return jsonify({"datasets": dsList})

def determine_dataset_dir(state, county, category):
    """Return the directory path where .parquet files for that selection exist."""
    if not state:
        return None
    base = os.path.join(DATA_DIR, state)
    if not os.path.isdir(base):
        return None
    if county:
        if category:
            return os.path.join(base, county, category)
        else:
            return os.path.join(base, county, "countyWideFiles")
    else:
        if category:
            return os.path.join(base, "stateWideFiles", category)
        else:
            return os.path.join(base, "stateWideFiles")

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

# 6) LIST WEIGHTED DATASETS
@main_blueprint.route('/list_weighted_datasets', methods=['GET'])
def list_weighted_datasets():
    """
    Scan the weighted_parquet/custom directory and return available weighted datasets.
    Returns a list of objects with 'display' and 'value'.
    """
    base_weighted = os.path.join(BASE_DIR, "static", "data", "weighted_parquet", "custom")
    dataset_list = []
    for mode in ['economic_normalized', 'energy_normalized', 'military_normalized']:
        mode_path = os.path.join(base_weighted, mode)
        if not os.path.isdir(mode_path):
            continue
        for subcat in os.listdir(mode_path):
            subcat_path = os.path.join(mode_path, subcat)
            if not os.path.isdir(subcat_path):
                continue
            for filename in os.listdir(subcat_path):
                if filename.endswith("_normalized.parquet"):
                    base_name = filename.replace("_normalized.parquet", "").replace("_", " ")
                    display_name = f"{mode.split('_')[0].capitalize()} - {subcat}: {base_name}"
                    relative_path = os.path.join("weighted_parquet", "custom", mode, subcat, filename)
                    dataset_list.append({"display": display_name, "value": relative_path})
    dataset_list = sorted(dataset_list, key=lambda x: x["display"])
    return jsonify({"datasets": dataset_list})

# 7) FETCH WEIGHTED DATA
@main_blueprint.route('/fetch_weighted_data', methods=['POST'])
def fetch_weighted_data():
    data = request.get_json() or {}
    logger.debug("Received payload for fetch_weighted_data: %s", data)
    dataset = data.get('dataset', '')
    if not dataset:
        logger.error("No dataset provided in payload.")
        return jsonify({"error": "No dataset provided"}), 400
    file_path = os.path.join(BASE_DIR, "static", "data", dataset)
    logger.debug("Computed file path: %s", file_path)
    if not os.path.exists(file_path):
        logger.error("File not found: %s", file_path)
        return jsonify({"error": f"File not found: {file_path}"}), 404
    try:
        gdf = gpd.read_parquet(file_path)
        logger.debug("Successfully read parquet file: %s", file_path)
        return jsonify(gdf_to_geojson_dict(gdf))
    except Exception as e:
        logger.exception("Exception occurred while reading parquet file:")
        return jsonify({"error": str(e)}), 500

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
# Editor endpoints: fetch fields and generate preview (including API response)
# ---------------------------------------------------------------------------

@main_blueprint.route('/editor/fetch_fields', methods=['POST'])
def fetch_fields():
    """
    Uses the ArcGIS API for Python to retrieve a FeatureLayer from the given API URL,
    then returns the field names (keys from the first feature’s attributes).
    """
    data = request.get_json()
    api_url = data.get("api_url")
    if not api_url:
        return jsonify({"error": "Missing API URL"}), 400
    try:
        # Remove any query string to create a FeatureLayer.
        base_url = api_url.split('/query')[0]
        layer = FeatureLayer(base_url)
        # Query using simple parameters (no geometry needed).
        result = layer.query(where="1=1", out_fields="*", return_geometry=False)
        features = result.features
        if not features:
            return jsonify({"error": "No features found in the API response."}), 400
        first_feature = features[0]
        properties = first_feature.attributes
        if not properties:
            return jsonify({"error": "No properties found in the first feature."}), 400
        field_list = list(properties.keys())
        logger.info("Fetched fields: %s", field_list)
        return jsonify({"fields": field_list})
    except Exception as e:
        logger.exception("Error in fetch_fields:")
        return jsonify({"error": str(e)}), 500



def generate_api_response_preview(api_url, preview_limit):
    try:
        return get_api_preview(api_url, limit=preview_limit)
    except Exception as e:
        logger.exception("Error generating API response preview:")
        return f"Error fetching API response: {e}"


def generate_api_creation_preview(api_url, selected_fields, config):
    # Use the FeatureLayer’s base URL.
    base_url = api_url.split('/query')[0]

    # Build the default parameters.
    params = {
        "where": config.get("where", "1=1"),
        "f": "json"
    }
    # Use selected fields if not empty; if all fields are selected, use "*".
    if not selected_fields or (isinstance(selected_fields, list) and len(selected_fields) == 0):
        params["outFields"] = "*"
    elif selected_fields == "*":
        params["outFields"] = "*"
    else:
        params["outFields"] = ",".join(selected_fields)

    # Add spatial parameters if needed.
    if config.get("spatial_input", "None").lower() == "envelope":
        params["geometry"] = ""
        params["geometryType"] = "esriGeometryEnvelope"
        params["inSR"] = config.get("inSR", "4326")
        params["spatialRel"] = config.get("spatialRel", "esriSpatialRelIntersects")

    # Add output options ONLY if they differ from defaults.
    # (Defaults: returnGeometry = True, returnIdsOnly = False, returnCountOnly = False)
    output_options = config.get("output_options", {})
    if "returnGeometry" in output_options and output_options["returnGeometry"] != True:
        params["returnGeometry"] = "true" if output_options["returnGeometry"] else "false"
    if "returnIdsOnly" in output_options and output_options["returnIdsOnly"] != False:
        params["returnIdsOnly"] = "true" if output_options["returnIdsOnly"] else "false"
    if "returnCountOnly" in output_options and output_options["returnCountOnly"] != False:
        params["returnCountOnly"] = "true" if output_options["returnCountOnly"] else "false"
    if "outSR" in output_options:
        params["outSR"] = output_options["outSR"]

    # Merge in any advanced query parameters.
    advanced_params = config.get("advanced_params", {})
    if isinstance(advanced_params, dict):
        params.update(advanced_params)

    # Build the query string using Python's standard library.
    query_string = urllib.parse.urlencode(params, doseq=True)
    generated_api_url = f"{base_url}/query?{query_string}"
    return generated_api_url


def generate_json_creation_preview(config):
    return json.dumps(config, indent=2)

def generate_python_creation_preview(config):
    dataset_name = config.get("dataset_name", "my_dataset").replace(" ", "_").lower()
    preview = f"""def process_{dataset_name}():
    \"\"\"Process the {dataset_name} dataset based on the specified configuration.\"\"\"
    # API URL: {config.get("api_url")}
    # Selected fields: {config.get("selected_fields")}
    # Spatial input: {config.get("spatial_input")}
    # Output options: {config.get("output_options")}
    pass
"""
    return preview

@main_blueprint.route('/editor/create_json', methods=['POST'])
def create_json():
    """
    Create a JSON object for a dataset using posted parameters.
    Validates that field grades are normalized.
    """
    try:
        data = request.get_json()
        dataset_json = create_dataset_json(
            dataset_name=data.get("datasetName"),
            dataset_link=data.get("datasetLink"),
            qualitative_fields=data.get("qualitativeFields", []),
            quantitative_fields=data.get("quantitativeProperties", []),
            removed_fields=data.get("removedFields", []),
            field_grade_summary=data.get("summaryOfGrades", {})
        )
        return jsonify(dataset_json)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@main_blueprint.route('/editor/generate_preview', methods=['POST'])
def generate_preview():
    config = request.get_json()
    logger.info("Received preview config: %s", config)
    api_url = config.get("api_url")
    selected_fields = config.get("selected_fields", [])
    try:
        preview_limit = int(config.get("preview_limit", 10))
    except ValueError:
        preview_limit = 10

    generated_preview = {
        "api_response": generate_api_response_preview(api_url, preview_limit),
        "api": generate_api_creation_preview(api_url, selected_fields, config),
        "json": generate_json_creation_preview(config),
        "python": generate_python_creation_preview(config)
    }
    logger.info("Sending generated preview to client.")
    return jsonify(generated_preview)

