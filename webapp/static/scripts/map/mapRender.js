// -------------------------------------------
// mapRenderer.js - Handles server-side map generation
// -------------------------------------------

var MapRenderer = (function() {
  'use strict';

  var currentFigure = null;
  var isLoading = false;

  // -------------------------------------------
  // Public API
  // -------------------------------------------
  return {
    generateMap: generateMap,
    renderFigure: renderFigure,
    getCurrentFigure: getCurrentFigure,
    isLoading: function() { return isLoading; }
  };

  // -------------------------------------------
  // Main map generation function
  // -------------------------------------------
function generateMap(payload) {
  if (isLoading) {
    console.warn("Map generation already in progress");
    return;
  }

  // Ensure mapStyle is attached to config
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
      handleMapResponse(response, payload);
    },
    error: function(xhr, status, error) {
      handleMapError(xhr, status, error, payload);
    },
    complete: function() {
      isLoading = false;
      setLoadingState(false);
    }
  });
}


  // -------------------------------------------
  // Response Handlers
  // -------------------------------------------
function handleMapResponse(response, originalPayload) {
  if (!response || !response.success) {
    showError("Server error: " + (response?.error || "Unknown error"));
    return;
  }

  if (!response.figure) {
    showError("No figure returned from server");
    return;
  }

  let figure = (typeof response.figure === "string")
    ? JSON.parse(response.figure)
    : response.figure;

  // Force the chosen basemap style client-side
  const chosenStyle = (originalPayload?.config?.mapStyle) || $("#basemapSelect").val() || "open-street-map";
  figure.layout = figure.layout || {};
  figure.layout.mapbox = figure.layout.mapbox || {};
  figure.layout.mapbox.style = chosenStyle;

  renderFigure(figure);
}


  function handleMapError(xhr, status, error, originalPayload) {
    console.error("Map generation failed:", {
      status: status,
      error: error,
      responseText: xhr.responseText,
      payload: originalPayload
    });

    let errorMessage = "Failed to generate map";

    try {
      const response = JSON.parse(xhr.responseText);
      if (response.error) {
        errorMessage = response.error;
      }
    } catch (e) {
      // Use default error message if JSON parsing fails
    }

    showError(errorMessage);
  }

  // -------------------------------------------
  // Figure Rendering
  // -------------------------------------------
function renderFigure(figure) {
  try {
    if (!figure.data || !figure.layout) {
      throw new Error("Invalid figure structure");
    }

    // If style somehow missing, default to current dropdown choice
    const chosenStyle = $("#basemapSelect").val() || "open-street-map";
    figure.layout.mapbox = figure.layout.mapbox || {};
    if (!figure.layout.mapbox.style) {
      figure.layout.mapbox.style = chosenStyle;
    }

    const config = {
      responsive: true,
      displayModeBar: true,
      scrollZoom: true
    };

    Plotly.react("mapContainer", figure.data, figure.layout, config);
    currentFigure = figure;
    AppState.currentFigure = figure;
  } catch (e) {
    showError("Failed to render figure: " + e.message);
    console.error(e);
  }
}


  // -------------------------------------------
  // State Management
  // -------------------------------------------
  function setLoadingState(loading) {
    isLoading = loading;

    // Update UI to show loading state
    const submitBtn = $("#submitBtn");
    const customBtn = $("#submitDisplayBtn");

    if (loading) {
      submitBtn.prop("disabled", true).text("Loading...");
      customBtn.prop("disabled", true).text("Loading...");

      // Optionally show a loading spinner on the map
      showMapLoading();
    } else {
      submitBtn.prop("disabled", false).text("Submit");
      customBtn.prop("disabled", false).text("Custom Display");

      hideMapLoading();
    }
  }

  function getCurrentFigure() {
    return currentFigure;
  }

  // -------------------------------------------
  // UI Helpers
  // -------------------------------------------
  function showMapLoading() {
    // Add a loading overlay to the map container
    const mapContainer = $("#mapContainer");
    if (mapContainer.find(".loading-overlay").length === 0) {
      mapContainer.append(`
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
        ">
          <div>Loading map...</div>
        </div>
      `);
    }
  }

  function hideMapLoading() {
    $("#mapContainer .loading-overlay").remove();
  }

  function showError(message) {
    console.error("MapRenderer Error:", message);
    if (typeof showError === 'function') {
      // Use global error handler if available
      window.showError(message);
    } else {
      alert("Map Error: " + message);
    }
  }

})();