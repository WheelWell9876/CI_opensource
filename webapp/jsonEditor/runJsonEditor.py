import os
import numpy as np
from flask import Blueprint, render_template
import logging
import requests
import jsonify
import urllib

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "static", "data", "split_parquet")
DATASET_DIR = os.path.join(BASE_DIR, 'indDataset')
CATEGORY_DIR = os.path.join(BASE_DIR, 'indCategory')
MODE_DIR = os.path.join(BASE_DIR, 'fullMode')

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


# Existing helper: generate_api_creation_preview(api_url, selected_fields, config)
def generate_api_creation_preview(api_url, selected_fields, config):
    # Use the FeatureLayer’s base URL.
    base_url = api_url.split('/query')[0]

    # Build the default parameters.
    params = {
        "where": config.get("where", "1=1"),
        "f": "json"
    }
    # Use selected fields if provided.
    if not selected_fields or (isinstance(selected_fields, list) and len(selected_fields) == 0):
        params["outFields"] = "*"
    elif selected_fields == "*":
        params["outFields"] = "*"
    else:
        params["outFields"] = ",".join(selected_fields)

    # Add spatial parameters if needed.
    if config.get("spatial_input", "None").lower() == "envelope":
        params["geometry"] = ""  # You may modify this to accept an actual envelope if needed.
        params["geometryType"] = "esriGeometryEnvelope"
        params["inSR"] = config.get("inSR", "4326")
        params["spatialRel"] = config.get("spatialRel", "esriSpatialRelIntersects")

    # Only add output options if they differ from defaults.
    output_options = config.get("output_options", {})
    # Defaults: returnGeometry True, returnIdsOnly False, returnCountOnly False.
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

    # Build the query string using urllib.
    query_string = urllib.parse.urlencode(params, doseq=True)
    generated_api_url = f"{base_url}/query?{query_string}"
    return generated_api_url

# New helper: execute the full API URL via requests.
def execute_api_request(api_url):
    try:
        response = requests.get(api_url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.exception("Error in execute_api_request:")
        raise e

# New endpoint to execute the updated API.
@main_blueprint.route('/editor/execute_api', methods=['POST'])
def execute_api():
    """
    Build the updated API URL using the modified configuration (including selected fields)
    and execute that API. Returns a preview of the GeoJSON response.
    If all fields are selected (or none are deselected), it falls back to the unedited API.
    """
    config = request.get_json()
    logger.info("Received config for API execution: %s", config)
    api_url = config.get("api_url")
    selected_fields = config.get("selected_fields", "*")
    try:
        # Generate the full API URL using the current configuration.
        generated_api_url = generate_api_creation_preview(api_url, selected_fields, config)
        logger.info("Generated API URL: %s", generated_api_url)
        # Execute the API request.
        preview_response = execute_api_request(generated_api_url)
        # Optionally limit the returned features to preview_limit.
        try:
            preview_limit = int(config.get("preview_limit", 10))
        except ValueError:
            preview_limit = 10
        if "features" in preview_response:
            preview_response["features"] = preview_response["features"][:preview_limit]
        return jsonify({"api_response": preview_response})
    except Exception as e:
        logger.exception("Error executing API:")
        return jsonify({"error": str(e)}), 500


@main_blueprint.route('/editor/create_json', methods=['POST'])
def create_json():
    data = request.get_json()
    try:
        json_object = create_json_object(data, analysis=None)
        return jsonify(json_object)
    except Exception as e:
        logger.exception("Error in create_json:")
        return jsonify({"error": str(e)}), 500


@main_blueprint.route('/editor/process_fields', methods=['POST'])
def process_fields():
    """
    Endpoint to process the loaded GeoJSON fields. It reads the JSON from the request,
    passes it to the analyze_fields function, and returns the analysis.
    """
    try:
        geojson_data = request.get_json()
        if not geojson_data:
            return jsonify({"error": "No GeoJSON data provided"}), 400

        # Analyze the fields using the provided function.
        analysis = analyze_fields(geojson_data)
        return jsonify(analysis)
    except Exception as e:
        logger.exception("Error processing fields:")
        return jsonify({"error": str(e)}), 500


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


# ---------------------------------------------------------------------------
# JSON endpoints
# ---------------------------------------------------------------------------

# Utility: list JSON files in a folder.
def list_json_files(json_type):
    if json_type == 'dataset':
        folder = DATASET_DIR
    elif json_type == 'category':
        folder = CATEGORY_DIR
    elif json_type == 'mode':
        folder = MODE_DIR
    else:
        return []
    os.makedirs(folder, exist_ok=True)
    return [f for f in os.listdir(folder) if f.endswith('.json')]

@main_blueprint.route('/json/list', methods=['GET'])
def json_list():
    json_type = request.args.get('type')
    files = list_json_files(json_type)
    return jsonify({"files": files})

@main_blueprint.route('/json/load', methods=['GET'])
def json_load():
    json_type = request.args.get('type')
    filename = request.args.get('file')
    if json_type == 'dataset':
        folder = DATASET_DIR
    elif json_type == 'category':
        folder = CATEGORY_DIR
    elif json_type == 'mode':
        folder = MODE_DIR
    else:
        return jsonify({"error": "Invalid type"}), 400
    filepath = os.path.join(folder, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    with open(filepath, 'r') as f:
        data = json.load(f)
    return jsonify(data)

@main_blueprint.route('/json/save', methods=['POST'])
def json_save():
    json_type = request.args.get('type')
    filename = request.args.get('file')
    data = request.get_json()
    if json_type == 'dataset':
        folder = DATASET_DIR
    elif json_type == 'category':
        folder = CATEGORY_DIR
    elif json_type == 'mode':
        folder = MODE_DIR
    else:
        return jsonify({"error": "Invalid type"}), 400
    os.makedirs(folder, exist_ok=True)
    filepath = os.path.join(folder, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    return jsonify({"status": "success", "message": "File saved."})

@main_blueprint.route('/editor/create_json', methods=['POST'])
def create_json_endpoint():
    """
    Create a JSON object from posted data.
    This endpoint creates either a dataset JSON or (if category info is present) a category JSON.
    """
    data = request.get_json()
    try:
        json_obj = create_json_object(data)
        return jsonify(json_obj)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@main_blueprint.route('/editor/fuse_category', methods=['POST'])
def fuse_category_endpoint():
    """
    Fuse multiple dataset JSON files into a category JSON.
    Expects JSON body with:
      - categoryName: new category name
      - categoryInfo: dict with details
      - datasetFiles: list of dataset filenames from DATASET_DIR
    """
    data = request.get_json()
    category_name = data.get('categoryName')
    category_info = data.get('categoryInfo')
    dataset_files = data.get('datasetFiles', [])
    datasets = {}
    for filename in dataset_files:
        filepath = os.path.join(DATASET_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                ds = json.load(f)
                ds_name = ds.get("datasetName", filename)
                datasets[ds_name] = ds
    try:
        category_json = create_category_json(category_name, category_info, datasets)
        export_json(category_json, CATEGORY_DIR, f"{category_name}_Mode.json")
        return jsonify(category_json)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@main_blueprint.route('/editor/fuse_mode', methods=['POST'])
def fuse_mode_endpoint():
    """
    Fuse multiple category JSON files into a full mode JSON.
    Expects JSON body with:
      - categoryFiles: list of category filenames from CATEGORY_DIR
    """
    data = request.get_json()
    category_files = data.get('categoryFiles', [])
    categories = {}
    for filename in category_files:
        filepath = os.path.join(CATEGORY_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                cat = json.load(f)
                cat_name = cat.get("categoryName", filename)
                categories[cat_name] = cat
    try:
        full_summary = create_full_summary(categories)
        fused_mode = {
            "categories": categories,
            "fullSummary": full_summary
        }
        export_json(fused_mode, MODE_DIR, "fused_mode.json")
        return jsonify(fused_mode)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

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
