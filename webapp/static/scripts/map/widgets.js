// -------------------------------------------
// widgets.js - Clean submit and reset handlers
// -------------------------------------------

$(document).ready(function() {
  console.log("widgets.js loaded and ready");

  // Initialize widget handlers
  initializeWidgets();
});

function initializeWidgets() {
  // Remove any existing handlers to avoid conflicts
  $("#submitBtn").off("click.widgets");
  $("#submitDisplayBtn").off("click.widgets");
  $("#resetBtn").off("click.widgets");

  // Add clean handlers with namespace
  $("#submitBtn").on("click.widgets", handleSubmit);
  $("#submitDisplayBtn").on("click.widgets", handleCustomDisplay);
  $("#resetBtn").on("click.widgets", handleReset);

  console.log("Widget handlers initialized");
}

// -------------------------------------------
// Main Submit Handler
// -------------------------------------------
function handleSubmit() {
  console.log("Submit button clicked, mode:", AppState.currentMode);

  if (AppState.currentMode === "weighted") {
    handleWeightedSubmit();
  } else {
    handleRegularSubmit();
  }
}

function handleRegularSubmit() {
  console.log("Handling regular submit");

  const state = $("#stateSelect").val();
  const county = $("#countySelect").val();
  const category = $("#categorySelect").val();
  const dataset = $("#datasetSelect").val();

  console.log("Regular form values:", { state, county, category, dataset });

  if (!state) {
    alert("Please select a State first!");
    return;
  }

  const payload = {
    mode: "regular",
    filters: { state, county, category, dataset },
    display_method: $("#displayMethodSelect").val() || "default"
  };

  console.log("Sending regular payload:", payload);
  sendMapRequest(payload);
}

function handleWeightedSubmit() {
  console.log("Handling weighted submit");

  const dataset = $("#weightedDatasetSelect").val();
  console.log("Weighted dataset value:", dataset);

  if (!dataset) {
    alert("Please select a Weighted Dataset!");
    return;
  }

  const payload = {
    mode: "weighted",
    filters: { dataset },
    display_method: $("#displayMethodSelect").val() || "default",
    weight_type: $("#weightTypeSelect").val() || "original"
  };

  console.log("Sending weighted payload:", payload);
  sendMapRequest(payload);
}

// -------------------------------------------
// Custom Display Handler
// -------------------------------------------
function handleCustomDisplay() {
  console.log("Custom display button clicked");

  // Build payload similar to regular submit but with custom display options
  let payload;

  if (AppState.currentMode === "weighted") {
    const dataset = $("#weightedDatasetSelect").val();
    if (!dataset) {
      alert("Please select a Weighted Dataset!");
      return;
    }

    payload = {
      mode: "weighted",
      filters: { dataset },
      display_method: $("#displayMethodSelect").val() || "default",
      weight_type: $("#weightTypeSelect").val() || "original"
    };
  } else {
    const state = $("#stateSelect").val();
    if (!state) {
      alert("Please select a State first!");
      return;
    }

    payload = {
      mode: "regular",
      filters: {
        state: state,
        county: $("#countySelect").val(),
        category: $("#categorySelect").val(),
        dataset: $("#datasetSelect").val()
      },
      display_method: $("#displayMethodSelect").val() || "default"
    };
  }

  // Add advanced configuration
  payload.config = {
    dataFraction: parseInt($("#dataFractionSlider").val()) / 100,
    geometryTypes: getSelectedGeometryTypes(),
    showUnavailable: $("input[name='showUnavailable']:checked").val() === "show"
  };

  console.log("Sending custom display payload:", payload);
  sendMapRequest(payload);
}

// -------------------------------------------
// Reset Handler
// -------------------------------------------
function handleReset() {
  console.log("Reset button clicked");

  // Reset all form elements
  $("#stateSelect").val("");
  $("#countySelect").val("").prop("disabled", true);
  $("#categorySelect").val("").prop("disabled", true);
  $("#datasetSelect").val("").prop("disabled", true);
  $("#weightedDatasetSelect").val("");

  // Reset other widgets
  $("#dataFractionSlider").val(10);
  $("#dataFractionValue").text("10");
  $("#hideUnavailable").prop("checked", true);
  $("#displayMethodSelect").val("default");
  $("#weightTypeSelect").val("original");
  $("#weightTypeRow").hide();

  // Check all geometry types by default
  $("input[name='geomType']").prop("checked", true);

  // Load default map
  if (typeof loadDefaultMap === 'function') {
    loadDefaultMap();
  }

  // Clear application state
  AppState.currentData = null;
  AppState.currentFigure = null;
}

// -------------------------------------------
// Map Request Function
// -------------------------------------------
function sendMapRequest(payload) {
  console.log("Sending map request with payload:", payload);

  // Show loading state
  setLoadingState(true);

  $.ajax({
    url: "/generate_map",
    method: "POST",
    dataType: "json",
    contentType: "application/json",
    data: JSON.stringify(payload),
    success: function(response) {
      console.log("Map response received:", response);

      if (response.success && response.figure) {
        try {
          const figure = typeof response.figure === 'string'
            ? JSON.parse(response.figure)
            : response.figure;

          console.log("Rendering figure with", figure.data?.length || 0, "traces");

          // Render the map
          Plotly.react("mapContainer", figure.data, figure.layout, {
            responsive: true,
            displayModeBar: true,
            scrollZoom: true
          });

          // Update application state
          AppState.currentFigure = figure;

        } catch (error) {
          console.error("Error parsing/rendering figure:", error);
          alert("Error displaying map data");
        }
      } else {
        console.error("Map generation failed:", response.error);
        alert("Error: " + (response.error || "Unknown error"));
      }
    },
    error: function(xhr, status, error) {
      console.error("AJAX error:", status, error);
      console.error("Response text:", xhr.responseText);

      // Try to parse error response
      let errorMessage = "Failed to generate map. Check console for details.";
      try {
        const errorResponse = JSON.parse(xhr.responseText);
        if (errorResponse.error) {
          errorMessage = errorResponse.error;
        }
      } catch (e) {
        // Use default message
      }

      alert(errorMessage);
    },
    complete: function() {
      // Reset loading state
      setLoadingState(false);
    }
  });
}

// -------------------------------------------
// Helper Functions
// -------------------------------------------
function setLoadingState(isLoading) {
  const $submitBtn = $("#submitBtn");
  const $customBtn = $("#submitDisplayBtn");
  const $resetBtn = $("#resetBtn");

  if (isLoading) {
    $submitBtn.prop("disabled", true).text("Loading...");
    $customBtn.prop("disabled", true).text("Loading...");
    $resetBtn.prop("disabled", true);

    // Show loading overlay on map
    showMapLoading();
  } else {
    $submitBtn.prop("disabled", false).text("Submit");
    $customBtn.prop("disabled", false).text("Custom Display");
    $resetBtn.prop("disabled", false);

    // Hide loading overlay
    hideMapLoading();
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
  return selected;
}

// -------------------------------------------
// Export for debugging
// -------------------------------------------
window.debugWidgets = {
  handleSubmit,
  handleRegularSubmit,
  handleWeightedSubmit,
  handleCustomDisplay,
  handleReset,
  sendMapRequest
};