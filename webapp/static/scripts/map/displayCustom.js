// -------------------------------------------
// displayCustom.js - Custom display method handling
// -------------------------------------------

var DisplayCustom = (function() {
  'use strict';
  
  // -------------------------------------------
  // Public API
  // -------------------------------------------
  return {
    init: init,
    handleDisplayMethodChange: handleDisplayMethodChange,
    handleCustomDisplaySubmit: handleCustomDisplaySubmit
  };
  
  // -------------------------------------------
  // Initialization
  // -------------------------------------------
  function init() {
    setupEventHandlers();
    updateWeightTypeVisibility();
  }
  
  function setupEventHandlers() {
    $("#displayMethodSelect").on("change", handleDisplayMethodChange);
    $("#submitDisplayBtn").on("click", handleCustomDisplaySubmit);
  }
  
  // -------------------------------------------
  // Event Handlers
  // -------------------------------------------
  function handleDisplayMethodChange() {
    updateWeightTypeVisibility();
  }
  
  function handleCustomDisplaySubmit() {
    // This now delegates to the main application logic
    if (typeof handleCustomDisplay === 'function') {
      handleCustomDisplay();
    } else {
      console.error("handleCustomDisplay function not found");
    }
  }
  
  // -------------------------------------------
  // UI Updates
  // -------------------------------------------
  function updateWeightTypeVisibility() {
    const method = $("#displayMethodSelect").val();
    const showWeightType = [
      "weighted_heatmap", 
      "bubble_map", 
      "gaussian_kde",
      "basic_heatmap"
    ].includes(method);
    
    $("#weightTypeRow").toggle(showWeightType);
    
    // Also show/hide advanced controls based on display method
    updateAdvancedControlsVisibility(method);
  }
  
  function updateAdvancedControlsVisibility(method) {
    const showAdvanced = [
      "animated",
      "interactive_filter",
      "comparative"
    ].includes(method);
    
    $("#advancedControls").toggle(showAdvanced);
  }
  
  // -------------------------------------------
  // Configuration Helpers
  // -------------------------------------------
  function getDisplayConfig() {
    return {
      method: $("#displayMethodSelect").val(),
      weightType: $("#weightTypeSelect").val(),
      dataFraction: parseInt($("#dataFractionSlider").val()) / 100,
      geometryTypes: getSelectedGeometryTypes(),
      showUnavailable: $("input[name='showUnavailable']:checked").val() === "show"
    };
  }
  
  function getSelectedGeometryTypes() {
    const selected = [];
    $("input[name='geomType']:checked").each(function() {
      selected.push($(this).val());
    });
    return selected;
  }
  
  // -------------------------------------------
  // Export for global access
  // -------------------------------------------
  window.DisplayCustom = {
    getDisplayConfig: getDisplayConfig,
    getSelectedGeometryTypes: getSelectedGeometryTypes
  };
  
})();

// Initialize when document is ready
$(document).ready(function() {
  DisplayCustom.init();
});