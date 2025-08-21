import os
import json
import logging
from typing import Dict, List, Any, Optional
from flask import Blueprint, render_template, request, jsonify
import geopandas as gpd
import pandas as pd
import numpy as np
import requests
from urllib.parse import urlparse, parse_qs, urlencode

logger = logging.getLogger(__name__)

# Create blueprint
json_editor_blueprint = Blueprint('json_editor', __name__)

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "static", "data")
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")

# Ensure directories exist
os.makedirs(EXPORTS_DIR, exist_ok=True)

# Pre-configured APIs with complete URLs
PRESET_APIS = {
    "epa-disaster": {
        "name": "EPA Disaster Debris Recovery Data",
        "url": "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/EPA_Disaster_Debris_Recovery_Data/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
        "description": "EPA disaster recovery and debris management data"
    },
    "agri-minerals": {
        "name": "Agricultural Minerals Operations",
        "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Agricultural_Minerals_Operations/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
        "description": "Agricultural mineral operations across the US"
    },
    "construction-minerals": {
        "name": "Construction Minerals Operations",
        "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Construction_Minerals_Operations/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
        "description": "Construction mineral operations data"
    },
    "usace-reservoirs": {
        "name": "USACE Reservoirs",
        "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Reclamation_Reservoirs/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
        "description": "US Army Corps of Engineers reservoir data"
    },
    "dams": {
        "name": "National Dams Inventory",
        "url": "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/NID_v1/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
        "description": "National dams inventory across the United States"
    }
}


class GeoJSONProcessor:
    """Main processor class for GeoJSON data manipulation and analysis."""

    def __init__(self, data: Dict[str, Any]):
        """Initialize processor with GeoJSON data."""
        self.data = data
        self.features = data.get('features', [])
        self.fields = {}
        self.field_types = {}
        self.field_stats = {}
        self._analyze_fields()

    def _analyze_fields(self):
        """Analyze fields from the first feature to determine types and statistics."""
        if not self.features:
            logger.warning("No features found in GeoJSON data")
            return

        # Get fields from first feature
        first_feature = self.features[0]
        properties = first_feature.get('properties', {}) or first_feature.get('attributes', {})

        if not properties:
            logger.warning("No properties found in first feature")
            return

        logger.info(f"Found {len(properties)} fields in first feature")

        for field_name, value in properties.items():
            self.fields[field_name] = []

            # Determine field type with better type checking
            if value is None:
                self.field_types[field_name] = 'unknown'
            elif isinstance(value, bool):
                self.field_types[field_name] = 'boolean'
            elif isinstance(value, (int, float)) and not isinstance(value, bool):
                self.field_types[field_name] = 'quantitative'
            else:
                self.field_types[field_name] = 'qualitative'

        # Collect all values for each field
        for feature in self.features[:1000]:  # Limit to first 1000 features for performance
            props = feature.get('properties', {}) or feature.get('attributes', {})
            for field_name in self.fields:
                if field_name in props:
                    self.fields[field_name].append(props[field_name])

        # Calculate statistics
        self._calculate_statistics()

    def _calculate_statistics(self):
        """Calculate statistics for each field."""
        for field_name, values in self.fields.items():
            # Skip if no values
            if not values:
                self.field_stats[field_name] = {
                    'type': self.field_types[field_name],
                    'count': 0,
                    'has_data': False
                }
                continue

            if self.field_types[field_name] == 'quantitative':
                # Filter out None values and convert to float
                numeric_values = []
                for v in values:
                    if v is not None:
                        try:
                            numeric_values.append(float(v))
                        except (ValueError, TypeError):
                            pass

                if numeric_values:
                    self.field_stats[field_name] = {
                        'type': 'quantitative',
                        'count': len(numeric_values),
                        'min': min(numeric_values),
                        'max': max(numeric_values),
                        'mean': sum(numeric_values) / len(numeric_values),
                        'std': np.std(numeric_values) if len(numeric_values) > 1 else 0,
                        'median': np.median(numeric_values),
                        'has_data': True
                    }
                else:
                    self.field_stats[field_name] = {
                        'type': 'quantitative',
                        'count': 0,
                        'has_data': False
                    }
            else:
                # Handle qualitative fields
                non_null_values = [v for v in values if v is not None]
                if non_null_values:
                    unique_values = list(set(non_null_values))
                    value_counts = {str(val): non_null_values.count(val) for val in unique_values}
                    self.field_stats[field_name] = {
                        'type': 'qualitative',
                        'count': len(non_null_values),
                        'unique_values': len(unique_values),
                        'value_counts': value_counts,
                        'top_values': sorted(value_counts.items(), key=lambda x: x[1], reverse=True)[:10],
                        'has_data': True
                    }
                else:
                    self.field_stats[field_name] = {
                        'type': 'qualitative',
                        'count': 0,
                        'has_data': False
                    }

    def get_field_info(self) -> Dict[str, Any]:
        """Get comprehensive field information."""
        return {
            'fields': list(self.fields.keys()),
            'field_types': self.field_types,
            'field_stats': self.field_stats,
            'total_features': len(self.features)
        }

    def apply_weights(self, weights: Dict[str, float]) -> List[float]:
        """Apply weights to fields and calculate weighted scores."""
        weighted_scores = []

        for feature in self.features:
            props = feature.get('properties', {}) or feature.get('attributes', {})
            score = 0.0

            for field_name, weight in weights.items():
                if field_name in props and self.field_types.get(field_name) == 'quantitative':
                    value = props[field_name]
                    if value is not None:
                        try:
                            value = float(value)
                            # Normalize value based on field statistics
                            stats = self.field_stats.get(field_name, {})
                            min_val = stats.get('min', 0)
                            max_val = stats.get('max', 1)

                            if max_val > min_val:
                                normalized = (value - min_val) / (max_val - min_val)
                                score += normalized * weight
                        except (ValueError, TypeError):
                            pass

            weighted_scores.append(score)

        return weighted_scores

    def filter_fields(self, selected_fields: List[str]) -> Dict[str, Any]:
        """Filter GeoJSON to include only selected fields."""
        filtered_features = []

        for feature in self.features:
            props = feature.get('properties', {}) or feature.get('attributes', {})
            filtered_props = {k: v for k, v in props.items() if k in selected_fields}

            filtered_feature = {
                'type': feature.get('type', 'Feature'),
                'geometry': feature.get('geometry'),
                'properties': filtered_props
            }
            filtered_features.append(filtered_feature)

        return {
            'type': self.data.get('type', 'FeatureCollection'),
            'features': filtered_features
        }

    def generate_python_code(self, config: Dict[str, Any]) -> str:
        """Generate Python code based on configuration."""
        selected_fields = config.get('selected_fields', [])
        weights = config.get('weights', {})
        dataset_name = config.get('dataset_name', 'dataset').replace(' ', '_')

        code = f'''import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any

class {dataset_name}Processor:
    """Auto-generated processor for {dataset_name}."""

    def __init__(self, filepath: str):
        """Initialize with GeoJSON file path."""
        self.gdf = gpd.read_file(filepath)
        self.selected_fields = {selected_fields}
        self.field_weights = {json.dumps(weights, indent=8)}
        self.field_types = {json.dumps(self.field_types, indent=8)}

    def process(self) -> gpd.GeoDataFrame:
        """Process the GeoDataFrame with field selection and weighting."""
        # Filter fields
        fields_to_keep = ['geometry'] + [f for f in self.selected_fields 
                                         if f in self.gdf.columns]
        gdf_filtered = self.gdf[fields_to_keep]

        # Apply weights
        weighted_score = pd.Series(0, index=gdf_filtered.index)

        for field, weight in self.field_weights.items():
            if field in gdf_filtered.columns and self.field_types.get(field) == 'quantitative':
                field_values = pd.to_numeric(gdf_filtered[field], errors='coerce')
                if field_values.notna().any():
                    min_val = field_values.min()
                    max_val = field_values.max()
                    if max_val > min_val:
                        normalized = (field_values - min_val) / (max_val - min_val)
                        weighted_score += normalized * weight

        gdf_filtered['weighted_score'] = weighted_score
        return gdf_filtered

    def export(self, output_path: str):
        """Export processed data."""
        processed = self.process()
        processed.to_file(output_path, driver='GeoJSON')
        return output_path

# Usage
processor = {dataset_name}Processor("input.geojson")
result = processor.process()
processor.export("output.geojson")
'''
        return code


# Routes
@json_editor_blueprint.route('/editor')
def editor_page():
    """Render the new editor page."""
    return render_template('editor.html')


@json_editor_blueprint.route('/api/load_preset', methods=['POST'])
def load_preset_api():
    """Load data from a preset API."""
    try:
        data = request.get_json()
        api_key = data.get('api_key')

        logger.info(f"Loading preset API: {api_key}")

        if api_key not in PRESET_APIS:
            return jsonify({'error': 'Invalid API key'}), 400

        api_info = PRESET_APIS[api_key]
        api_url = api_info['url']

        # Parse the existing URL to modify parameters if needed
        parsed_url = urlparse(api_url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"

        # Parse existing query parameters
        existing_params = parse_qs(parsed_url.query)

        # Convert lists to single values
        params = {k: v[0] if isinstance(v, list) and len(v) == 1 else v
                  for k, v in existing_params.items()}

        # Override with user preferences if provided
        if 'limit' in data:
            params['resultRecordCount'] = str(data['limit'])

        # Ensure we're getting GeoJSON format
        params['f'] = 'geojson'

        # Build the complete URL
        if '?' in api_url:
            # URL already has query parameters, just use it directly
            final_url = api_url
            if 'limit' in data:
                # Add record count limit if specified
                final_url = final_url.replace('f=geojson', f'f=geojson&resultRecordCount={data["limit"]}')
        else:
            # Build URL with parameters
            query_string = urlencode(params)
            final_url = f"{base_url}?{query_string}"

        logger.info(f"Fetching data from: {final_url}")

        # Make request with timeout
        response = requests.get(final_url, timeout=30)
        response.raise_for_status()

        geojson_data = response.json()

        # Validate that we got valid GeoJSON
        if 'features' not in geojson_data:
            logger.error(f"Invalid GeoJSON response from {api_key}: missing 'features' key")
            return jsonify({'error': 'Invalid data format received from API'}), 500

        logger.info(f"Successfully loaded {len(geojson_data.get('features', []))} features from {api_key}")

        # Process with GeoJSONProcessor
        processor = GeoJSONProcessor(geojson_data)
        field_info = processor.get_field_info()

        # Limit features for response to avoid sending too much data
        limited_features = geojson_data['features'][:100] if len(geojson_data['features']) > 100 else geojson_data[
            'features']

        return jsonify({
            'success': True,
            'data': {
                'type': geojson_data.get('type', 'FeatureCollection'),
                'features': limited_features,
                'total_features': len(geojson_data['features'])
            },
            'field_info': field_info,
            'api_info': api_info
        })

    except requests.exceptions.Timeout:
        logger.error(f"Timeout loading preset API: {api_key}")
        return jsonify({'error': 'Request timed out. The API may be slow or unavailable.'}), 504
    except requests.exceptions.RequestException as e:
        logger.exception(f"Request error loading preset API: {api_key}")
        return jsonify({'error': f'Error fetching data: {str(e)}'}), 500
    except Exception as e:
        logger.exception(f"Unexpected error loading preset API: {api_key}")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


@json_editor_blueprint.route('/api/load_custom', methods=['POST'])
def load_custom_api():
    """Load data from a custom API URL."""
    try:
        data = request.get_json()
        api_url = data.get('url')

        if not api_url:
            return jsonify({'error': 'URL is required'}), 400

        logger.info(f"Loading custom API: {api_url}")

        # Check if it's already a complete query URL
        if 'f=geojson' in api_url or 'f=json' in api_url:
            # Use the URL as-is, just ensure it's requesting GeoJSON
            final_url = api_url.replace('f=json', 'f=geojson')
        else:
            # Build query URL
            if '/query' not in api_url:
                api_url = api_url.rstrip('/') + '/query'

            # Build query parameters
            params = {
                'where': data.get('where', '1=1'),
                'outFields': data.get('fields', '*'),
                'f': 'geojson',
                'resultRecordCount': data.get('limit', 100)
            }

            # Add spatial parameters if provided
            if data.get('geometry'):
                params['geometry'] = json.dumps(data['geometry'])
                params['geometryType'] = data.get('geometryType', 'esriGeometryEnvelope')
                params['spatialRel'] = data.get('spatialRel', 'esriSpatialRelIntersects')

            query_string = urlencode(params)
            final_url = f"{api_url}?{query_string}"

        logger.info(f"Fetching data from: {final_url}")

        # Make request with timeout
        response = requests.get(final_url, timeout=30)
        response.raise_for_status()

        geojson_data = response.json()

        # Validate GeoJSON
        if 'features' not in geojson_data:
            logger.error("Invalid GeoJSON response: missing 'features' key")
            return jsonify({'error': 'Invalid data format received from API'}), 500

        logger.info(f"Successfully loaded {len(geojson_data.get('features', []))} features")

        # Process with GeoJSONProcessor
        processor = GeoJSONProcessor(geojson_data)
        field_info = processor.get_field_info()

        # Limit features for response
        limited_features = geojson_data['features'][:100] if len(geojson_data['features']) > 100 else geojson_data[
            'features']

        return jsonify({
            'success': True,
            'data': {
                'type': geojson_data.get('type', 'FeatureCollection'),
                'features': limited_features,
                'total_features': len(geojson_data['features'])
            },
            'field_info': field_info
        })

    except requests.exceptions.Timeout:
        logger.error("Timeout loading custom API")
        return jsonify({'error': 'Request timed out. The API may be slow or unavailable.'}), 504
    except requests.exceptions.RequestException as e:
        logger.exception("Request error loading custom API")
        return jsonify({'error': f'Error fetching data: {str(e)}'}), 500
    except Exception as e:
        logger.exception("Unexpected error loading custom API")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


@json_editor_blueprint.route('/api/upload_file', methods=['POST'])
def upload_file():
    """Handle file upload."""
    print(f"🌐 [ROUTE] /api/upload_file accessed via POST")
    logger.info("Received file upload request")

    try:
        if 'file' not in request.files:
            print(f"❌ [REQUEST] No file in request")
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            print(f"❌ [REQUEST] No file selected")
            return jsonify({'error': 'No file selected'}), 400

        print(f"📁 [FILE] Processing uploaded file: {file.filename}")
        logger.info(f"Processing uploaded file: {file.filename}")

        # Read file content
        content = file.read()
        print(f"📁 [FILE] File size: {len(content)} bytes")

        # Try to parse as JSON
        try:
            geojson_data = json.loads(content)
            print(f"✅ [FILE] Successfully parsed JSON")
        except json.JSONDecodeError as e:
            print(f"❌ [FILE] Invalid JSON: {e}")
            logger.error(f"Invalid JSON in uploaded file: {e}")
            return jsonify({'error': f'Invalid JSON format: {str(e)}'}), 400

        # Validate GeoJSON structure
        if 'features' not in geojson_data:
            print(f"❌ [VALIDATION] Invalid GeoJSON: missing 'features' property")
            return jsonify({'error': 'Invalid GeoJSON: missing "features" property'}), 400

        feature_count = len(geojson_data.get('features', []))
        print(f"✅ [SUCCESS] Successfully parsed {feature_count} features from uploaded file")
        logger.info(f"Successfully parsed {feature_count} features from uploaded file")

        # Process with GeoJSONProcessor
        processor = GeoJSONProcessor(geojson_data)
        field_info = processor.get_field_info()

        # Limit features for response
        limited_features = geojson_data['features'][:100] if len(geojson_data['features']) > 100 else geojson_data[
            'features']

        return jsonify({
            'success': True,
            'data': {
                'type': geojson_data.get('type', 'FeatureCollection'),
                'features': limited_features,
                'total_features': feature_count
            },
            'field_info': field_info,
            'filename': file.filename
        })

    except Exception as e:
        print(f"💥 [ERROR] Unexpected error in file upload: {e}")
        import traceback
        print(f"💥 [ERROR] Traceback: {traceback.format_exc()}")
        logger.exception("Error processing uploaded file")
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500


@json_editor_blueprint.route('/api/save', methods=['POST'])
def save_to_server():
    """Save configuration to server database."""
    print(f"🌐 [ROUTE] /api/save accessed via POST")
    logger.info("Received request to save configuration")

    try:
        data = request.get_json()
        print(f"📨 [REQUEST] Save data: {data}")

        config = data.get('config')

        if not config:
            print(f"❌ [REQUEST] No configuration provided")
            return jsonify({'error': 'No configuration provided'}), 400

        # Generate unique ID
        config_id = pd.Timestamp.now().strftime('%Y%m%d%H%M%S')
        dataset_name = config.get('datasetName', 'dataset').replace(' ', '_')
        print(f"💾 [SAVE] Generated config ID: {config_id}, dataset name: {dataset_name}")

        # Save to JSON file (as database substitute)
        saved_configs_dir = os.path.join(DATA_DIR, 'saved_configs')
        os.makedirs(saved_configs_dir, exist_ok=True)
        print(f"💾 [SAVE] Save directory: {saved_configs_dir}")

        filename = f"{config_id}_{dataset_name}.json"
        filepath = os.path.join(saved_configs_dir, filename)
        print(f"💾 [SAVE] Full file path: {filepath}")

        # Add metadata
        config['_metadata'] = {
            'id': config_id,
            'created_at': pd.Timestamp.now().isoformat(),
            'version': '1.0'
        }

        with open(filepath, 'w') as f:
            json.dump(config, f, indent=2)

        print(f"✅ [SUCCESS] Saved configuration {config_id} to server")
        logger.info(f"Saved configuration {config_id} to server")

        return jsonify({
            'success': True,
            'config_id': config_id,
            'message': f'Configuration saved with ID: {config_id}'
        })

    except Exception as e:
        print(f"💥 [ERROR] Error saving to server: {e}")
        import traceback
        print(f"💥 [ERROR] Traceback: {traceback.format_exc()}")
        logger.exception("Error saving to server")
        return jsonify({'error': f'Error saving: {str(e)}'}), 500


# Debug route to show registered routes
@json_editor_blueprint.route('/debug/routes')
def debug_routes():
    """Debug endpoint to show all registered routes."""
    print(f"🌐 [ROUTE] /debug/routes accessed")
    from flask import current_app
    routes = []
    for rule in current_app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'rule': str(rule)
        })
    print(f"🔍 [DEBUG] Found {len(routes)} total routes")
    return jsonify({'routes': routes})


# Register blueprint with app
def register_json_editor(app):
    """Register the JSON editor blueprint with the Flask app."""
    print(f"📘 [REGISTER] Starting blueprint registration")
    logger.info("Registering JSON Editor blueprint")

    print(f"📘 [REGISTER] App: {app}")
    print(f"📘 [REGISTER] Blueprint: {json_editor_blueprint}")
    print(f"📘 [REGISTER] Blueprint name: {json_editor_blueprint.name}")

    try:
        app.register_blueprint(json_editor_blueprint, url_prefix='/json-editor')
        print(f"✅ [REGISTER] JSON Editor blueprint registered successfully with prefix '/json-editor'")
        logger.info("JSON Editor blueprint registered successfully")

        # Log the registered routes
        json_editor_routes = [rule for rule in app.url_map.iter_rules() if rule.endpoint.startswith('json_editor')]
        print(f"✅ [REGISTER] Registered {len(json_editor_routes)} JSON editor routes:")
        logger.info(f"Registered {len(json_editor_routes)} JSON editor routes:")
        for route in json_editor_routes:
            print(f"  ✅ {route.endpoint}: {route.rule} {list(route.methods)}")
            logger.info(f"  {route.endpoint}: {route.rule} {list(route.methods)}")

    except Exception as e:
        print(f"❌ [REGISTER] Failed to register blueprint: {e}")
        import traceback
        print(f"❌ [REGISTER] Traceback: {traceback.format_exc()}")
        logger.error(f"Failed to register blueprint: {e}")
        raise


print(f"🏁 [INIT] runJsonEditor.py initialization complete")

if __name__ == "__main__":
    # Test the processor with a simple example
    print("🧪 [TEST] Testing GeoJSON Processor...")

    test_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "id": 1,
                    "name": "Test Location",
                    "value": 100,
                    "category": "A"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [-122.4, 37.8]
                }
            }
        ]
    }

    processor = GeoJSONProcessor(test_data)
    info = processor.get_field_info()
    print("🧪 [TEST] Field Info:", json.dumps(info, indent=2))