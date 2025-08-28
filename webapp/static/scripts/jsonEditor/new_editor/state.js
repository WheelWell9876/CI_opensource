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
  debugLog('Resetting application state');
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
}