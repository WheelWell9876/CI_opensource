// Debug and initialization check
$(document).ready(function() {
  console.log("=== APPLICATION STARTUP DEBUG ===");
  console.log("Available objects:", {
    AppState: typeof AppState,
    FilterManager: typeof FilterManager,
    jQuery: typeof $,
    Plotly: typeof Plotly
  });

  // Check if all required elements exist
  const requiredElements = [
    '#modeSelect', '#stateSelect', '#countySelect',
    '#categorySelect', '#datasetSelect', '#weightedDatasetSelect',
    '#submitBtn', '#resetBtn', '#mapContainer', '#dataFractionSlider'
  ];

  requiredElements.forEach(selector => {
    const element = $(selector);
    if element.length === 0) {
      console.error("Missing required element:", selector);
    } else {
      console.log("Found element:", selector);
    }
  });

  console.log("=== END STARTUP DEBUG ===");
});

// Add this script to your HTML to ensure hover boxes work correctly
$(document).ready(function() {
    // Function to fix hover box sizing after plot is rendered
    function fixHoverBoxes() {
        // Wait a bit for the plot to fully render
        setTimeout(function() {
            // Target all hover text elements and ensure they have fixed sizing
            $('.js-plotly-plot .plotly .hoverlayer .hovertext').css({
                'width': '300px',
                'height': '250px',
                'max-width': '300px',
                'max-height': '250px',
                'min-width': '300px',
                'min-height': '250px',
                'overflow-y': 'auto',
                'overflow-x': 'hidden',
                'white-space': 'normal',
                'word-wrap': 'break-word',
                'display': 'block',
                'visibility': 'visible'
            });
        }, 100);
    }

    // Fix hover boxes whenever the plot is updated
    $(document).on('plotly_hover plotly_relayout plotly_redraw', '#mapContainer', function() {
        fixHoverBoxes();
    });

    // Also fix on initial load
    $(document).on('plotly_afterplot', '#mapContainer', function() {
        fixHoverBoxes();
    });

    // Fallback: periodically check and fix hover boxes
    setInterval(function() {
        $('.js-plotly-plot .plotly .hoverlayer .hovertext').each(function() {
            const $hoverBox = $(this);
            if ($hoverBox.is(':visible') && ($hoverBox.width() !== 300 || $hoverBox.height() !== 250)) {
                $hoverBox.css({
                    'width': '300px',
                    'height': '250px',
                    'max-width': '300px',
                    'max-height': '250px',
                    'overflow-y': 'auto',
                    'overflow-x': 'hidden'
                });
            }
        });
    }, 500);
});

// Alternative approach: Override Plotly's hover behavior
if (typeof Plotly !== 'undefined') {
    // Store original hover function
    const originalHover = Plotly.Fx.hover;

    // Override with our custom sizing
    Plotly.Fx.hover = function(gd, hoverData, hoverMode) {
        const result = originalHover.apply(this, arguments);

        // Apply our fixed sizing after hover is created
        setTimeout(function() {
            $('.js-plotly-plot .plotly .hoverlayer .hovertext').css({
                'width': '300px !important',
                'height': '250px !important',
                'overflow-y': 'auto !important',
                'overflow-x': 'hidden !important'
            });
        }, 10);

        return result;
    };
}

$(document).ready(function() {
  // Simple debug logging for custom display
  $('#submitDisplayBtn').on('click', function() {
      const mode = $('#modeSelect').val();
      const displayMethod = $('#displayMethodSelect').val();
      const weightType = $('#weightTypeSelect').val();
      const dataset = $('#weightedDatasetSelect').val();

      console.log("🎨 CUSTOM DISPLAY CLICKED:");
      console.log("  Mode:", mode);
      console.log("  Display Method:", displayMethod);
      console.log("  Weight Type:", weightType);
      console.log("  Dataset:", dataset);

      // Show what payload will be sent
      if (mode === "weighted") {
          const payload = {
              mode: "weighted",
              filters: { dataset: dataset },
              display_method: displayMethod,
              weight_type: weightType,
              config: {
                  dataFraction: parseInt($('#dataFractionSlider').val()) / 100,
                  geometryTypes: Array.from($("input[name='geomType']:checked")).map(cb => cb.value),
                  showUnavailable: $("input[name='showUnavailable']:checked").val() === "show"
              }
          };
          console.log("📦 Payload that will be sent:", JSON.stringify(payload, null, 2));
      }
  });

  // Monitor AJAX requests to /generate_map
  $(document).ajaxSend(function(event, xhr, settings) {
      if (settings.url === "/generate_map") {
          console.log("🚀 AJAX REQUEST TO /generate_map:");
          try {
              const payload = JSON.parse(settings.data);
              console.log("  📊 Display Method:", payload.display_method);
              console.log("  🎯 Mode:", payload.mode);
              if (payload.weight_type) {
                  console.log("  ⚖️ Weight Type:", payload.weight_type);
              }
              if (payload.config && payload.config.dataFraction) {
                  console.log("  🎚️ Data Fraction:", payload.config.dataFraction);
              }
          } catch (e) {
              console.log("  ❌ Could not parse payload");
          }
      }
  });

  $(document).ajaxSuccess(function(event, xhr, settings) {
      if (settings.url === "/generate_map") {
          console.log("✅ AJAX SUCCESS:", xhr.status);
          try {
              const response = JSON.parse(xhr.responseText);
              if (response.figure) {
                  const figure = typeof response.figure === 'string' ? JSON.parse(response.figure) : response.figure;
                  console.log("📈 Figure has", figure.data?.length || 0, "traces");
              }
          } catch (e) {
              console.log("❌ Could not parse response");
          }
      }
  });

  $(document).ajaxError(function(event, xhr, settings, error) {
      if (settings.url === "/generate_map") {
          console.log("❌ AJAX ERROR:", xhr.status, "-", error);
          console.log("📄 Response:", xhr.responseText);
      }
  });
});

// Geometry Filter Module for instant client-side filtering
var GeometryFilter = (function() {
  'use strict';

  // Store original figure data
  let originalFigure = null;
  let filteredFigure = null;

  // Initialize the module
  function init() {
      console.log("🔍 GeometryFilter module initialized");

      // Add event listeners to geometry checkboxes
      $("input[name='geomType']").on('change', function() {
          console.log("📐 Geometry type checkbox changed");
          applyClientSideFilter();
      });

      // Store the original figure when a new map is rendered
      $(document).on('plotly_afterplot', '#mapContainer', function() {
          storeOriginalFigure();
      });
  }

  // Store the original figure data
  function storeOriginalFigure() {
      const mapDiv = document.getElementById('mapContainer');
      if (mapDiv && mapDiv.data && mapDiv.layout) {
          originalFigure = {
              data: JSON.parse(JSON.stringify(mapDiv.data)),
              layout: JSON.parse(JSON.stringify(mapDiv.layout))
          };

          // Add geometry type metadata to each trace if not present
          originalFigure.data.forEach(trace => {
              if (!trace.geometryType) {
                  trace.geometryType = detectGeometryType(trace);
              }
          });

          console.log("💾 Stored original figure with", originalFigure.data.length, "traces");
      }
  }

  // Detect geometry type from trace properties
  function detectGeometryType(trace) {
      // Check the mode property
      if (trace.mode === 'markers') {
          // Could be Point or MultiPoint
          if (trace.lon && trace.lon.length === 1) {
              return 'Point';
          } else if (trace.lon && trace.lon.length > 1) {
              return 'MultiPoint';
          }
          return 'Point'; // Default for markers
      } else if (trace.mode === 'lines') {
          // Could be LineString, MultiLineString, Polygon, or MultiPolygon
          // Check if it's a closed shape (polygon)
          if (trace.fill === 'none' || trace.fill === 'toself') {
              // Likely a polygon
              return 'Polygon';
          }
          // Otherwise it's a line
          return 'LineString';
      }

      // Default fallback
      return 'Unknown';
  }

  // Apply client-side filter based on checkbox selections
  function applyClientSideFilter() {
      if (!originalFigure) {
          console.warn("⚠️ No original figure stored, cannot apply client-side filter");
          return;
      }

      // Get selected geometry types
      const selectedTypes = getSelectedGeometryTypes();
      console.log("✅ Selected geometry types:", selectedTypes);

      if (selectedTypes.length === 0) {
          // If nothing selected, show empty map
          console.log("⚠️ No geometry types selected, showing empty map");
          showEmptyMap();
          return;
      }

      // Filter traces based on selected geometry types
      const filteredTraces = originalFigure.data.filter(trace => {
          const traceGeomType = trace.geometryType || detectGeometryType(trace);

          // Check if this trace's geometry type is selected
          const shouldInclude = selectedTypes.some(selectedType => {
              // Handle both exact matches and related types
              if (selectedType === traceGeomType) return true;

              // Handle MultiPoint traces when Point is selected
              if (selectedType === 'Point' && traceGeomType === 'MultiPoint') return true;
              if (selectedType === 'MultiPoint' && traceGeomType === 'Point') return true;

              // Handle MultiLineString traces when LineString is selected
              if (selectedType === 'LineString' && traceGeomType === 'MultiLineString') return true;
              if (selectedType === 'MultiLineString' && traceGeomType === 'LineString') return true;

              // Handle MultiPolygon traces when Polygon is selected
              if (selectedType === 'Polygon' && traceGeomType === 'MultiPolygon') return true;
              if (selectedType === 'MultiPolygon' && traceGeomType === 'Polygon') return true;

              return false;
          });

          if (!shouldInclude) {
              console.log(`🚫 Filtering out trace with geometry type: ${traceGeomType}`);
          }

          return shouldInclude;
      });

      console.log(`📊 Filtered ${originalFigure.data.length} traces down to ${filteredTraces.length}`);

      // Update the map with filtered traces
      if (filteredTraces.length > 0) {
          Plotly.react('mapContainer', filteredTraces, originalFigure.layout);

          // Update the info annotation
          updateFilterAnnotation(selectedTypes);
      } else {
          showEmptyMap();
      }
  }

  // Get currently selected geometry types
  function getSelectedGeometryTypes() {
      const selected = [];
      $("input[name='geomType']:checked").each(function() {
          selected.push($(this).val());
      });
      return selected;
  }

  // Show empty map when no geometry types are selected
  function showEmptyMap() {
      const emptyFigure = {
          data: [],
          layout: originalFigure ? originalFigure.layout : {
              mapbox: {
                  style: "open-street-map",
                  center: {lat: 39.8283, lon: -98.5795},
                  zoom: 3
              },
              margin: {r: 0, t: 0, b: 0, l: 0},
              annotations: [{
                  x: 0.5, y: 0.5,
                  xref: "paper", yref: "paper",
                  text: "No geometry types selected",
                  showarrow: false,
                  font: {size: 16, color: "gray"},
                  bgcolor: "rgba(255,255,255,0.8)",
                  bordercolor: "gray",
                  borderwidth: 1
              }]
          }
      };

      Plotly.react('mapContainer', emptyFigure.data, emptyFigure.layout);
  }

  // Update the filter annotation on the map
  function updateFilterAnnotation(selectedTypes) {
      const mapDiv = document.getElementById('mapContainer');
      if (!mapDiv || !mapDiv.layout) return;

      // Get current layout
      const layout = JSON.parse(JSON.stringify(mapDiv.layout));

      // Find or create geometry filter annotation
      if (!layout.annotations) {
          layout.annotations = [];
      }

      // Remove existing geometry filter annotation
      layout.annotations = layout.annotations.filter(ann =>
          !ann.text || !ann.text.includes('🔍 Showing:')
      );

      // Add new annotation
      layout.annotations.push({
          text: `🔍 Showing: ${selectedTypes.join(', ')}`,
          showarrow: false,
          xref: "paper", yref: "paper",
          x: 0.02, y: 0.06,
          xanchor: "left", yanchor: "bottom",
          bgcolor: "rgba(255,255,255,0.8)",
          bordercolor: "green",
          borderwidth: 1,
          font: {size: 10, color: "green"}
      });

      // Update layout without redrawing traces
      Plotly.relayout('mapContainer', layout);
  }

  // Public API
  return {
      init: init,
      applyFilter: applyClientSideFilter,
      storeOriginalFigure: storeOriginalFigure,
      getSelectedTypes: getSelectedGeometryTypes
  };
})();

// Initialize when document is ready
$(document).ready(function() {
  GeometryFilter.init();
});

// Hook into the existing map rendering to enable client-side filtering
$(document).ready(function() {
  // Override the sendMapRequest function to add geometry filter awareness
  const originalSendMapRequest = window.sendMapRequest || window.debugWidgets.sendMapRequest;

  if (originalSendMapRequest) {
      window.sendMapRequest = function(payload) {
          console.log("🎯 Intercepted sendMapRequest for geometry filtering");

          // Call the original function
          const result = originalSendMapRequest.call(this, payload);

          // After map loads, enable client-side filtering
          setTimeout(function() {
              GeometryFilter.storeOriginalFigure();
          }, 1000);

          return result;
      };
  }
});