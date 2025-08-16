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
        setLoadingState(false);
      }
    });
  }

  // -------------------------------------------
  // Response Handlers
  // -------------------------------------------
  function handleMapResponse(response, originalPayload) {
    if (!response.success) {
      showError("Server error: " + (response.error || "Unknown error"));
      return;
    }

    if (!response.figure) {
      showError("No map data received from server");
      return;
    }

    try {
      // Parse the figure JSON if it's a string
      const figure = typeof response.figure === 'string'
        ? JSON.parse(response.figure)
        : response.figure;

      renderFigure(figure);
      AppState.currentFigure = figure;

      console.log("Map successfully generated with payload:", originalPayload);

    } catch (error) {
      console.error("Error parsing figure data:", error);
      showError("Error displaying map data");
    }
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
      // Ensure the figure has the required structure
      if (!figure.data || !figure.layout) {
        throw new Error("Invalid figure structure");
      }

      // Configure Plotly options for better interactivity
      const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        scrollZoom: true
      };

      // Use Plotly.react for better performance with updates
      Plotly.react("mapContainer", figure.data, figure.layout, config);

      currentFigure = figure;

    } catch (error) {
      console.error("Error rendering figure:", error);
      showError("Error displaying map");
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