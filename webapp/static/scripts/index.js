// -------------------------------------------
// index.js - Main application orchestration (FINAL CLEAN VERSION)
// -------------------------------------------

// Global application state
var AppState = {
  currentMode: "regular",
  currentData: null,
  currentFigure: null,
  initialized: false
};

// -------------------------------------------
// Application Initialization
// -------------------------------------------
$(document).ready(function() {
  console.log("Document ready, initializing application...");
  initializeApp();
  setupEventHandlers();
  loadDefaultMap();
});

function initializeApp() {
  // Initialize data fraction slider
  $("#dataFractionSlider").on("input", function() {
    $("#dataFractionValue").text($(this).val());
  });

  // Set initial mode
  AppState.currentMode = $("#modeSelect").val() || "regular";
  updateModeDisplay(AppState.currentMode);

  // Load initial options after a brief delay to ensure everything is ready
  setTimeout(function() {
    if (typeof FilterManager !== 'undefined') {
      FilterManager.loadInitialOptions();
    } else {
      console.warn("FilterManager not available, loading states manually");
      loadStatesManually();
    }
  }, 100);

  AppState.initialized = true;
  console.log("Application initialized with mode:", AppState.currentMode);
}

function setupEventHandlers() {
  // Remove any existing handlers first
  $("#modeSelect").off("change.main");
  $("#displayMethodSelect").off("change.main");

  // Mode selection handler
  $("#modeSelect").on("change.main", handleModeChange);

  // Display method change handler
  $("#displayMethodSelect").on("change.main", handleDisplayMethodChange);

  console.log("Main event handlers setup complete");
}

// -------------------------------------------
// Event Handlers
// -------------------------------------------
function handleModeChange() {
  const newMode = $(this).val();
  console.log("Mode changing from", AppState.currentMode, "to", newMode);

  if (newMode !== AppState.currentMode) {
    AppState.currentMode = newMode;
    updateModeDisplay(newMode);
    resetFilters();

    // Load appropriate options for the new mode
    setTimeout(function() {
      if (typeof FilterManager !== 'undefined') {
        FilterManager.loadInitialOptions();
      } else if (newMode === "regular") {
        loadStatesManually();
      }
    }, 50);
  }
}

function updateModeDisplay(mode) {
  console.log("Updating display for mode:", mode);

  if (mode === "weighted") {
    $("#regularFilters").hide();
    $("#weightedFilters").show();
    loadWeightedDatasetsManually();
  } else {
    $("#weightedFilters").hide();
    $("#regularFilters").show();
    loadStatesManually();
  }
}

function handleDisplayMethodChange() {
  const method = $("#displayMethodSelect").val();
  const showWeightType = ["weighted_heatmap", "bubble_map", "gaussian_kde"].includes(method);
  $("#weightTypeRow").toggle(showWeightType);
}

// -------------------------------------------
// Manual Loading Functions (fallback)
// -------------------------------------------
function loadStatesManually() {
  console.log("Loading states manually...");

  $.ajax({
    url: "/get_options",
    method: "POST",
    dataType: "json",
    contentType: "application/json",
    data: JSON.stringify({ mode: "regular" }),
    success: function(response) {
      if (response.success && response.options.states) {
        populateStatesDropdown(response.options.states);
        console.log("States loaded successfully");
      } else {
        console.error("Failed to load states:", response.error);
      }
    },
    error: function(xhr, status, error) {
      console.error("Error loading states:", error);
    }
  });
}

function loadWeightedDatasetsManually() {
  console.log("Loading weighted datasets manually...");

  $.ajax({
    url: "/get_options",
    method: "POST",
    dataType: "json",
    contentType: "application/json",
    data: JSON.stringify({ mode: "weighted" }),
    success: function(response) {
      if (response.success && response.options.datasets) {
        populateWeightedDatasetsDropdown(response.options.datasets);
        console.log("Weighted datasets loaded successfully");
      } else {
        console.error("Failed to load weighted datasets:", response.error);
      }
    },
    error: function(xhr, status, error) {
      console.error("Error loading weighted datasets:", error);
    }
  });
}

function populateStatesDropdown(states) {
  const $stateSelect = $("#stateSelect");
  $stateSelect.empty().append('<option value="">-- Select State --</option>');

  states.forEach(state => {
    const name = typeof state === 'string' ? state : state.name || state;
    $stateSelect.append(`<option value="${name}">${name}</option>`);
  });

  $stateSelect.prop("disabled", false);
}

function populateWeightedDatasetsDropdown(datasets) {
  const $weightedSelect = $("#weightedDatasetSelect");
  $weightedSelect.empty().append('<option value="">-- Select Weighted Dataset --</option>');

  datasets.forEach(dataset => {
    const display = dataset.display || dataset.name || dataset;
    const value = dataset.value || dataset;
    $weightedSelect.append(`<option value="${value}">${display}</option>`);
  });

  $weightedSelect.prop("disabled", false);
}

// -------------------------------------------
// UI Utilities
// -------------------------------------------
function resetFilters() {
  console.log("Resetting filters for mode:", AppState.currentMode);

  if (AppState.currentMode === "regular") {
    $("#stateSelect").val("");
    resetDropdown("#countySelect", "-- Select County (optional) --");
    resetDropdown("#categorySelect", "-- Select Category (optional) --");
    resetDropdown("#datasetSelect", "-- Select Dataset (optional) --");
  } else {
    $("#weightedDatasetSelect").val("");
  }

  $("#hideUnavailable").prop("checked", true);
  $("#dataFractionSlider").val(10);
  $("#dataFractionValue").text("10");
  $("#displayMethodSelect").val("default");
  $("#weightTypeSelect").val("original");
  $("#weightTypeRow").hide();
}

function resetDropdown(selector, placeholder) {
  $(selector)
    .empty()
    .append(`<option value="">${placeholder}</option>`)
    .prop("disabled", true);
}

function showError(message) {
  console.error("Application Error:", message);
  alert("Error: " + message);
}

function showSuccess(message) {
  console.log("Success: " + message);
}

// -------------------------------------------
// Default Map Loading
// -------------------------------------------
function loadDefaultMap() {
  console.log("Loading default map");

  const defaultFig = {
    data: [{
      type: "scattermapbox",
      lat: [40.7831],
      lon: [-73.9712],
      mode: "markers",
      text: ["Default: Manhattan"],
      marker: { size: 10, color: "blue" },
      name: "Default Location"
    }],
    layout: {
      mapbox: {
        style: "open-street-map",
        center: { lat: 40.7831, lon: -73.9712 },
        zoom: 10
      },
      margin: { r: 0, t: 0, b: 0, l: 0 }
    }
  };

  // Render directly with Plotly
  Plotly.react("mapContainer", defaultFig.data, defaultFig.layout, {
    responsive: true,
    displayModeBar: true,
    scrollZoom: true
  });
}

// -------------------------------------------
// Navbar Scroll Logic (existing)
// -------------------------------------------
$(window).scroll(function() {
  if ($(document).scrollTop() > 50) {
    $('.nav').addClass('affix');
  } else {
    $('.nav').removeClass('affix');
  }
});

$('.navTrigger').click(function () {
  $(this).toggleClass('active');
  $("#mainListDiv").toggleClass("show_list");
  $("#mainListDiv").fadeIn();
});

// -------------------------------------------
// Export functions for global access
// -------------------------------------------
window.AppState = AppState;
window.showError = showError;
window.showSuccess = showSuccess;
window.resetDropdown = resetDropdown;
window.loadDefaultMap = loadDefaultMap;