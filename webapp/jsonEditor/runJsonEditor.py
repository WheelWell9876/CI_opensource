import os
import json
import logging
import uuid
from datetime import datetime
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

# Constants - Fixed path structure
# Get the webapp directory (go up two levels from runJsonEditor.py)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "static", "data")
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")
API_REGISTRY_FILE = os.path.join(DATA_DIR, "api_registry.json")

# Ensure directories exist
os.makedirs(EXPORTS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

print(f"🔍 [DEBUG] BASE_DIR: {BASE_DIR}")
print(f"🔍 [DEBUG] API_REGISTRY_FILE: {API_REGISTRY_FILE}")
print(f"🔍 [DEBUG] File exists: {os.path.exists(API_REGISTRY_FILE)}")


class APIRegistry:
    """Manages the API registry with CRUD operations."""

    def __init__(self, registry_file: str):
        self.registry_file = registry_file
        print(f"🔍 [REGISTRY] Initializing with file: {registry_file}")
        self._ensure_registry_exists()

    def _ensure_registry_exists(self):
        """Create default registry if it doesn't exist."""
        if not os.path.exists(self.registry_file):
            print(f"🏗️ [REGISTRY] Creating new registry file at: {self.registry_file}")
            default_registry = {
                "apis": {
                    "epa-disaster": {
                        "id": "epa-disaster",
                        "name": "EPA Disaster Debris Recovery Data",
                        "url": "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/EPA_Disaster_Debris_Recovery_Data/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
                        "description": "EPA disaster recovery and debris management data",
                        "category": "Environmental",
                        "api_type": "built_in",
                        "created_by": "system",
                        "created_at": "2025-01-01T00:00:00Z"
                    },
                    "agri-minerals": {
                        "id": "agri-minerals",
                        "name": "Agricultural Minerals Operations",
                        "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Agricultural_Minerals_Operations/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
                        "description": "Agricultural mineral operations across the US",
                        "category": "Mining",
                        "api_type": "built_in",
                        "created_by": "system",
                        "created_at": "2025-01-01T00:00:00Z"
                    },
                    "construction-minerals": {
                        "id": "construction-minerals",
                        "name": "Construction Minerals Operations",
                        "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Construction_Minerals_Operations/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
                        "description": "Construction mineral operations data",
                        "category": "Mining",
                        "api_type": "built_in",
                        "created_by": "system",
                        "created_at": "2025-01-01T00:00:00Z"
                    },
                    "usace-reservoirs": {
                        "id": "usace-reservoirs",
                        "name": "USACE Reservoirs",
                        "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Reclamation_Reservoirs/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
                        "description": "US Army Corps of Engineers reservoir data",
                        "category": "Infrastructure",
                        "api_type": "built_in",
                        "created_by": "system",
                        "created_at": "2025-01-01T00:00:00Z"
                    },
                    "dams": {
                        "id": "dams",
                        "name": "National Dams Inventory",
                        "url": "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/NID_v1/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson",
                        "description": "National dams inventory across the United States",
                        "category": "Infrastructure",
                        "api_type": "built_in",
                        "created_by": "system",
                        "created_at": "2025-01-01T00:00:00Z"
                    }
                }
            }
            self.save_registry(default_registry)
        else:
            print(f"✅ [REGISTRY] Registry file already exists")

    def load_registry(self) -> Dict[str, Any]:
        """Load the API registry from file."""
        try:
            print(f"📖 [REGISTRY] Loading registry from: {self.registry_file}")
            with open(self.registry_file, 'r') as f:
                data = json.load(f)
                print(f"✅ [REGISTRY] Loaded {len(data.get('apis', {}))} APIs")
                return data
        except Exception as e:
            logger.error(f"Error loading API registry: {e}")
            print(f"❌ [REGISTRY] Error loading: {e}")
            return {"apis": {}}

    def save_registry(self, registry: Dict[str, Any]):
        """Save the API registry to file."""
        try:
            print(f"💾 [REGISTRY] Saving registry to: {self.registry_file}")
            os.makedirs(os.path.dirname(self.registry_file), exist_ok=True)
            with open(self.registry_file, 'w') as f:
                json.dump(registry, f, indent=2)
            print(f"✅ [REGISTRY] Registry saved successfully")
        except Exception as e:
            logger.error(f"Error saving API registry: {e}")
            print(f"❌ [REGISTRY] Error saving: {e}")
            raise

    def get_all_apis(self) -> Dict[str, Any]:
        """Get all APIs from registry."""
        registry = self.load_registry()
        return registry.get("apis", {})

    def get_apis_by_type(self, api_type: str) -> Dict[str, Any]:
        """Get APIs filtered by type (built_in, user_created, etc.)."""
        all_apis = self.get_all_apis()
        return {k: v for k, v in all_apis.items() if v.get("api_type") == api_type}

    def get_api(self, api_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific API by ID."""
        apis = self.get_all_apis()
        return apis.get(api_id)

    def add_api(self, api_data: Dict[str, Any]) -> str:
        """Add a new API to the registry."""
        registry = self.load_registry()

        # Generate ID if not provided
        api_id = api_data.get("id") or str(uuid.uuid4())

        # Ensure required fields
        api_entry = {
            "id": api_id,
            "name": api_data.get("name", "Unnamed API"),
            "url": api_data.get("url", ""),
            "description": api_data.get("description", ""),
            "category": api_data.get("category", "Custom"),
            "api_type": api_data.get("api_type", "user_created"),
            "created_by": api_data.get("created_by", "user"),
            "created_at": api_data.get("created_at", datetime.utcnow().isoformat() + "Z")
        }

        registry["apis"][api_id] = api_entry
        self.save_registry(registry)
        print(f"✅ [REGISTRY] Added new API: {api_id}")
        return api_id

    def update_api(self, api_id: str, api_data: Dict[str, Any]) -> bool:
        """Update an existing API."""
        registry = self.load_registry()
        if api_id not in registry["apis"]:
            return False

        # Don't allow updating built-in APIs
        if registry["apis"][api_id].get("api_type") == "built_in":
            return False

        # Update fields
        registry["apis"][api_id].update({
            "name": api_data.get("name", registry["apis"][api_id]["name"]),
            "url": api_data.get("url", registry["apis"][api_id]["url"]),
            "description": api_data.get("description", registry["apis"][api_id]["description"]),
            "category": api_data.get("category", registry["apis"][api_id]["category"]),
            "updated_at": datetime.utcnow().isoformat() + "Z"
        })

        self.save_registry(registry)
        return True

    def delete_api(self, api_id: str) -> bool:
        """Delete an API (only custom APIs)."""
        registry = self.load_registry()
        if api_id not in registry["apis"]:
            return False

        # Don't allow deleting built-in APIs
        if registry["apis"][api_id].get("api_type") == "built_in":
            return False

        del registry["apis"][api_id]
        self.save_registry(registry)
        return True


# Initialize API registry
print(f"🚀 [INIT] Initializing API registry...")
api_registry = APIRegistry(API_REGISTRY_FILE)


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


# Routes
@json_editor_blueprint.route('/editor')
def editor_page():
    """Render the new editor page."""
    print("🌍 [ROUTE] /editor accessed")
    return render_template('editor.html')


# API Management Routes
@json_editor_blueprint.route('/api/apis', methods=['GET'])
def list_apis():
    """Get all available APIs organized by type."""
    try:
        print("🌍 [ROUTE] /api/apis accessed via GET")

        all_apis = api_registry.get_all_apis()
        print(f"📊 [APIS] Found {len(all_apis)} total APIs")

        # Organize APIs by type
        organized_apis = {
            'built_in': [],
            'user_created': []
        }

        for api_id, api_data in all_apis.items():
            api_type = api_data.get('api_type', 'user_created')
            formatted_api = {
                'id': api_id,
                'name': api_data['name'],
                'description': api_data['description'],
                'category': api_data['category'],
                'api_type': api_type,
                'created_by': api_data.get('created_by', 'unknown'),
                'created_at': api_data.get('created_at', '')
            }

            if api_type in organized_apis:
                organized_apis[api_type].append(formatted_api)

        # Sort each type by category, then by name
        for api_type in organized_apis:
            organized_apis[api_type].sort(key=lambda x: (x['category'], x['name']))

        print(
            f"✅ [APIS] Returning {len(organized_apis['built_in'])} built-in and {len(organized_apis['user_created'])} user APIs")

        return jsonify({
            'success': True,
            'apis': organized_apis
        })
    except Exception as e:
        logger.exception("Error listing APIs")
        print(f"❌ [APIS] Error: {e}")
        return jsonify({'error': f'Error loading APIs: {str(e)}'}), 500


@json_editor_blueprint.route('/api/apis', methods=['POST'])
def create_api():
    """Create a new custom API."""
    try:
        print("🌍 [ROUTE] /api/apis accessed via POST")
        data = request.get_json()
        print(f"🔨 [CREATE] API data: {data}")

        # Validate required fields
        required_fields = ['name', 'url']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        # Test the API URL
        test_url = data['url']
        try:
            print(f"🧪 [TEST] Testing API URL: {test_url}")
            response = requests.get(test_url, timeout=10)
            response.raise_for_status()
            test_data = response.json()

            if 'features' not in test_data:
                return jsonify({'error': 'URL does not return valid GeoJSON with features'}), 400

            print(f"✅ [TEST] API URL is valid with {len(test_data.get('features', []))} features")

        except Exception as e:
            print(f"❌ [TEST] API URL validation failed: {e}")
            return jsonify({'error': f'Failed to validate API URL: {str(e)}'}), 400

        # Create API entry
        api_id = api_registry.add_api({
            'name': data['name'],
            'url': data['url'],
            'description': data.get('description', ''),
            'category': data.get('category', 'Custom'),
            'api_type': 'user_created',
            'created_by': 'user'
        })

        print(f"✅ [CREATE] Created API with ID: {api_id}")

        return jsonify({
            'success': True,
            'api_id': api_id,
            'message': 'API created successfully'
        })

    except Exception as e:
        logger.exception("Error creating API")
        print(f"❌ [CREATE] Error: {e}")
        return jsonify({'error': f'Error creating API: {str(e)}'}), 500


@json_editor_blueprint.route('/api/load_from_api', methods=['POST'])
def load_from_api():
    """Load data from an API (either registered or custom URL)."""
    try:
        print("🌍 [ROUTE] /api/load_from_api accessed via POST")
        data = request.get_json()
        print(f"🔨 [LOAD] Request data: {data}")

        api_id = data.get('api_id')
        custom_url = data.get('url')

        if api_id:
            # Load from registered API
            api_info = api_registry.get_api(api_id)
            if not api_info:
                return jsonify({'error': 'API not found'}), 404

            api_url = api_info['url']
            logger.info(f"Loading from registered API: {api_id}")
            print(f"📡 [LOAD] Using registered API: {api_id} -> {api_url}")

        elif custom_url:
            # Load from custom URL
            api_url = custom_url
            api_info = {
                'name': 'Custom URL',
                'description': 'Custom API URL provided by user'
            }
            logger.info(f"Loading from custom URL: {custom_url}")
            print(f"📡 [LOAD] Using custom URL: {custom_url}")

        else:
            return jsonify({'error': 'Either api_id or url is required'}), 400

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
        print(f"🌍 [FETCH] Final URL: {final_url}")

        # Make request with timeout
        response = requests.get(final_url, timeout=30)
        response.raise_for_status()

        geojson_data = response.json()

        # Validate that we got valid GeoJSON
        if 'features' not in geojson_data:
            logger.error(f"Invalid GeoJSON response: missing 'features' key")
            return jsonify({'error': 'Invalid data format received from API'}), 500

        feature_count = len(geojson_data.get('features', []))
        logger.info(f"Successfully loaded {feature_count} features")
        print(f"✅ [FETCH] Loaded {feature_count} features successfully")

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
            'api_info': api_info if api_id else None
        })

    except requests.exceptions.Timeout:
        logger.error("Timeout loading API")
        return jsonify({'error': 'Request timed out. The API may be slow or unavailable.'}), 504
    except requests.exceptions.RequestException as e:
        logger.exception("Request error loading API")
        return jsonify({'error': f'Error fetching data: {str(e)}'}), 500
    except Exception as e:
        logger.exception("Unexpected error loading API")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500


@json_editor_blueprint.route('/api/upload_file', methods=['POST'])
def upload_file():
    """Handle file upload."""
    print("🌍 [ROUTE] /api/upload_file accessed via POST")
    logger.info("Received file upload request")

    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        logger.info(f"Processing uploaded file: {file.filename}")
        print(f"📁 [UPLOAD] Processing file: {file.filename}")

        # Read file content
        content = file.read()

        # Try to parse as JSON
        try:
            geojson_data = json.loads(content)
            print("✅ [UPLOAD] JSON parsed successfully")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in uploaded file: {e}")
            return jsonify({'error': f'Invalid JSON format: {str(e)}'}), 400

        # Validate GeoJSON structure
        if 'features' not in geojson_data:
            return jsonify({'error': 'Invalid GeoJSON: missing "features" property'}), 400

        feature_count = len(geojson_data.get('features', []))
        logger.info(f"Successfully parsed {feature_count} features from uploaded file")
        print(f"✅ [UPLOAD] Parsed {feature_count} features")

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
        logger.exception("Error processing uploaded file")
        print(f"❌ [UPLOAD] Error: {e}")
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500


@json_editor_blueprint.route('/api/save_projects', methods=['POST'])
def save_projects():
    """Save projects to server database with weight support."""
    print("🌍 [ROUTE] /api/save_projects accessed via POST")
    logger.info("Received request to save projects")

    try:
        data = request.get_json()
        projects = data.get('projects')

        if not projects:
            return jsonify({'error': 'No projects provided'}), 400

        # Validate project structures
        for project_type in ['datasets', 'categories', 'featurelayers']:
            if project_type in projects:
                for project in projects[project_type]:
                    # Add validation for project structure
                    if not project.get('id'):
                        project['id'] = str(uuid.uuid4())

                    if not project.get('created_at'):
                        project['created_at'] = datetime.utcnow().isoformat() + "Z"

                    # Ensure weight structures exist for categories and feature layers
                    if project_type == 'categories':
                        if 'datasets' in project and 'dataset_weights' not in project:
                            # Initialize equal weights
                            equal_weight = 100.0 / len(project['datasets']) if project['datasets'] else 100.0
                            project['dataset_weights'] = {
                                dataset_id: equal_weight for dataset_id in project['datasets']
                            }

                    elif project_type == 'featurelayers':
                        if 'categories' in project and 'category_weights' not in project:
                            # Initialize equal weights
                            equal_weight = 100.0 / len(project['categories']) if project['categories'] else 100.0
                            project['category_weights'] = {
                                category_id: equal_weight for category_id in project['categories']
                            }

        # Save to JSON files (as database substitute)
        projects_dir = os.path.join(DATA_DIR, 'projects')
        os.makedirs(projects_dir, exist_ok=True)

        # Save each project type
        for project_type in ['datasets', 'categories', 'featurelayers']:
            if project_type in projects:
                filename = f"{project_type}.json"
                filepath = os.path.join(projects_dir, filename)

                with open(filepath, 'w') as f:
                    json.dump(projects[project_type], f, indent=2)

                print(f"✅ [SAVE] Saved {len(projects[project_type])} {project_type}")

        logger.info("Projects saved to server successfully")
        print(f"✅ [SAVE] Projects saved successfully")

        return jsonify({
            'success': True,
            'message': 'Projects saved successfully'
        })

    except Exception as e:
        logger.exception("Error saving projects")
        print(f"❌ [SAVE] Error: {e}")
        return jsonify({'error': f'Error saving projects: {str(e)}'}), 500


@json_editor_blueprint.route('/api/load_projects', methods=['GET'])
def load_projects():
    """Load projects from server database."""
    print("🌍 [ROUTE] /api/load_projects accessed via GET")
    logger.info("Loading projects from server")

    try:
        projects_dir = os.path.join(DATA_DIR, 'projects')
        projects = {
            'datasets': [],
            'categories': [],
            'featurelayers': []
        }

        # Load each project type if file exists
        for project_type in ['datasets', 'categories', 'featurelayers']:
            filepath = os.path.join(projects_dir, f"{project_type}.json")
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r') as f:
                        projects[project_type] = json.load(f)
                    print(f"✅ [LOAD] Loaded {len(projects[project_type])} {project_type}")
                except Exception as e:
                    print(f"❌ [LOAD] Error loading {project_type}: {e}")
                    projects[project_type] = []

        return jsonify({
            'success': True,
            'projects': projects
        })

    except Exception as e:
        logger.exception("Error loading projects")
        print(f"❌ [LOAD] Error: {e}")
        return jsonify({'error': f'Error loading projects: {str(e)}'}), 500


@json_editor_blueprint.route('/api/delete_project', methods=['DELETE'])
def delete_project():
    """Delete a specific project."""
    print("🌍 [ROUTE] /api/delete_project accessed via DELETE")

    try:
        data = request.get_json()
        project_id = data.get('project_id')
        project_type = data.get('project_type')  # 'datasets', 'categories', 'featurelayers'

        if not project_id or not project_type:
            return jsonify({'error': 'project_id and project_type are required'}), 400

        projects_dir = os.path.join(DATA_DIR, 'projects')
        filepath = os.path.join(projects_dir, f"{project_type}.json")

        if not os.path.exists(filepath):
            return jsonify({'error': f'No {project_type} file found'}), 404

        # Load current projects
        with open(filepath, 'r') as f:
            projects = json.load(f)

        # Remove the project
        projects = [p for p in projects if p.get('id') != project_id]

        # Save back to file
        with open(filepath, 'w') as f:
            json.dump(projects, f, indent=2)

        print(f"✅ [DELETE] Project {project_id} deleted from {project_type}")

        return jsonify({
            'success': True,
            'message': f'Project deleted successfully'
        })

    except Exception as e:
        logger.exception("Error deleting project")
        print(f"❌ [DELETE] Error: {e}")
        return jsonify({'error': f'Error deleting project: {str(e)}'}), 500


@json_editor_blueprint.route('/api/save', methods=['POST'])
def save_to_server():
    """Save configuration to server database."""
    print("🌍 [ROUTE] /api/save accessed via POST")
    logger.info("Received request to save configuration")

    try:
        data = request.get_json()
        config = data.get('config')

        if not config:
            return jsonify({'error': 'No configuration provided'}), 400

        # Generate unique ID
        config_id = pd.Timestamp.now().strftime('%Y%m%d%H%M%S')
        dataset_name = config.get('datasetName', 'dataset').replace(' ', '_')

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

        logger.info(f"Saved configuration {config_id} to server")
        print(f"✅ [SAVE] Saved config {config_id}")

        return jsonify({
            'success': True,
            'config_id': config_id,
            'message': f'Configuration saved with ID: {config_id}'
        })

    except Exception as e:
        logger.exception("Error saving to server")
        print(f"❌ [SAVE] Error: {e}")
        return jsonify({'error': f'Error saving: {str(e)}'}), 500


# Debug route to show registered routes
@json_editor_blueprint.route('/debug/routes')
def debug_routes():
    """Debug endpoint to show all registered routes."""
    print("🌍 [ROUTE] /debug/routes accessed")
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
    print("📘 [REGISTER] Starting blueprint registration")
    logger.info("Registering JSON Editor blueprint")

    try:
        app.register_blueprint(json_editor_blueprint, url_prefix='/json-editor')
        print("✅ [REGISTER] JSON Editor blueprint registered successfully")
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
        logger.error(f"Failed to register blueprint: {e}")
        raise


@json_editor_blueprint.route('/api/generate_python_code', methods=['POST'])
def generate_python_code():
    """Generate Python code for a project configuration."""
    print("🌍 [ROUTE] /api/generate_python_code accessed via POST")

    try:
        data = request.get_json()
        project_type = data.get('project_type')
        project_data = data.get('project_data')
        field_weights = data.get('field_weights', {})
        field_types = data.get('field_types', {})
        selected_fields = data.get('selected_fields', [])

        if not project_type or not project_data:
            return jsonify({'error': 'project_type and project_data are required'}), 400

        # Generate appropriate Python code based on project type
        if project_type == 'dataset':
            python_code = generate_dataset_python_code(project_data, selected_fields, field_weights, field_types)
        elif project_type == 'category':
            python_code = generate_category_python_code(project_data, selected_fields, field_weights, field_types)
        elif project_type == 'featurelayer':
            python_code = generate_featurelayer_python_code(project_data, selected_fields, field_weights, field_types)
        else:
            return jsonify({'error': f'Unsupported project type: {project_type}'}), 400

        return jsonify({
            'success': True,
            'python_code': python_code
        })

    except Exception as e:
        logger.exception("Error generating Python code")
        print(f"❌ [GENERATE] Error: {e}")
        return jsonify({'error': f'Error generating Python code: {str(e)}'}), 500


def generate_dataset_python_code(project_data, selected_fields, field_weights, field_types):
    """Generate Python code for dataset processing."""
    class_name = project_data.get('name', 'Dataset').replace(' ', '').replace('-', '')

    return f'''import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any

class {class_name}Processor:
    """Process {project_data.get('name', 'dataset')} with field selection and weighting."""

    def __init__(self, filepath: str):
        """Initialize with GeoJSON file path."""
        self.gdf = gpd.read_file(filepath)
        self.selected_fields = {selected_fields}
        self.field_weights = {dict(field_weights)}
        self.field_types = {dict(field_types)}

    def filter_fields(self) -> gpd.GeoDataFrame:
        """Filter GeoDataFrame to include only selected fields."""
        fields_to_keep = ['geometry'] + [f for f in self.selected_fields
                                         if f in self.gdf.columns]
        return self.gdf[fields_to_keep]

    def apply_weights(self) -> gpd.GeoDataFrame:
        """Apply weights to quantitative fields."""
        gdf_filtered = self.filter_fields()
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

    def export_processed_data(self, output_path: str):
        """Export the processed GeoDataFrame."""
        gdf_processed = self.apply_weights()
        gdf_processed.to_file(output_path, driver='GeoJSON')
        print(f"Processed data exported to: {{output_path}}")

# Usage example
if __name__ == "__main__":
    processor = {class_name}Processor("input_data.geojson")
    processor.export_processed_data("output_weighted.geojson")'''


def generate_category_python_code(project_data, selected_fields, field_weights, field_types):
    """Generate Python code for category processing with dataset weights."""
    class_name = project_data.get('name', 'Category').replace(' ', '').replace('-', '')
    dataset_weights = project_data.get('dataset_weights', {})

    return f'''import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from pathlib import Path

class {class_name}Processor:
    """Process {project_data.get('name', 'category')} with multiple datasets and weights."""

    def __init__(self, dataset_paths: Dict[str, str]):
        """Initialize with dictionary of dataset_id to file path."""
        self.dataset_paths = dataset_paths
        self.dataset_weights = {dict(dataset_weights)}
        self.selected_fields = {selected_fields}
        self.field_weights = {dict(field_weights)}
        self.field_types = {dict(field_types)}

    def load_and_weight_datasets(self) -> gpd.GeoDataFrame:
        """Load datasets and apply dataset-level weights."""
        combined_gdfs = []

        for dataset_id, file_path in self.dataset_paths.items():
            # Load dataset
            gdf = gpd.read_file(file_path)

            # Add dataset metadata
            gdf['source_dataset_id'] = dataset_id
            gdf['dataset_weight'] = self.dataset_weights.get(dataset_id, 1.0) / 100.0

            # Filter to selected fields
            fields_to_keep = ['geometry', 'source_dataset_id', 'dataset_weight'] + [
                f for f in self.selected_fields if f in gdf.columns
            ]
            gdf_filtered = gdf[fields_to_keep]

            combined_gdfs.append(gdf_filtered)

        # Combine all datasets
        if combined_gdfs:
            return gpd.GeoDataFrame(pd.concat(combined_gdfs, ignore_index=True))
        else:
            return gpd.GeoDataFrame()

    def apply_field_weights(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Apply field-level weights to quantitative fields."""
        weighted_score = pd.Series(0, index=gdf.index)

        for field, weight in self.field_weights.items():
            if field in gdf.columns and self.field_types.get(field) == 'quantitative':
                field_values = pd.to_numeric(gdf[field], errors='coerce')
                if field_values.notna().any():
                    min_val = field_values.min()
                    max_val = field_values.max()
                    if max_val > min_val:
                        normalized = (field_values - min_val) / (max_val - min_val)
                        weighted_score += normalized * weight / 100.0

        # Apply dataset weights to the field-weighted score
        gdf['field_weighted_score'] = weighted_score
        gdf['final_weighted_score'] = gdf['field_weighted_score'] * gdf['dataset_weight']

        return gdf

    def process_category(self) -> gpd.GeoDataFrame:
        """Process the entire category with all weights applied."""
        gdf_combined = self.load_and_weight_datasets()
        return self.apply_field_weights(gdf_combined)

    def export_category(self, output_path: str):
        """Export the processed category."""
        gdf_processed = self.process_category()
        gdf_processed.to_file(output_path, driver='GeoJSON')
        print(f"Category exported to: {{output_path}}")

# Usage example
if __name__ == "__main__":
    # Map dataset IDs to file paths
    dataset_files = {{
        "dataset_1": "dataset1.geojson",
        "dataset_2": "dataset2.geojson",
        # Add more datasets as needed
    }}

    processor = {class_name}Processor(dataset_files)
    processor.export_category("category_output.geojson")'''


def generate_featurelayer_python_code(project_data, selected_fields, field_weights, field_types):
    """Generate Python code for feature layer processing with category weights."""
    class_name = project_data.get('name', 'FeatureLayer').replace(' ', '').replace('-', '')
    category_weights = project_data.get('category_weights', {})

    return f'''import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from pathlib import Path

class {class_name}Processor:
    """Process {project_data.get('name', 'feature layer')} with multiple categories and weights."""

    def __init__(self, category_configs: Dict[str, Dict]):
        """
        Initialize with category configurations.

        category_configs format:
        {{
            "category_id": {{
                "dataset_paths": {{"dataset_id": "file_path"}},
                "dataset_weights": {{"dataset_id": weight_percentage}}
            }}
        }}
        """
        self.category_configs = category_configs
        self.category_weights = {dict(category_weights)}
        self.selected_fields = {selected_fields}
        self.field_weights = {dict(field_weights)}
        self.field_types = {dict(field_types)}

    def process_category(self, category_id: str, config: Dict) -> gpd.GeoDataFrame:
        """Process a single category with its datasets."""
        combined_gdfs = []
        category_weight = self.category_weights.get(category_id, 1.0) / 100.0

        for dataset_id, file_path in config['dataset_paths'].items():
            # Load dataset
            gdf = gpd.read_file(file_path)

            # Add metadata
            gdf['source_category_id'] = category_id
            gdf['source_dataset_id'] = dataset_id
            gdf['category_weight'] = category_weight

            # Get dataset weight from category config
            dataset_weights = config.get('dataset_weights', {{}})
            dataset_weight = dataset_weights.get(dataset_id, 1.0) / 100.0
            gdf['dataset_weight'] = dataset_weight

            # Filter to selected fields
            fields_to_keep = [
                'geometry', 'source_category_id', 'source_dataset_id', 
                'category_weight', 'dataset_weight'
            ] + [f for f in self.selected_fields if f in gdf.columns]

            gdf_filtered = gdf[fields_to_keep]
            combined_gdfs.append(gdf_filtered)

        if combined_gdfs:
            return gpd.GeoDataFrame(pd.concat(combined_gdfs, ignore_index=True))
        else:
            return gpd.GeoDataFrame()

    def apply_field_weights(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Apply field-level weights to quantitative fields."""
        weighted_score = pd.Series(0, index=gdf.index)

        for field, weight in self.field_weights.items():
            if field in gdf.columns and self.field_types.get(field) == 'quantitative':
                field_values = pd.to_numeric(gdf[field], errors='coerce')
                if field_values.notna().any():
                    min_val = field_values.min()
                    max_val = field_values.max()
                    if max_val > min_val:
                        normalized = (field_values - min_val) / (max_val - min_val)
                        weighted_score += normalized * weight / 100.0

        # Apply hierarchical weights: field -> dataset -> category
        gdf['field_weighted_score'] = weighted_score
        gdf['dataset_weighted_score'] = gdf['field_weighted_score'] * gdf['dataset_weight']
        gdf['final_weighted_score'] = gdf['dataset_weighted_score'] * gdf['category_weight']

        return gdf

    def process_feature_layer(self) -> gpd.GeoDataFrame:
        """Process the entire feature layer with all categories."""
        all_categories = []

        for category_id, config in self.category_configs.items():
            category_gdf = self.process_category(category_id, config)
            if not category_gdf.empty:
                all_categories.append(category_gdf)

        if all_categories:
            combined_gdf = gpd.GeoDataFrame(pd.concat(all_categories, ignore_index=True))
            return self.apply_field_weights(combined_gdf)
        else:
            return gpd.GeoDataFrame()

    def export_feature_layer(self, output_path: str):
        """Export the processed feature layer."""
        gdf_processed = self.process_feature_layer()
        gdf_processed.to_file(output_path, driver='GeoJSON')
        print(f"Feature layer exported to: {{output_path}}")

    def export_by_category(self, output_dir: str):
        """Export each category separately."""
        gdf_processed = self.process_feature_layer()
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        for category_id in self.category_configs.keys():
            category_data = gdf_processed[gdf_processed['source_category_id'] == category_id]
            if not category_data.empty:
                category_file = output_path / f"{{category_id}}.geojson"
                category_data.to_file(category_file, driver='GeoJSON')
                print(f"Category '{{category_id}}' exported to: {{category_file}}")

# Usage example
if __name__ == "__main__":
    # Configure categories with their datasets
    categories = {{
        "environmental": {{
            "dataset_paths": {{
                "air_quality": "air_quality.geojson",
                "water_sources": "water_sources.geojson"
            }},
            "dataset_weights": {{
                "air_quality": 60.0,
                "water_sources": 40.0
            }}
        }},
        "infrastructure": {{
            "dataset_paths": {{
                "roads": "roads.geojson",
                "utilities": "utilities.geojson"
            }},
            "dataset_weights": {{
                "roads": 70.0,
                "utilities": 30.0
            }}
        }}
    }}

    processor = {class_name}Processor(categories)
    processor.export_feature_layer("feature_layer_output.geojson")
    processor.export_by_category("category_outputs/")'''




print("🏁 [INIT] runJsonEditor.py initialization complete")

if __name__ == "__main__":
    # Test the API registry
    print("🧪 [TEST] Testing API registry...")
    test_apis = api_registry.get_all_apis()
    print(f"🧪 [TEST] Found {len(test_apis)} APIs in registry")
    for api_id, api_data in test_apis.items():
        print(f"  🔗 {api_id}: {api_data.get('name', 'Unknown')}")
    print("🧪 [TEST] Registry test complete")