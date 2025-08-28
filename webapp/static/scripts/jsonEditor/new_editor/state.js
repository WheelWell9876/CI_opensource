// ============================================================================
// 2. state.js - Global state management
// ============================================================================

// Global state variables
let currentStep = 0;
let projectType = null;
let projectAction = null;
let currentProject = null;
let loadedData = null;
let selectedFields = new Set();
let fieldWeights = {};
let fieldTypes = {};
let lockedFields = new Set();
let fieldMeta = {};
let fieldAttributes = {};
let expandedFields = new Set();

// Project storage
let projects = {
  datasets: [],
  categories: [],
  featurelayers: []
};

function resetApplicationState() {
  debugLog('Resetting application state completely');
  currentStep = 0;
  projectType = null;
  projectAction = null;
  currentProject = null;
  loadedData = null;
  selectedFields = new Set();
  fieldWeights = {};
  fieldTypes = {};
  lockedFields = new Set();
  fieldMeta = {};
  fieldAttributes = {};
  expandedFields = new Set();

  // Clear any temporary data
  window.datasetProjectName = '';
  window.datasetProjectDescription = '';

  // Clear selected project highlighting
  document.querySelectorAll('.project-item').forEach(item => {
    item.classList.remove('selected', 'editing', 'viewing');
  });
}

function clearDataState() {
  debugLog('Clearing data state');
  loadedData = null;
  selectedFields = new Set();
  fieldWeights = {};
  fieldTypes = {};
  fieldMeta = {};
  fieldAttributes = {};
  lockedFields = new Set();
  expandedFields = new Set();
}

