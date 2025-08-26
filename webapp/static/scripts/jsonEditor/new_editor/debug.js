// ============================================================================
// 20. debug.js - Debug utilities
// ============================================================================

function debugFieldMetaState(location, action = '') {
  const timestamp = new Date().toISOString();
  console.log(`==================== FIELD META DEBUG ====================`);
  console.log(`Time: ${timestamp}`);
  console.log(`Location: ${location}`);
  console.log(`Action: ${action}`);
  console.log(`fieldMeta:`, JSON.stringify(fieldMeta, null, 2));
  console.log(`selectedFields:`, Array.from(selectedFields));
  console.log(`fieldWeights:`, fieldWeights);
  console.log(`===========================================================`);
}

function debugWorkflowState() {
  console.log('=== WORKFLOW DEBUG ===');
  console.log('Current step:', currentStep);
  console.log('Project type:', projectType);
  console.log('Project action:', projectAction);
  console.log('======================');
}

// Make debug functions globally available
window.debugFieldMeta = function() {
  debugFieldMetaState('MANUAL DEBUG', 'Called from console');
};

window.debugWorkflowState = debugWorkflowState;

console.log('Application initialized. Debug functions available: debugFieldMeta(), debugWorkflowState()');