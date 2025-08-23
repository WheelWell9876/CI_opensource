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
  const className = projectName.replace(/\s+/g, '');

  let pythonCode = '';

  if (projectType === 'dataset') {
    pythonCode = generateDatasetPythonCode(className, selectedFieldsList);
  } else if (projectType === 'category') {
    pythonCode = generateCategoryPythonCode(className, selectedFieldsList);
  } else if (projectType === 'featurelayer') {
    pythonCode = generateFeatureLayerPythonCode(className, selectedFieldsList);
  }

  pythonPreview.innerHTML = `<pre style="max-height: 400px; overflow-y: auto;"><code>${pythonCode}</code></pre>`;
}

function generateDatasetPythonCode(className, selectedFields) {
  return `import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any

class ${className}:
    """Process individual dataset with field selection and weighting."""

    def __init__(self, filepath: str):
        """Initialize with GeoJSON file path."""
        self.gdf = gpd.read_file(filepath)
        self.selected_fields = ${JSON.stringify(selectedFields)}
        self.field_weights = ${JSON.stringify(fieldWeights, null, 8)}
        self.field_types = ${JSON.stringify(fieldTypes, null, 8)}

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
        print(f"Processed data exported to: {output_path}")

# Usage example
if __name__ == "__main__":
    processor = ${className}("input_data.geojson")
    processor.export_processed_data("output_weighted.geojson")`;
}

function generateCategoryPythonCode(className, selectedFields) {
  return `import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from pathlib import Path

class ${className}:
    """Process category with multiple datasets."""

    def __init__(self, dataset_paths: List[str]):
        """Initialize with list of dataset file paths."""
        self.dataset_paths = dataset_paths
        self.datasets = [gpd.read_file(path) for path in dataset_paths]
        self.selected_fields = ${JSON.stringify(selectedFields)}
        self.field_weights = ${JSON.stringify(fieldWeights, null, 8)}
        self.field_types = ${JSON.stringify(fieldTypes, null, 8)}

    def combine_datasets(self) -> gpd.GeoDataFrame:
        """Combine all datasets in the category."""
        combined_gdfs = []

        for i, gdf in enumerate(self.datasets):
            # Add source dataset identifier
            gdf = gdf.copy()
            gdf['source_dataset'] = f'dataset_{i}'

            # Filter to selected fields
            fields_to_keep = ['geometry', 'source_dataset'] + [
                f for f in self.selected_fields if f in gdf.columns
            ]
            gdf_filtered = gdf[fields_to_keep]
            combined_gdfs.append(gdf_filtered)

        # Combine all datasets
        combined = gpd.GeoDataFrame(pd.concat(combined_gdfs, ignore_index=True))
        return combined

    def apply_weights(self) -> gpd.GeoDataFrame:
        """Apply weights to quantitative fields across all datasets."""
        gdf_combined = self.combine_datasets()
        weighted_score = pd.Series(0, index=gdf_combined.index)

        for field, weight in self.field_weights.items():
            if field in gdf_combined.columns and self.field_types.get(field) == 'quantitative':
                field_values = pd.to_numeric(gdf_combined[field], errors='coerce')
                if field_values.notna().any():
                    min_val = field_values.min()
                    max_val = field_values.max()
                    if max_val > min_val:
                        normalized = (field_values - min_val) / (max_val - min_val)
                        weighted_score += normalized * weight

        gdf_combined['weighted_score'] = weighted_score
        return gdf_combined

    def export_category(self, output_path: str):
        """Export the processed category."""
        gdf_processed = self.apply_weights()
        gdf_processed.to_file(output_path, driver='GeoJSON')
        print(f"Category exported to: {output_path}")

# Usage example
if __name__ == "__main__":
    dataset_files = ["dataset1.geojson", "dataset2.geojson", "dataset3.geojson"]
    processor = ${className}(dataset_files)
    processor.export_category("category_output.geojson")`;
}

function generateFeatureLayerPythonCode(className, selectedFields) {
  return `import geopandas as gpd
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from pathlib import Path

class ${className}:
    """Process feature layer with multiple categories."""

    def __init__(self, category_paths: Dict[str, List[str]]):
        """Initialize with dictionary of category names to dataset paths."""
        self.category_paths = category_paths
        self.selected_fields = ${JSON.stringify(selectedFields)}
        self.field_weights = ${JSON.stringify(fieldWeights, null, 8)}
        self.field_types = ${JSON.stringify(fieldTypes, null, 8)}

    def load_categories(self) -> gpd.GeoDataFrame:
        """Load and combine all categories."""
        all_gdfs = []

        for category_name, dataset_paths in self.category_paths.items():
            category_gdfs = []

            for i, path in enumerate(dataset_paths):
                gdf = gpd.read_file(path)
                gdf['source_dataset'] = f'{category_name}_dataset_{i}'
                gdf['category'] = category_name

                # Filter to selected fields
                fields_to_keep = ['geometry', 'source_dataset', 'category'] + [
                    f for f in self.selected_fields if f in gdf.columns
                ]
                gdf_filtered = gdf[fields_to_keep]
                category_gdfs.append(gdf_filtered)

            if category_gdfs:
                category_combined = gpd.GeoDataFrame(pd.concat(category_gdfs, ignore_index=True))
                all_gdfs.append(category_combined)

        # Combine all categories
        if all_gdfs:
            feature_layer = gpd.GeoDataFrame(pd.concat(all_gdfs, ignore_index=True))
            return feature_layer
        else:
            return gpd.GeoDataFrame()

    def apply_weights_by_category(self) -> gpd.GeoDataFrame:
        """Apply weights to fields, calculated separately for each category."""
        gdf_combined = self.load_categories()
        gdf_combined['weighted_score'] = 0.0

        for category in gdf_combined['category'].unique():
            category_mask = gdf_combined['category'] == category
            category_data = gdf_combined[category_mask]

            weighted_score = pd.Series(0, index=category_data.index)

            for field, weight in self.field_weights.items():
                if field in category_data.columns and self.field_types.get(field) == 'quantitative':
                    field_values = pd.to_numeric(category_data[field], errors='coerce')
                    if field_values.notna().any():
                        min_val = field_values.min()
                        max_val = field_values.max()
                        if max_val > min_val:
                            normalized = (field_values - min_val) / (max_val - min_val)
                            weighted_score += normalized * weight

            gdf_combined.loc[category_mask, 'weighted_score'] = weighted_score

        return gdf_combined

    def export_feature_layer(self, output_path: str):
        """Export the processed feature layer."""
        gdf_processed = self.apply_weights_by_category()
        gdf_processed.to_file(output_path, driver='GeoJSON')
        print(f"Feature layer exported to: {output_path}")

    def export_by_category(self, output_dir: str):
        """Export each category separately."""
        gdf_processed = self.apply_weights_by_category()
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        for category in gdf_processed['category'].unique():
            category_data = gdf_processed[gdf_processed['category'] == category]
            category_file = output_path / f"{category}.geojson"
            category_data.to_file(category_file, driver='GeoJSON')
            print(f"Category '{category}' exported to: {category_file}")

# Usage example
if __name__ == "__main__":
    categories = {
        "environmental": ["env_dataset1.geojson", "env_dataset2.geojson"],
        "infrastructure": ["infra_dataset1.geojson", "infra_dataset2.geojson"],
        "economic": ["econ_dataset1.geojson"]
    }
    processor = ${className}(categories)
    processor.export_feature_layer("feature_layer_output.geojson")
    processor.export_by_category("category_outputs/")`;
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
  debugLog('Exporting configuration');

  const config = {
    projectType: projectType,
    projectAction: projectAction,
    currentProject: currentProject,
    datasetName: currentProject?.name || 'Untitled Project',
    description: currentProject?.description || '',
    timestamp: new Date().toISOString(),
    selectedFields: Array.from(selectedFields),
    fieldTypes: fieldTypes,
    fieldWeights: fieldWeights,
    statistics: calculateCurrentStatistics()
  };

  debugLog('Configuration exported:', config);
  showMessage('Configuration exported successfully!', 'success');
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

function saveToServer() {
  debugLog('Saving configuration to server');
  const config = exportConfig();

  showMessage('Saving to server...', 'info');

  fetch('/json-editor/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showMessage('Configuration saved to server!', 'success');
    } else {
      showMessage(data.error || 'Failed to save to server', 'error');
    }
  })
  .catch(error => {
    console.error('Error saving to server:', error);
    showMessage('Error saving to server: ' + error.message, 'error');
  });
}