// ============================================================================
// 1. config.js - Global configuration and constants
// ============================================================================

// Global configuration
const APP_CONFIG = {
  DEBUG: true,
  VERSION: '2.0',
  STORAGE_KEY: 'geoeditor_projects',
  API_ENDPOINTS: {
    SAVE_PROJECTS: '/json-editor/api/save_projects',
    SAVE_CONFIG: '/json-editor/api/save'
  }
};

// Project type constants
const PROJECT_TYPES = {
  DATASET: 'dataset',
  CATEGORY: 'category',
  FEATURE_LAYER: 'featurelayer'
};

// Field type constants
const FIELD_TYPES = {
  QUANTITATIVE: 'quantitative',
  QUALITATIVE: 'qualitative',
  BOOLEAN: 'boolean',
  UNKNOWN: 'unknown'
};

