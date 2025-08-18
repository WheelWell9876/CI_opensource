// -------------------------------------------
// widgets.js - Enhanced debugging version
// -------------------------------------------

$(document).ready(function() {
  console.log("🚀 Enhanced DEBUG widgets.js loaded and ready");

  // Initialize widget handlers
  initializeWidgets();

  // Add debug panel to DOM
  addDebugPanel();
});

function addDebugPanel() {
  // Add a debug panel to the page
  const debugPanel = `
    <div id="debugPanel" style="
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      max-height: 400px;
      background: rgba(0,0,0,0.9);
      color: #00ff00;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 5px;
      z-index: 9999;
      overflow-y: auto;
      border: 2px solid #00ff00;
    ">
      <div style="margin-bottom: 10px; font-weight: bold; color: #ffff00;">
        🔍 DEBUG PANEL
        <button onclick="$('#debugPanel').toggle()" style="float: right; background: #333; color: #fff; border: none; cursor: pointer;">Toggle</button>
      </div>
      <div id="debugLog"></div>
    </div>
  `;

  $('body').append(debugPanel);
}

function debugLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: '#00ff00',
    warn: '#ffff00',
    error: '#ff0000',
    success: '#00ffff'
  };

  const logEntry = `<div style="color: ${colors[type]}; margin: 2px 0;">[${timestamp}] ${message}</div>`;
  $('#debugLog').prepend(logEntry);

  // Keep only last 20 entries
  $('#debugLog div').slice(20).remove();

  console.log(`🔍 DEBUG: ${message}`);
}

function initializeWidgets() {
  // Remove any existing handlers to avoid conflicts - be more aggressive
  $("#submitBtn").off();
  $("#resetBtn").off();
  $("#dataFractionSlider").off();

  // Add clean handlers with namespace - REMOVED CUSTOM DISPLAY BUTTON
  $("#submitBtn").on("click.widgets", handleSubmit);
  $("#resetBtn").on("click.widgets", handleReset);

  // Add data fraction slider handler
  $("#dataFractionSlider").on("input.widgets", handleDataFractionChange);

  // Initialize the slider value display
  initializeDataFractionSlider();

  debugLog("Widget handlers initialized (Custom Display button removed)", "success");

  // Debug: verify the handlers are attached
  console.log("🔍 Verifying button handlers:");
  console.log("  - Submit button handlers:", $._data($('#submitBtn')[0], 'events'));
}

// -------------------------------------------
// Data Fraction Slider Handler
// -------------------------------------------
function handleDataFractionChange() {
  const value = $("#dataFractionSlider").val();
  $("#dataFractionValue").text(value);

  debugLog(`🎚️ Data fraction changed to: ${value}%`, "info");
  console.log(`🎚️ Data fraction changed to: ${value}%`);
}

function initializeDataFractionSlider() {
  const initialValue = $("#dataFractionSlider").val();
  $("#dataFractionValue").text(initialValue);

  debugLog(`🎚️ Data fraction slider initialized at ${initialValue}%`, "info");
  console.log(`🎚️ Data fraction slider initialized at ${initialValue}%`);
}

// -------------------------------------------
// Main Submit Handler
// -------------------------------------------
function handleSubmit() {
  const mode = AppState.currentMode;
  debugLog(`📤 Submit button clicked, mode: ${mode}`, "info");

  if (mode === "weighted") {
    handleWeightedSubmit();
  } else {
    handleRegularSubmit();
  }
}

function getConfigWithHeatmapSettings() {
  const dataFraction = parseInt($("#dataFractionSlider").val()) / 100;
  const geometryTypes = getSelectedGeometryTypes();
  const showUnavailable = $("input[name='showUnavailable']:checked").val() === "show";
  const mapStyle = $("#basemapSelect").val() || "open-street-map";

  const config = {
    dataFraction,
    data_fraction: dataFraction, // Support both naming conventions
    geometryTypes,
    geometry_types: geometryTypes, // Support both naming conventions
    showUnavailable,
    mapStyle,
    map_style: mapStyle // Support both naming conventions
  };

  // Add heatmap points toggle if heatmap method is selected
  const displayMethod = $("#displayMethodSelect").val();
  if (["basic_heatmap", "weighted_heatmap"].includes(displayMethod)) {
    const showHeatmapPoints = $("input[name='showHeatmapPoints']:checked").val() === "show";
    config.showHeatmapPoints = showHeatmapPoints;
    config.show_heatmap_points = showHeatmapPoints; // Support both naming conventions

    debugLog(`🔥 Heatmap display method detected: ${displayMethod}`, "info");
    debugLog(`🔥 Show heatmap points: ${showHeatmapPoints}`, "info");
  }

  return config;
}

function handleRegularSubmit() {
  debugLog("🔄 Handling regular submit", "info");

  const state = $("#stateSelect").val();
  const county = $("#countySelect").val();
  const category = $("#categorySelect").val();
  const dataset = $("#datasetSelect").val();

  debugLog(`📋 Regular form values: state=${state}, county=${county}, category=${category}, dataset=${dataset}`, "info");

  if (!state) {
    debugLog("❌ No state selected", "error");
    alert("Please select a State first!");
    return;
  }

  const config = getConfigWithHeatmapSettings();

  const payload = {
    mode: "regular",
    filters: { state, county, category, dataset },
    display_method: $("#displayMethodSelect").val() || "default",
    config: config
  };

  debugLog(`🎚️ Regular submit with config: ${JSON.stringify(config)}`, "info");
  debugLog(`📤 Sending regular payload: ${JSON.stringify(payload)}`, "info");
  sendMapRequest(payload);
}


function handleWeightedSubmit() {
  debugLog("🔄 Handling weighted submit", "info");

  const dataset = $("#weightedDatasetSelect").val();
  const displayMethod = $("#displayMethodSelect").val() || "default";
  const weightType = $("#weightTypeSelect").val() || "original";

  debugLog(`📋 Weighted form values: dataset=${dataset}, displayMethod=${displayMethod}, weightType=${weightType}`, "info");

  if (!dataset) {
    debugLog("❌ No weighted dataset selected", "error");
    alert("Please select a Weighted Dataset!");
    return;
  }

  const config = getConfigWithHeatmapSettings();

  const payload = {
    mode: "weighted",
    filters: { dataset },
    display_method: displayMethod,
    weight_type: weightType,
    config: config
  };

  debugLog(`🎚️ Weighted submit with config: ${JSON.stringify(config)}`, "info");
  debugLog(`🎨 Display method: ${displayMethod}`, "info");
  debugLog(`📤 Sending weighted payload: ${JSON.stringify(payload)}`, "info");
  sendMapRequest(payload);
}


// -------------------------------------------
// Custom Display Handler - Now same as regular handlers
// -------------------------------------------
function handleCustomDisplay() {
  debugLog("🎨 Custom display button clicked", "warn");

  // Custom Display now just calls the same handler as regular submit
  // since both now include config data
  const mode = AppState.currentMode;

  if (mode === "weighted") {
    handleWeightedSubmit();
  } else {
    handleRegularSubmit();
  }
}

// -------------------------------------------
// Reset Handler
// -------------------------------------------
function handleReset() {
  debugLog("🔄 Reset button clicked", "info");

  // Reset all form elements
  $("#stateSelect").val("");
  $("#countySelect").val("").prop("disabled", true);
  $("#categorySelect").val("").prop("disabled", true);
  $("#datasetSelect").val("").prop("disabled", true);
  $("#weightedDatasetSelect").val("");

  // Reset other widgets
  $("#basemapSelect").val("open-street-map");
  $("#dataFractionSlider").val(10);
  $("#dataFractionValue").text("10");
  $("#hideUnavailable").prop("checked", true);

  // Reset weighted-specific controls
  $("#displayMethodSelect").val("default");
  $("#weightTypeSelect").val("original");
  $("#hideHeatmapPoints").prop("checked", true);

  // Hide weighted-specific controls (will be shown/hidden based on mode)
  $("#weightTypeRow").hide();
  $("#heatmapPointsRow").hide();

  // Check all geometry types by default
  $("input[name='geomType']").prop("checked", true);

  // Reset mode to regular
  $("#modeSelect").val("regular");
  AppState.currentMode = "regular";

  // Update mode display to hide weighted controls
  updateModeDisplay("regular");

  // Load default map in the chosen style
  loadDefaultMap();

  // Clear app state
  AppState.currentData = null;
  AppState.currentFigure = null;

  debugLog("✅ Reset complete - back to regular mode", "success");
}


// -------------------------------------------
// Enhanced Map Request Function
// -------------------------------------------
function sendMapRequest(payload) {
  debugLog(`🌐 Sending map request with payload...`, "info");
  debugLog(`📊 Payload details: ${JSON.stringify(payload, null, 2)}`, "info");

  // Make sure mapStyle is present, even if called from elsewhere
  if (!payload.config) payload.config = {};
  if (!payload.config.mapStyle) {
    payload.config.mapStyle = $("#basemapSelect").val() || "open-street-map";
  }

  setLoadingState(true);

  $.ajax({
    url: "/generate_map",
    method: "POST",
    dataType: "json",
    contentType: "application/json",
    data: JSON.stringify(payload),
    success: function(response) {
      setLoadingState(false);

      if (response && response.success) {
        try {
          const figure = (typeof response.figure === "string")
            ? JSON.parse(response.figure)
            : response.figure;

          // 🔒 Enforce the chosen basemap client-side regardless of server defaults
          const chosenStyle = payload.config.mapStyle || "open-street-map";
          figure.layout = figure.layout || {};
          figure.layout.mapbox = figure.layout.mapbox || {};
          figure.layout.mapbox.style = chosenStyle;

          Plotly.react("mapContainer", figure.data, figure.layout, {
            responsive: true,
            displayModeBar: true,
            scrollZoom: true
          });

          AppState.currentFigure = figure;
          debugLog(`🗺️ Map rendered successfully`, "success");
        } catch (error) {
          debugLog(`❌ Error parsing/rendering figure: ${error.message}`, "error");
          console.error("Error parsing/rendering figure:", error);
          alert("Error displaying map data");
        }
      } else {
        debugLog(`❌ Map generation failed: ${response?.error || 'Unknown error'}`, "error");
        console.error("Map generation failed:", response?.error);
        alert("Error: " + (response?.error || "Unknown error"));
      }
    },
    error: function(xhr, status, error) {
      setLoadingState(false);
      debugLog(`❌ AJAX error: ${status} - ${error}`, "error");
      console.error("AJAX error:", status, error, xhr?.responseText);
      alert("Failed to generate map. Check console for details.");
    }
  });
}


// -------------------------------------------
// Helper Functions
// -------------------------------------------
function setLoadingState(isLoading) {
  const $submitBtn = $("#submitBtn");
  const $resetBtn = $("#resetBtn");

  if (isLoading) {
    $submitBtn.prop("disabled", true).text("Loading...");
    $resetBtn.prop("disabled", true);
    showMapLoading();
    debugLog("🔄 Loading state enabled", "info");
  } else {
    $submitBtn.prop("disabled", false).text("Generate Map");
    $resetBtn.prop("disabled", false);
    hideMapLoading();
    debugLog("✅ Loading state disabled", "info");
  }
}

function showMapLoading() {
  const $mapContainer = $("#mapContainer");
  if ($mapContainer.find(".loading-overlay").length === 0) {
    $mapContainer.append(`
      <div class="loading-overlay" style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        font-size: 18px;
      ">
        <div>🗺️ Generating map...</div>
      </div>
    `);
  }
}

function hideMapLoading() {
  $("#mapContainer .loading-overlay").remove();
}

function getSelectedGeometryTypes() {
  const selected = [];
  $("input[name='geomType']:checked").each(function() {
    selected.push($(this).val());
  });
  debugLog(`🔍 Selected geometry types: ${selected.join(', ')}`, "info");
  return selected;
}

// -------------------------------------------
// Export for debugging
// -------------------------------------------
window.debugWidgets = {
  handleSubmit,
  handleRegularSubmit,
  handleWeightedSubmit,
  handleReset,
  sendMapRequest,
  debugLog,
  handleDataFractionChange,
  initializeDataFractionSlider
};