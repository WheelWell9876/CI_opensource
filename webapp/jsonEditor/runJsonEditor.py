import os
import json
import logging
from typing import Dict, List, Any, Optional
from flask import Blueprint, render_template, request, jsonify
import geopandas as gpd
import pandas as pd
import numpy as np
from arcgis.features import FeatureLayer
import requests

logger = logging.getLogger(__name__)

# Create blueprint
json_editor_blueprint = Blueprint('json_editor', __name__)

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "static", "data")
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")

# Ensure directories exist
os.makedirs(EXPORTS_DIR, exist_ok=True)

# Pre-configured APIs
PRESET_APIS = {
    "epa-disaster": {
        "name": "EPA Disaster Debris Recovery Data",
        "url": "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/EPA_Disaster_Debris_Recovery_Data/FeatureServer/0",
        "description": "EPA disaster recovery and debris management data"
    },
    "agri-minerals": {
        "name": "Agricultural Minerals Operations",
        "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Agricultural_Minerals_Operations/FeatureServer/0",
        "description": "Agricultural mineral operations across the US"
    },
    "construction-minerals": {
        "name": "Construction Minerals Operations",
        "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Construction_Minerals_Operations/FeatureServer/0",
        "description": "Construction mineral operations data"
    },
    "usace-reservoirs": {
        "name": "USACE Reservoirs",
        "url": "https://services7.arcgis.com/n1YM8pTrFmm7L4hs/arcgis/rest/services/usace_rez/FeatureServer/0",
        "description": "US Army Corps of Engineers reservoir data"
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
            return

        # Get fields from first feature
        first_feature = self.features[0]
        properties = first_feature.get('properties', {}) or first_feature.get('attributes', {})

        for field_name, value in properties.items():
            self.fields[field_name] = []

            # Determine field type
            if isinstance(value, (int, float)):
                self.field_types[field_name] = 'quantitative'
            else:
                self.field_types[field_name] = 'qualitative'

        # Collect all values for each field
        for feature in self.features:
            props = feature.get('properties', {}) or feature.get('attributes', {})
            for field_name in self.fields:
                if field_name in props:
                    self.fields[field_name].append(props[field_name])

        # Calculate statistics
        self._calculate_statistics()

    def _calculate_statistics(self):
        """Calculate statistics for each field."""
        for field_name, values in self.fields.items():
            if self.field_types[field_name] == 'quantitative':
                numeric_values = [v for v in values if isinstance(v, (int, float))]
                if numeric_values:
                    self.field_stats[field_name] = {
                        'type': 'quantitative',
                        'count': len(numeric_values),
                        'min': min(numeric_values),
                        'max': max(numeric_values),
                        'mean': sum(numeric_values) / len(numeric_values),
                        'std': np.std(numeric_values) if len(numeric_values) > 1 else 0,
                        'median': np.median(numeric_values)
                    }
            else:
                unique_values = list(set(values))
                value_counts = {val: values.count(val) for val in unique_values}
                self.field_stats[field_name] = {
                    'type': 'qualitative',
                    'count': len(values),
                    'unique_values': len(unique_values),
                    'value_counts': value_counts,
                    'top_values': sorted(value_counts.items(), key=lambda x: x[1], reverse=True)[:10]
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
                    if isinstance(value, (int, float)):
                        # Normalize value based on field statistics
                        stats = self.field_stats.get(field_name, {})
                        min_val = stats.get('min', 0)
                        max_val = stats.get('max', 1)

                        if max_val > min_val:
                            normalized = (value - min_val) / (max_val - min_val)
                            score += normalized * weight

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
        dataset_name = config.get('dataset_name', 'dataset')

        code = f'''import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any

class {dataset_name.replace(" ", "")}Processor:
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
processor = {dataset_name.replace(" ", "")}Processor("input.geojson")
result = processor.process()
processor.export("output.geojson")
'''
        return code


# Routes
@json_editor_blueprint.route('/editor')
def editor_page():
    """Render the new editor page."""
    return render_template('editor_redesigned.html')


@json_editor_blueprint.route('/api/load_preset', methods=['POST'])
def load_preset_api():
    """Load data from a preset API."""
    try:
        data = request.get_json()
        api_key = data.get('api_key')

        if api_key not in PRESET_APIS:
            return jsonify({'error': 'Invalid API key'}), 400

        api_info = PRESET_APIS[api_key]
        api_url = api_info['url']

        # Build query URL
        query_url = f"{api_url}/query"
        params = {
            'where': '1=1',
            'outFields': '*',
            'f': 'geojson',
            'resultRecordCount': data.get('limit', 100)
        }

        # Make request
        response = requests.get(query_url, params=params)
        response.raise_for_status()

        geojson_data = response.json()

        # Process with GeoJSONProcessor
        processor = GeoJSONProcessor(geojson_data)
        field_info = processor.get_field_info()

        return jsonify({
            'success': True,
            'data': geojson_data,
            'field_info': field_info,
            'api_info': api_info
        })

    except Exception as e:
        logger.exception("Error loading preset API")
        return jsonify({'error': str(e)}), 500


@json_editor_blueprint.route('/api/load_custom', methods=['POST'])
def load_custom_api():
    """Load data from a custom API URL."""
    try:
        data = request.get_json()
        api_url = data.get('url')

        if not api_url:
            return jsonify({'error': 'URL is required'}), 400

        # Parse URL to get base
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

        # Make request
        response = requests.get(api_url, params=params)
        response.raise_for_status()

        geojson_data = response.json()

        # Process with GeoJSONProcessor
        processor = GeoJSONProcessor(geojson_data)
        field_info = processor.get_field_info()

        return jsonify({
            'success': True,
            'data': geojson_data,
            'field_info': field_info
        })

    except Exception as e:
        logger.exception("Error loading custom API")
        return jsonify({'error': str(e)}), 500


@json_editor_blueprint.route('/api/upload_file', methods=['POST'])
def upload_file():
    """Handle file upload."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Read file content
        content = file.read()
        geojson_data = json.loads(content)

        # Process with GeoJSONProcessor
        processor = GeoJSONProcessor(geojson_data)
        field_info = processor.get_field_info()

        return jsonify({
            'success': True,
            'data': geojson_data,
            'field_info': field_info,
            'filename': file.filename
        })

    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON file'}), 400
    except Exception as e:
        logger.exception("Error uploading file")
        return jsonify({'error': str(e)}), 500


@json_editor_blueprint.route('/api/process', methods=['POST'])
def process_data():
    """Process data with selected fields and weights."""
    try:
        data = request.get_json()
        geojson_data = data.get('geojson')
        config = data.get('config')

        if not geojson_data or not config:
            return jsonify({'error': 'Missing data or configuration'}), 400

        processor = GeoJSONProcessor(geojson_data)

        # Apply field selection
        selected_fields = config.get('selected_fields', [])
        filtered_data = processor.filter_fields(selected_fields)

        # Apply weights
        weights = config.get('weights', {})
        weighted_scores = processor.apply_weights(weights)

        # Add weighted scores to features
        for i, feature in enumerate(filtered_data['features']):
            if i < len(weighted_scores):
                feature['properties']['weighted_score'] = weighted_scores[i]

        # Generate Python code
        python_code = processor.generate_python_code(config)

        # Calculate summary statistics
        stats = {
            'total_features': len(filtered_data['features']),
            'selected_fields': len(selected_fields),
            'weights_applied': len(weights),
            'score_stats': {
                'min': min(weighted_scores) if weighted_scores else 0,
                'max': max(weighted_scores) if weighted_scores else 0,
                'mean': sum(weighted_scores) / len(weighted_scores) if weighted_scores else 0
            }
        }

        return jsonify({
            'success': True,
            'processed_data': filtered_data,
            'python_code': python_code,
            'statistics': stats
        })

    except Exception as e:
        logger.exception("Error processing data")
        return jsonify({'error': str(e)}), 500


@json_editor_blueprint.route('/api/export', methods=['POST'])
def export_configuration():
    """Export configuration to file."""
    try:
        data = request.get_json()
        config = data.get('config')
        export_type = data.get('type', 'json')

        if not config:
            return jsonify({'error': 'No configuration provided'}), 400

        dataset_name = config.get('dataset_name', 'dataset')
        timestamp = pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')

        if export_type == 'json':
            # Save as JSON
            filename = f"{dataset_name}_{timestamp}.json"
            filepath = os.path.join(EXPORTS_DIR, filename)

            with open(filepath, 'w') as f:
                json.dump(config, f, indent=2)

            return jsonify({
                'success': True,
                'filename': filename,
                'path': filepath
            })

        elif export_type == 'python':
            # Generate and save Python code
            geojson_data = data.get('geojson')
            processor = GeoJSONProcessor(geojson_data)
            python_code = processor.generate_python_code(config)

            filename = f"{dataset_name}_{timestamp}.py"
            filepath = os.path.join(EXPORTS_DIR, filename)

            with open(filepath, 'w') as f:
                f.write(python_code)

            return jsonify({
                'success': True,
                'filename': filename,
                'path': filepath,
                'code': python_code
            })

        else:
            return jsonify({'error': 'Invalid export type'}), 400

    except Exception as e:
        logger.exception("Error exporting configuration")
        return jsonify({'error': str(e)}), 500


@json_editor_blueprint.route('/api/save', methods=['POST'])
def save_to_server():
    """Save configuration to server database."""
    try:
        data = request.get_json()
        config = data.get('config')

        if not config:
            return jsonify({'error': 'No configuration provided'}), 400

        # Generate unique ID
        config_id = pd.Timestamp.now().strftime('%Y%m%d%H%M%S')
        dataset_name = config.get('dataset_name', 'dataset')

        # Save to JSON file (as database substitute)
        saved_configs_dir = os.path.join(DATA_DIR, 'saved_configs')
        os.makedirs(saved_configs_dir, exist_ok=True)

        filename = f"{config_id}_{dataset_name}.json"
        filepath = os.path.join(saved_configs_dir, filename)

        # Add metadata
        config['_metadata'] = {
            'id': config_id,
            'created_at': pd.Timestamp.now().isoformat(),
            'version': '1.0'
        }

        with open(filepath, 'w') as f:
            json.dump(config, f, indent=2)

        return jsonify({
            'success': True,
            'config_id': config_id,
            'message': f'Configuration saved with ID: {config_id}'
        })

    except Exception as e:
        logger.exception("Error saving to server")
        return jsonify({'error': str(e)}), 500


@json_editor_blueprint.route('/api/list_saved', methods=['GET'])
def list_saved_configs():
    """List all saved configurations."""
    try:
        saved_configs_dir = os.path.join(DATA_DIR, 'saved_configs')
        os.makedirs(saved_configs_dir, exist_ok=True)

        configs = []
        for filename in os.listdir(saved_configs_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(saved_configs_dir, filename)
                with open(filepath, 'r') as f:
                    config = json.load(f)
                    configs.append({
                        'filename': filename,
                        'dataset_name': config.get('dataset_name', 'Unknown'),
                        'created_at': config.get('_metadata', {}).get('created_at', 'Unknown'),
                        'id': config.get('_metadata', {}).get('id', filename.split('_')[0])
                    })

        # Sort by creation date
        configs.sort(key=lambda x: x['created_at'], reverse=True)

        return jsonify({
            'success': True,
            'configs': configs
        })

    except Exception as e:
        logger.exception("Error listing saved configs")
        return jsonify({'error': str(e)}), 500


@json_editor_blueprint.route('/api/load_saved/<config_id>', methods=['GET'])
def load_saved_config(config_id):
    """Load a saved configuration."""
    try:
        saved_configs_dir = os.path.join(DATA_DIR, 'saved_configs')

        # Find the config file
        config_file = None
        for filename in os.listdir(saved_configs_dir):
            if filename.startswith(config_id):
                config_file = filename
                break

        if not config_file:
            return jsonify({'error': 'Configuration not found'}), 404

        filepath = os.path.join(saved_configs_dir, config_file)
        with open(filepath, 'r') as f:
            config = json.load(f)

        return jsonify({
            'success': True,
            'config': config
        })

    except Exception as e:
        logger.exception("Error loading saved config")
        return jsonify({'error': str(e)}), 500


# Utility functions
def validate_geojson(data: Dict[str, Any]) -> bool:
    """Validate if data is proper GeoJSON."""
    if not isinstance(data, dict):
        return False

    if data.get('type') not in ['Feature', 'FeatureCollection']:
        return False

    if data['type'] == 'FeatureCollection':
        if 'features' not in data:
            return False
        if not isinstance(data['features'], list):
            return False

    return True


def extract_fields_from_feature(feature: Dict[str, Any]) -> Dict[str, Any]:
    """Extract field names and types from a feature."""
    fields = {}

    # Try both properties and attributes
    props = feature.get('properties', {}) or feature.get('attributes', {})

    for field_name, value in props.items():
        if isinstance(value, (int, float)):
            fields[field_name] = 'quantitative'
        elif isinstance(value, bool):
            fields[field_name] = 'boolean'
        elif isinstance(value, str):
            fields[field_name] = 'qualitative'
        else:
            fields[field_name] = 'unknown'

    return fields


def normalize_weights(weights: Dict[str, float]) -> Dict[str, float]:
    """Normalize weights to sum to 1."""
    total = sum(weights.values())
    if total == 0:
        return weights

    return {k: v / total for k, v in weights.items()}


# Integration with existing pipeline
def integrate_with_pipeline(config: Dict[str, Any], geojson_path: str) -> str:
    """Integrate processed configuration with existing pipeline."""
    from geo_open_source.webapp.jsonEditor.pipeline.pipeline_runner import run_pipeline
    from geo_open_source.webapp.jsonEditor.pipeline.data_cleaner import clean_dataset_dynamic
    from geo_open_source.webapp.jsonEditor.pipeline.weighting import dynamic_weighting

    try:
        # Prepare pipeline options
        selected_fields = config.get('selected_fields', [])
        weights = config.get('weights', {})

        pipeline_options = {
            'clean_config': {
                'fields_to_keep': selected_fields + ['geometry']
            },
            'weighting_config': {
                'weighting_fields': {}
            }
        }

        # Convert weights to pipeline format
        for field, weight in weights.items():
            pipeline_options['weighting_config']['weighting_fields'][field] = {
                'weights': {'default': weight},
                'importance': 1.0
            }

        # Run pipeline
        dataset_name = config.get('dataset_name', 'processed_dataset')
        output_path = run_pipeline(dataset_name, geojson_path, pipeline_options)

        return output_path

    except Exception as e:
        logger.exception("Error integrating with pipeline")
        raise


# Error handlers
@json_editor_blueprint.errorhandler(400)
def bad_request(error):
    """Handle bad request errors."""
    return jsonify({'error': 'Bad request', 'message': str(error)}), 400


@json_editor_blueprint.errorhandler(404)
def not_found(error):
    """Handle not found errors."""
    return jsonify({'error': 'Not found', 'message': str(error)}), 404


@json_editor_blueprint.errorhandler(500)
def internal_error(error):
    """Handle internal server errors."""
    return jsonify({'error': 'Internal server error', 'message': str(error)}), 500


# Register blueprint with app
def register_json_editor(app):
    """Register the JSON editor blueprint with the Flask app."""
    app.register_blueprint(json_editor_blueprint, url_prefix='/json-editor')
    logger.info("JSON Editor blueprint registered")


if __name__ == "__main__":
    # Test the processor
    test_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "id": 1,
                    "name": "Test",
                    "value": 100,
                    "category": "A"
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [0, 0]
                }
            }
        ]
    }

    processor = GeoJSONProcessor(test_data)
    info = processor.get_field_info()
    print("Field Info:", json.dumps(info, indent=2))