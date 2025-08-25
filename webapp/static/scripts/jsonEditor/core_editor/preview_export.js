// preview_export.js - Preview generation and export functionality

function updatePreview() {
  debugLog('Updating preview');

  if (!loadedData && !currentProject) {
    debugLog('No loaded data or current project for preview');
    return;
  }

  try {
    // Update data preview
    const dataPreview = document.getElementById('previewData');
    if (dataPreview) {
      if (projectType === 'dataset' && loadedData && loadedData.features && loadedData.features.length > 0) {
        const sampleFeature = loadedData.features[0];
        dataPreview.innerHTML = `
          <h4>Sample Feature (1 of ${loadedData.features.length})</h4>
          <pre style="max-height: 400px; overflow-y: auto;">${JSON.stringify(sampleFeature, null, 2)}</pre>
        `;
      } else if (projectType === 'category' && currentProject) {
        dataPreview.innerHTML = `
          <h4>Category: ${currentProject.name}</h4>
          <p><strong>Description:</strong> ${currentProject.description}</p>
          <p><strong>Datasets:</strong> ${currentProject.datasets.length}</p>
          <ul>
            ${currentProject.datasets.map(id => {
              const dataset = findProject(id);
              return `<li>${dataset ? dataset.name : 'Unknown dataset'}</li>`;
            }).join('')}
          </ul>
        `;
      } else if (projectType === 'featurelayer' && currentProject) {
        dataPreview.innerHTML = `
          <h4>Feature Layer: ${currentProject.name}</h4>
          <p><strong>Description:</strong> ${currentProject.description}</p>
          <p><strong>Categories:</strong> ${currentProject.categories.length}</p>
          <ul>
            ${currentProject.categories.map(id => {
              const category = findProject(id);
              return `<li>${category ? category.name : 'Unknown category'}</li>`;
            }).join('')}
          </ul>
        `;
      }
    }

    // Update schema preview
    const schemaPreview = document.getElementById('previewSchema');
    if (schemaPreview) {
      const schema = {
        projectType: projectType,
        projectAction: projectAction,
        currentProject: currentProject ? {
          id: currentProject.id,
          name: currentProject.name,
          type: currentProject.type
        } : null,
        selectedFields: Array.from(selectedFields),
        fieldTypes: fieldTypes,
        weights: fieldWeights
      };
      schemaPreview.innerHTML = `
        <h4>Project Schema</h4>
        <pre style="max-height: 400px; overflow-y: auto;">${JSON.stringify(schema, null, 2)}</pre>
      `;
    }

    // Update Python code preview
    updatePythonPreview();

    // Update statistics preview
    updateStatsPreview();

    debugLog('Preview updated successfully');
  } catch (error) {
    console.error('Error updating preview:', error);
  }
}

function updatePythonPreview() {
  const pythonPreview = document.getElementById('previewPython');
  if (!pythonPreview) return;

  const selectedFieldsList = Array.from(selectedFields);
  const projectName = currentProject?.name || 'GeoProject';
  const className = projectName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');

  let pythonCode = '';

  try {
    if (projectType === 'dataset') {
      pythonCode = generateDatasetPythonCode(className, selectedFieldsList);
    } else if (projectType === 'category') {
      pythonCode = generateCategoryPythonCode(className, selectedFieldsList);
    } else if (projectType === 'featurelayer') {
      pythonCode = generateFeatureLayerPythonCode(className, selectedFieldsList);
    } else {
      pythonCode = '# Select a project type and configure fields to generate Python code';
    }
  } catch (error) {
    console.error('Error generating Python code:', error);
    pythonCode = `# Error generating Python code: ${error.message}\n# Please check your configuration and try again.`;
  }

  pythonPreview.innerHTML = `<pre style="max-height: 400px; overflow-y: auto;"><code>${pythonCode}</code></pre>`;
}



function generateDatasetPythonCode(className, selectedFields) {
  // Check if we have attribute data to include
  const hasAttributes = fieldAttributes && Object.keys(fieldAttributes).length > 0;
  const attributeFieldsCount = Object.values(fieldAttributes || {}).filter(attrs =>
    attrs.uniqueValues && attrs.uniqueValues.length > 0
  ).length;

  return `import geopandas as gpd
import pandas as pd
import numpy as np

class ${className}Processor:
    """Process individual dataset with field selection, weighting, and ${hasAttributes ? 'attribute-level weighting' : 'basic weighting'}."""

    def __init__(self, filepath: str):
        """Initialize with GeoJSON file path."""
        self.gdf = gpd.read_file(filepath)
        self.selected_fields = ${JSON.stringify(selectedFields, null, 8)}
        self.field_weights = ${JSON.stringify(fieldWeights, null, 8)}
        self.field_types = ${JSON.stringify(fieldTypes, null, 8)}
        self.field_meta = ${JSON.stringify(fieldMeta || {}, null, 8)}${hasAttributes ? `
        self.field_attributes = ${JSON.stringify(fieldAttributes, null, 8)}` : ''}

    def process(self):
        """Apply field selection and weights${hasAttributes ? ' with attribute-level weighting' : ''}."""
        # Filter to selected fields
        fields_to_keep = ['geometry'] + [f for f in self.selected_fields if f in self.gdf.columns]
        gdf = self.gdf[fields_to_keep].copy()

        # Apply weights to fields
        weighted_score = pd.Series(0.0, index=gdf.index)

        for field, weight in self.field_weights.items():
            if field not in gdf.columns:
                continue

            field_type = self.field_types.get(field, 'unknown')

            if field_type == 'quantitative':
                values = pd.to_numeric(gdf[field], errors='coerce')
                if values.notna().any() and values.max() > values.min():
                    normalized = (values - values.min()) / (values.max() - values.min())
                    weighted_score += normalized * weight${hasAttributes ? `

            elif field_type == 'qualitative' and hasattr(self, 'field_attributes') and field in self.field_attributes:
                # Apply attribute-level weighting
                field_score = self.calculate_attribute_weighted_score(gdf, field)
                weighted_score += field_score * weight` : ''}

        gdf['weighted_score'] = weighted_score
        return gdf${hasAttributes ? `

    def calculate_attribute_weighted_score(self, gdf, field):
        """Calculate weighted score for qualitative field based on attribute values."""
        field_attrs = self.field_attributes.get(field, {})
        attribute_weights = field_attrs.get('attributeWeights', {})

        if not attribute_weights:
            return pd.Series(0.0, index=gdf.index)

        score = pd.Series(0.0, index=gdf.index)

        # Apply weights based on attribute values
        for attr_value, weight in attribute_weights.items():
            mask = gdf[field].astype(str) == str(attr_value)
            score.loc[mask] = weight / 100.0  # Convert percentage to decimal

        return score` : ''}

    def get_field_info(self, field):
        """Get metadata for a field."""
        meta = self.field_meta.get(field, {})
        return {
            'type': self.field_types.get(field, 'unknown'),
            'weight': self.field_weights.get(field, 0),
            'meaning': meta.get('meaning', ''),
            'importance': meta.get('importance', '')
        }

    def export(self, output_path: str):
        """Export processed data."""
        processed = self.process()
        processed.to_file(output_path, driver='GeoJSON')
        print(f"Exported to: {output_path}")

# Usage
if __name__ == "__main__":
    processor = ${className}Processor("data.geojson")
    processor.export("output.geojson")`;
}

function generateCategoryPythonCode(className, selectedFields) {
  const hasWeights = currentProject && currentProject.dataset_weights && Object.keys(currentProject.dataset_weights).length > 0;
  const datasetCount = currentProject?.datasets?.length || 0;

  return `import geopandas as gpd
import pandas as pd
import numpy as np

class ${className}Processor:
    """Process category '${currentProject?.name || className}' with ${datasetCount} datasets."""

    def __init__(self, dataset_files: dict):
        """Initialize with dataset files mapping."""
        self.dataset_files = dataset_files  # {"dataset_id": "file_path"}
        self.dataset_weights = ${JSON.stringify(currentProject?.dataset_weights || {}, null, 8)}
        self.category_info = {
            'name': '${currentProject?.name || 'Unnamed Category'}',
            'description': '${currentProject?.description || 'No description'}',
            'datasets': ${JSON.stringify(currentProject?.datasets || [], null, 8)}
        }

    def process(self):
        """Combine datasets and apply category-level weighting."""
        combined = []

        for dataset_id, filepath in self.dataset_files.items():
            gdf = gpd.read_file(filepath)
            gdf['dataset_id'] = dataset_id
            gdf['dataset_weight'] = self.dataset_weights.get(dataset_id, 100) / 100

            # Include all fields from each dataset
            combined.append(gdf)

        # Combine all datasets
        if combined:
            gdf = gpd.GeoDataFrame(pd.concat(combined, ignore_index=True))

            # Apply dataset-level weighting to any existing scores
            if 'weighted_score' in gdf.columns:
                gdf['category_weighted_score'] = gdf['weighted_score'] * gdf['dataset_weight']
            else:
                gdf['category_weighted_score'] = gdf['dataset_weight']

            return gdf
        else:
            return gpd.GeoDataFrame()

    def get_category_info(self):
        """Get information about this category."""
        return self.category_info

    def print_dataset_weights(self):
        """Print dataset weight information."""
        print(f"Category: {self.category_info['name']}")
        print(f"Description: {self.category_info['description']}")
        print("\\nDataset Weights:")
        for dataset_id, weight in self.dataset_weights.items():
            print(f"  {dataset_id}: {weight:.1f}%")

    def export(self, output_path: str):
        """Export processed category."""
        processed = self.process()
        processed.to_file(output_path, driver='GeoJSON')
        print(f"Exported category to: {output_path}")
        print(f"Total features: {len(processed)}")

# Usage
if __name__ == "__main__":
    # Map dataset IDs to their file paths
    dataset_files = {
        ${currentProject?.datasets?.map(id => {
          const dataset = findProject ? findProject(id) : null;
          const name = dataset ? dataset.name : id;
          return `"${id}": "${name.replace(/[^a-zA-Z0-9]/g, '_')}.geojson"`;
        }).join(',\n        ') || '"dataset1": "dataset1.geojson"'}
    }

    processor = ${className}Processor(dataset_files)
    processor.print_dataset_weights()
    processor.export("${className.toLowerCase()}_output.geojson")`;
}

function generateFeatureLayerPythonCode(className, selectedFields) {
  const hasWeights = currentProject && currentProject.category_weights && Object.keys(currentProject.category_weights).length > 0;
  const categoryCount = currentProject?.categories?.length || 0;

  return `import geopandas as gpd
import pandas as pd
import numpy as np

class ${className}Processor:
    """Process feature layer '${currentProject?.name || className}' with ${categoryCount} categories."""

    def __init__(self, category_configs: dict):
        """
        Initialize with category configurations.

        category_configs format:
        {
            "category_id": {
                "dataset_files": {"dataset_id": "file_path"},
                "dataset_weights": {"dataset_id": weight}
            }
        }
        """
        self.category_configs = category_configs
        self.category_weights = ${JSON.stringify(currentProject?.category_weights || {}, null, 8)}
        self.feature_layer_info = {
            'name': '${currentProject?.name || 'Unnamed Feature Layer'}',
            'description': '${currentProject?.description || 'No description'}',
            'categories': ${JSON.stringify(currentProject?.categories || [], null, 8)}
        }

    def process(self):
        """Process all categories and datasets."""
        all_data = []

        for cat_id, cat_config in self.category_configs.items():
            cat_weight = self.category_weights.get(cat_id, 100) / 100
            dataset_files = cat_config.get('dataset_files', {})
            dataset_weights = cat_config.get('dataset_weights', {})

            for ds_id, filepath in dataset_files.items():
                gdf = gpd.read_file(filepath)
                gdf['category_id'] = cat_id
                gdf['dataset_id'] = ds_id
                gdf['category_weight'] = cat_weight
                gdf['dataset_weight'] = dataset_weights.get(ds_id, 100) / 100

                all_data.append(gdf)

        # Combine all data
        if all_data:
            gdf = gpd.GeoDataFrame(pd.concat(all_data, ignore_index=True))

            # Apply hierarchical weighting
            if 'weighted_score' in gdf.columns:
                # Dataset score * dataset weight * category weight
                gdf['final_score'] = gdf['weighted_score'] * gdf['dataset_weight'] * gdf['category_weight']
            else:
                gdf['final_score'] = gdf['dataset_weight'] * gdf['category_weight']

            return gdf
        else:
            return gpd.GeoDataFrame()

    def get_feature_layer_info(self):
        """Get information about this feature layer."""
        return self.feature_layer_info

    def print_hierarchy(self):
        """Print the complete weighting hierarchy."""
        print(f"Feature Layer: {self.feature_layer_info['name']}")
        print(f"Description: {self.feature_layer_info['description']}")
        print("\\nCategory Weights:")
        for cat_id, weight in self.category_weights.items():
            print(f"  {cat_id}: {weight:.1f}%")

    def export(self, output_path: str):
        """Export processed feature layer."""
        processed = self.process()
        processed.to_file(output_path, driver='GeoJSON')
        print(f"Exported feature layer to: {output_path}")
        print(f"Total features: {len(processed)}")

    def export_by_category(self, output_dir: str):
        """Export each category separately."""
        from pathlib import Path
        processed = self.process()
        Path(output_dir).mkdir(exist_ok=True)

        for cat_id in processed['category_id'].unique():
            cat_data = processed[processed['category_id'] == cat_id]
            cat_data.to_file(f"{output_dir}/{cat_id}.geojson", driver='GeoJSON')
            print(f"Exported {cat_id} to {output_dir}/{cat_id}.geojson")

# Usage
if __name__ == "__main__":
    # Configure categories with their datasets
    categories = {
        ${currentProject?.categories?.map(id => {
          const category = findProject ? findProject(id) : null;
          const name = category ? category.name : id;
          const datasets = category?.datasets || [];
          return `"${id}": {
            "dataset_files": {
                ${datasets.map(dsId => {
                  const ds = findProject ? findProject(dsId) : null;
                  const dsName = ds ? ds.name : dsId;
                  return `"${dsId}": "${dsName.replace(/[^a-zA-Z0-9]/g, '_')}.geojson"`;
                }).join(',\n                ')}
            },
            "dataset_weights": ${JSON.stringify(category?.dataset_weights || {}, null, 16)}
        }`;
        }).join(',\n        ') || '"category1": {"dataset_files": {"ds1": "dataset1.geojson"}, "dataset_weights": {"ds1": 100}}'}
    }

    processor = ${className}Processor(categories)
    processor.print_hierarchy()
    processor.export("${className.toLowerCase()}_output.geojson")
    processor.export_by_category("categories/")`;
}

function updateStatsPreview() {
  const statsPreview = document.getElementById('previewStats');
  if (!statsPreview) return;

  try {
    let stats;
    if (projectType === 'dataset' && loadedData && loadedData.features && loadedData.features.length) {
      stats = calculateDatasetStatistics();
    } else if (projectType === 'category' && currentProject) {
      stats = calculateCategoryStatistics();
    } else if (projectType === 'featurelayer' && currentProject) {
      stats = calculateFeatureLayerStatistics();
    } else {
      statsPreview.innerHTML = '<p style="color: #999;">No data available for statistics</p>';
      return;
    }

    statsPreview.innerHTML = `
      <h4>${projectType.charAt(0).toUpperCase() + projectType.slice(1)} Statistics</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
        ${Object.entries(stats.summary).map(([key, value]) => `
          <div><strong>${key}:</strong> ${value}</div>
        `).join('')}
      </div>

      ${stats.details ? `
        <h4>Detailed Information</h4>
        <div style="max-height: 300px; overflow-y: auto;">
          ${stats.details}
        </div>
      ` : ''}
    `;
  } catch (error) {
    console.error('Error updating stats preview:', error);
    statsPreview.innerHTML = '<p style="color: #999;">Error calculating statistics</p>';
  }
}

function calculateDatasetStatistics() {
  const selectedFieldsArray = Array.from(selectedFields);
  const quantFields = selectedFieldsArray.filter(f => fieldTypes[f] === 'quantitative').length;
  const qualFields = selectedFieldsArray.filter(f => fieldTypes[f] === 'qualitative').length;

  return {
    summary: {
      'Total Features': loadedData.features.length,
      'Selected Fields': selectedFieldsArray.length,
      'Quantitative Fields': quantFields,
      'Qualitative Fields': qualFields
    },
    details: selectedFieldsArray.map(field => {
      const values = loadedData.features.map(f => (f.properties || f.attributes || {})[field]);
      const type = fieldTypes[field];

      if (type === 'quantitative') {
        const numValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (numValues.length > 0) {
          return `
            <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px;">
              <strong>${field}</strong> (${type})
              <div style="font-size: 0.85rem; margin-top: 0.25rem;">
                Min: ${Math.min(...numValues)}, Max: ${Math.max(...numValues)},
                Mean: ${(numValues.reduce((a, b) => a + b, 0) / numValues.length).toFixed(2)}
              </div>
            </div>
          `;
        }
      }

      return `
        <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px;">
          <strong>${field}</strong> (${type})
          <div style="font-size: 0.85rem; margin-top: 0.25rem;">
            Unique values: ${new Set(values.filter(v => v !== null && v !== undefined)).size}
          </div>
        </div>
      `;
    }).join('')
  };
}

function calculateCategoryStatistics() {
  const datasets = currentProject.datasets.map(id => findProject(id)).filter(Boolean);

  return {
    summary: {
      'Category Name': currentProject.name,
      'Total Datasets': datasets.length,
      'Selected Fields': Array.from(selectedFields).length,
      'Created': new Date(currentProject.created_at).toLocaleDateString()
    },
    details: datasets.map(dataset => `
      <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px;">
        <strong>${dataset.name}</strong>
        <div style="font-size: 0.85rem; margin-top: 0.25rem;">
          Type: ${dataset.type || 'dataset'}<br>
          Fields: ${dataset.field_info ? Object.keys(dataset.field_info.field_types || {}).length : 'Unknown'}
        </div>
      </div>
    `).join('')
  };
}

function calculateFeatureLayerStatistics() {
  const categories = currentProject.categories.map(id => findProject(id)).filter(Boolean);
  const totalDatasets = categories.reduce((sum, cat) => sum + (cat.datasets?.length || 0), 0);

  return {
    summary: {
      'Feature Layer Name': currentProject.name,
      'Total Categories': categories.length,
      'Total Datasets': totalDatasets,
      'Selected Fields': Array.from(selectedFields).length,
      'Created': new Date(currentProject.created_at).toLocaleDateString()
    },
    details: categories.map(category => `
      <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f9f9f9; border-radius: 4px;">
        <strong>${category.name}</strong>
        <div style="font-size: 0.85rem; margin-top: 0.25rem;">
          Datasets: ${category.datasets?.length || 0}<br>
          Description: ${category.description || 'No description'}
        </div>
      </div>
    `).join('')
  };
}

// Export functions
function exportConfig() {
  debugLog('Exporting enhanced configuration with attributes');

  const config = {
    projectType: projectType,
    projectAction: projectAction,
    currentProject: currentProject,
    datasetName: document.getElementById('finalProjectName')?.value || currentProject?.name || 'Untitled Project',
    description: document.getElementById('finalProjectDescription')?.value || currentProject?.description || '',
    timestamp: new Date().toISOString(),
    selectedFields: Array.from(selectedFields),
    fieldTypes: fieldTypes,
    fieldWeights: fieldWeights,
    fieldMeta: fieldMeta || {},  // ✅ Include field metadata
    fieldAttributes: fieldAttributes || {},  // ✅ Include attribute data
    statistics: calculateCurrentStatistics(),
    version: '2.0'  // Updated version for attribute support
  };

  // Add project-specific data based on type
  if (projectType === 'dataset' && loadedData) {
    config.dataInfo = {
      totalFeatures: loadedData.features ? loadedData.features.length : 0,
      dataSource: 'uploaded'
    };
  } else if (projectType === 'category' && currentProject) {
    config.categoryInfo = {
      datasets: currentProject.datasets || [],
      datasetWeights: currentProject.dataset_weights || {}
    };
  } else if (projectType === 'featurelayer' && currentProject) {
    config.featureLayerInfo = {
      categories: currentProject.categories || [],
      categoryWeights: currentProject.category_weights || {}
    };
  }

  debugLog('Enhanced configuration exported with field metadata and attributes:', config);
  console.log('Field metadata in export:', fieldMeta);
  console.log('Field attributes in export:', fieldAttributes);

  // Log attribute summary
  Object.keys(fieldAttributes || {}).forEach(field => {
    const attrs = fieldAttributes[field];
    const uniqueCount = attrs.uniqueValues?.length || 0;
    const weightCount = Object.keys(attrs.attributeWeights || {}).length;
    const metaCount = Object.keys(attrs.attributeMeta || {}).length;
    console.log(`Attribute summary for ${field}: ${uniqueCount} values, ${weightCount} weights, ${metaCount} metadata entries`);
  });

  return config;
}

function calculateCurrentStatistics() {
  if (projectType === 'dataset') {
    return loadedData ? calculateDatasetStatistics() : null;
  } else if (projectType === 'category') {
    return currentProject ? calculateCategoryStatistics() : null;
  } else if (projectType === 'featurelayer') {
    return currentProject ? calculateFeatureLayerStatistics() : null;
  }
  return null;
}

function downloadJSON() {
  debugLog('Downloading JSON configuration');
  const config = exportConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(config.datasetName || 'project').replace(/\s+/g, '_')}_config.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function copyPython() {
  debugLog('Copying Python code');
  const pythonCode = document.querySelector('#previewPython pre code')?.textContent;
  if (pythonCode) {
    navigator.clipboard.writeText(pythonCode).then(() => {
      showMessage('Python code copied to clipboard!', 'success');
    }).catch(error => {
      console.error('Error copying to clipboard:', error);
      showMessage('Error copying to clipboard', 'error');
    });
  } else {
    showMessage('No Python code to copy', 'error');
  }
}

// Updated saveToServer function for preview_export.js
function saveToServer() {
  debugLog('Saving enhanced configuration to server with attributes');

  // Get the enhanced configuration with field metadata and attributes
  const config = exportConfig();

  // Show loading message
  showMessage('Saving enhanced configuration to server...', 'info');

  fetch('/json-editor/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        ...config,
        fieldMeta: fieldMeta || {},  // ✅ Include field metadata
        fieldAttributes: fieldAttributes || {},  // ✅ Include attribute data
        selectedFields: Array.from(selectedFields),
        fieldWeights: fieldWeights,
        fieldTypes: fieldTypes
      }
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log("Enhanced save response:", data);
    if (data.success) {
      let message = `Configuration saved to server with ID: ${data.config_id}!`;

      // Show additional info about saved data
      if (data.field_meta_count !== undefined) {
        console.log(`Field metadata entries saved: ${data.field_meta_count}`);
      }
      if (data.field_attributes_count !== undefined) {
        console.log(`Fields with attribute data saved: ${data.field_attributes_count}`);
        message += ` (${data.field_attributes_count} fields with attribute weighting)`;
      }

      showMessage(message, 'success');

      // Log debug info if available
      if (data.debug_info) {
        console.log('Save debug info:', data.debug_info);
      }
    } else {
      showMessage(data.error || 'Failed to save to server', 'error');
    }
  })
  .catch(error => {
    console.error('Error saving to server:', error);
    showMessage('Error saving to server: ' + error.message, 'error');
  });
}

// Updated exportConfig function to include field metadata
function exportConfig() {
  debugLog('Exporting configuration');

  const config = {
    projectType: projectType,
    projectAction: projectAction,
    currentProject: currentProject,
    datasetName: document.getElementById('finalProjectName')?.value || currentProject?.name || 'Untitled Project',
    description: document.getElementById('finalProjectDescription')?.value || currentProject?.description || '',
    timestamp: new Date().toISOString(),
    selectedFields: Array.from(selectedFields),
    fieldTypes: fieldTypes,
    fieldWeights: fieldWeights,
    fieldMeta: fieldMeta || {},  // ✅ Include field metadata
    statistics: calculateCurrentStatistics(),
    version: '1.0'
  };

  // Add project-specific data based on type
  if (projectType === 'dataset' && loadedData) {
    config.dataInfo = {
      totalFeatures: loadedData.features ? loadedData.features.length : 0,
      dataSource: 'uploaded' // or API info if loaded from API
    };
  } else if (projectType === 'category' && currentProject) {
    config.categoryInfo = {
      datasets: currentProject.datasets || [],
      datasetWeights: currentProject.dataset_weights || {}
    };
  } else if (projectType === 'featurelayer' && currentProject) {
    config.featureLayerInfo = {
      categories: currentProject.categories || [],
      categoryWeights: currentProject.category_weights || {}
    };
  }

  debugLog('Configuration exported with field metadata:', config);
  console.log('Field metadata in export:', fieldMeta); // Debug log
  return config;
}

// Make sure these functions are globally available
window.generateDatasetPythonCode = generateDatasetPythonCode;
window.generateCategoryPythonCode = generateCategoryPythonCode;
window.generateFeatureLayerPythonCode = generateFeatureLayerPythonCode;