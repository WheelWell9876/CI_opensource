// -------------------------------------------
// displayCustom.js - Updated for mode-specific widget visibility
// -------------------------------------------

var DisplayCustom = (function() {
  'use strict';

  // -------------------------------------------
  // Public API
  // -------------------------------------------
  return {
    init: init,
    handleDisplayMethodChange: handleDisplayMethodChange,
    handleCustomDisplaySubmit: handleCustomDisplaySubmit,
    updateHeatmapPointsVisibility: updateHeatmapPointsVisibility
  };

  // -------------------------------------------
  // Initialization
  // -------------------------------------------
  function init() {
    setupEventHandlers();
    updateWeightTypeVisibility();
    updateHeatmapPointsVisibility();

    // Always show the data fraction slider
    $("#advancedControls").show();
  }

  function setupEventHandlers() {
    $("#displayMethodSelect").on("change", handleDisplayMethodChange);
    $("#submitDisplayBtn").on("click", handleCustomDisplaySubmit);
    $("#modeSelect").on("change", function() {
      updateWeightTypeVisibility();
      updateHeatmapPointsVisibility();
    });
  }

  // -------------------------------------------
  // Event Handlers
  // -------------------------------------------
  function handleDisplayMethodChange() {
    updateWeightTypeVisibility();
    updateHeatmapPointsVisibility();
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

    // Only show weight type in weighted mode for certain display methods
    const showWeightType = mode === "weighted" && [
      "weighted_heatmap",
      "bubble_map",
      "gaussian_kde",
      "basic_heatmap",
      "convex_hull",
      "default"
    ].includes(method);

    $("#weightTypeRow").toggle(showWeightType);

    console.log(`Weight type visibility: ${showWeightType} (mode: ${mode}, method: ${method})`);
  }

  function updateHeatmapPointsVisibility() {
    const method = $("#displayMethodSelect").val();
    const mode = $("#modeSelect").val();

    // Show heatmap points toggle only for heatmap display methods in weighted mode
    const showHeatmapToggle = mode === "weighted" && [
      "basic_heatmap",
      "weighted_heatmap"
    ].includes(method);

    $("#heatmapPointsRow").toggle(showHeatmapToggle);

    console.log(`Heatmap points toggle visibility: ${showHeatmapToggle} (mode: ${mode}, method: ${method})`);
  }

  // -------------------------------------------
  // Configuration Helpers
  // -------------------------------------------
  function getDisplayConfig() {
    const config = {
      method: $("#displayMethodSelect").val(),
      weightType: $("#weightTypeSelect").val(),
      dataFraction: parseInt($("#dataFractionSlider").val()) / 100,
      geometryTypes: getSelectedGeometryTypes(),
      showUnavailable: $("input[name='showUnavailable']:checked").val() === "show"
    };

    // Add heatmap points toggle if visible and in weighted mode
    const mode = $("#modeSelect").val();
    const method = $("#displayMethodSelect").val();
    if (mode === "weighted" && ["basic_heatmap", "weighted_heatmap"].includes(method)) {
      config.showHeatmapPoints = $("input[name='showHeatmapPoints']:checked").val() === "show";
      console.log(`🔥 Heatmap points setting: ${config.showHeatmapPoints}`);
    }

    return config;
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
    getSelectedGeometryTypes: getSelectedGeometryTypes,
    updateHeatmapPointsVisibility: updateHeatmapPointsVisibility,
    updateWeightTypeVisibility: updateWeightTypeVisibility
  };
  
})();

// Initialize when document is ready
$(document).ready(function() {
  DisplayCustom.init();
});