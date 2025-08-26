// ============================================================================
// 15. python_generation.js - Python code generation
// ============================================================================

function updatePythonPreview() {
  const pythonPreview = document.getElementById('previewPython');
  if (!pythonPreview) return;

  const selectedFieldsList = Array.from(selectedFields);
  const projectName = currentProject?.name || 'GeoProject';
  const className = projectName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');

  let pythonCode = '';

  try {
    if (projectType === PROJECT_TYPES.DATASET) {
      pythonCode = generateDatasetPythonCode(className, selectedFieldsList);
    } else if (projectType === PROJECT_TYPES.CATEGORY) {
      pythonCode = generateCategoryPythonCode(className, selectedFieldsList);
    } else if (projectType === PROJECT_TYPES.FEATURE_LAYER) {
      pythonCode = generateFeatureLayerPythonCode(className, selectedFieldsList);
    } else {
      pythonCode = '# Select a project type and configure fields to generate Python code';
    }
  } catch (error) {
    console.error('Error generating Python code:', error);
    pythonCode = `# Error generating Python code: ${error.message}`;
  }

  pythonPreview.innerHTML = `<pre style="max-height: 400px; overflow-y: auto;"><code>${pythonCode}</code></pre>`;
}

function generateDatasetPythonCode(className, selectedFieldsList) {
  const hasAttributes = fieldAttributes && Object.keys(fieldAttributes).length > 0;

  return `import geopandas as gpd
import pandas as pd
import numpy as np

class ${className}Processor:
    """Process dataset with field selection and weighting."""

    def __init__(self, filepath: str):
        self.gdf = gpd.read_file(filepath)
        self.selected_fields = ${JSON.stringify(selectedFieldsList, null, 8)}
        self.field_weights = ${JSON.stringify(fieldWeights, null, 8)}
        self.field_types = ${JSON.stringify(fieldTypes, null, 8)}
        self.field_meta = ${JSON.stringify(fieldMeta || {}, null, 8)}
        ${hasAttributes ? `self.field_attributes = ${JSON.stringify(fieldAttributes, null, 8)}` : ''}

    def process(self):
        """Apply field selection and weights."""
        fields_to_keep = ['geometry'] + [f for f in self.selected_fields if f in self.gdf.columns]
        gdf = self.gdf[fields_to_keep].copy()

        weighted_score = pd.Series(0.0, index=gdf.index)

        for field, weight in self.field_weights.items():
            if field not in gdf.columns:
                continue

            field_type = self.field_types.get(field, 'unknown')

            if field_type == 'quantitative':
                values = pd.to_numeric(gdf[field], errors='coerce')
                if values.notna().any() and values.max() > values.min():
                    normalized = (values - values.min()) / (values.max() - values.min())
                    weighted_score += normalized * weight
            ${hasAttributes ? `elif field_type == 'qualitative' and field in self.field_attributes:
                field_score = self.calculate_attribute_weighted_score(gdf, field)
                weighted_score += field_score * weight` : ''}

        gdf['weighted_score'] = weighted_score
        return gdf

    def export(self, output_path: str):
        processed = self.process()
        processed.to_file(output_path, driver='GeoJSON')
        print(f"Exported to: {output_path}")`;
}
