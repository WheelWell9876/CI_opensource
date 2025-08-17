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

    // Always show the data fraction slider
    $("#advancedControls").show();
  }

  function setupEventHandlers() {
    $("#displayMethodSelect").on("change", handleDisplayMethodChange);
    $("#submitDisplayBtn").on("click", handleCustomDisplaySubmit);
    $("#modeSelect").on("change", updateWeightTypeVisibility); // Also update on mode change
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
    const mode = $("#modeSelect").val();

    // Show weight type for weighted mode and certain display methods
    const showWeightType = mode === "weighted" && [
      "weighted_heatmap",
      "bubble_map",
      "gaussian_kde",
      "basic_heatmap",
      "convex_hull",
      "default"
    ].includes(method);

    $("#weightTypeRow").toggle(showWeightType);

    // ALWAYS show advanced controls (including data fraction slider)
    $("#advancedControls").show();

    console.log(`Weight type visibility: ${showWeightType} (mode: ${mode}, method: ${method})`);
    console.log(`Advanced controls (data fraction slider) should always be visible`);
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