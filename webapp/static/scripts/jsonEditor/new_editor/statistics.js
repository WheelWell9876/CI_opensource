// ============================================================================
// 16. statistics.js - Statistics calculation
// ============================================================================

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

function calculateCurrentStatistics() {
  if (projectType === PROJECT_TYPES.DATASET) {
    return loadedData ? calculateDatasetStatistics() : null;
  } else if (projectType === PROJECT_TYPES.CATEGORY) {
    return currentProject ? calculateCategoryStatistics() : null;
  } else if (projectType === PROJECT_TYPES.FEATURE_LAYER) {
    return currentProject ? calculateFeatureLayerStatistics() : null;
  }
  return null;
}
