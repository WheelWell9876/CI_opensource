// ============================================================================
// 16. statistics.js - Statistics calculation
// ============================================================================

function updateStatsPreview() {
  const statsPreview = document.getElementById('previewStats');
  if (!statsPreview) return;

  try {
    let stats;
    if (projectType === PROJECT_TYPES.DATASET && loadedData?.features?.length) {
      stats = calculateDatasetStatistics();
    } else if (projectType === PROJECT_TYPES.CATEGORY && currentProject) {
      stats = calculateCategoryStatistics();
    } else if (projectType === PROJECT_TYPES.FEATURE_LAYER && currentProject) {
      stats = calculateFeatureLayerStatistics();
    } else {
      statsPreview.innerHTML = '<p style="color: #999;">No data available for statistics</p>';
      return;
    }

    statsPreview.innerHTML = generateStatisticsHTML(stats);
  } catch (error) {
    console.error('Error updating stats preview:', error);
    statsPreview.innerHTML = '<p style="color: #999;">Error calculating statistics</p>';
  }
}

function calculateDatasetStatistics() {
  const selectedFieldsArray = Array.from(selectedFields);
  const quantFields = selectedFieldsArray.filter(f => fieldTypes[f] === FIELD_TYPES.QUANTITATIVE).length;
  const qualFields = selectedFieldsArray.filter(f => fieldTypes[f] === FIELD_TYPES.QUALITATIVE).length;

  return {
    summary: {
      'Total Features': loadedData.features.length,
      'Selected Fields': selectedFieldsArray.length,
      'Quantitative Fields': quantFields,
      'Qualitative Fields': qualFields
    },
    details: generateFieldDetails(selectedFieldsArray)
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
    details: generateDatasetDetails(datasets)
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
    details: generateCategoryDetails(categories)
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
