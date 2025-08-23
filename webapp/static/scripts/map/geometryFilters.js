// geometryFilter.js - Enhanced client-side geometry filtering with metadata support
// Add this as a new JavaScript file in your static/scripts/map/ directory

var GeometryFilter = (function() {
    'use strict';

    // Store original figure data with metadata
    let originalFigure = null;
    let currentGeometryTypes = {};
    let isFilteringEnabled = false;

    // Initialize the module
    function init() {
        console.log("🔍 GeometryFilter module initialized");

        // Add event listeners to geometry checkboxes for instant filtering
        $("input[name='geomType']").on('change', function() {
            console.log("📐 Geometry type checkbox changed:", $(this).val(), "is", $(this).is(':checked') ? "checked" : "unchecked");

            // Only apply client-side filter if we have a map loaded
            if (originalFigure && isFilteringEnabled) {
                applyClientSideFilter();
            }
        });

        // Add a toggle button for instant filtering
        addFilterToggle();

        // Hook into Plotly events
        setupPlotlyHooks();
    }

    // Add a toggle switch for instant filtering
    function addFilterToggle() {
        // Check if toggle already exists
        if ($('#instantFilterToggle').length > 0) return;

        // Add toggle after the geometry types section
        const toggleHtml = `
            <div class="filter-section" id="instantFilterSection" style="background: #f0f8ff; padding: 10px; border-radius: 5px; margin-top: 10px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="instantFilterToggle" style="margin-right: 10px;">
                    <span style="font-weight: bold; color: #2E86AB;">
                        ⚡ Instant Geometry Filtering
                    </span>
                </label>
                <small style="color: #665; display: block; margin-top: 5px;">
                    When enabled, changes to geometry types instantly update the map without reloading
                </small>
            </div>
        `;

        // Insert after the geometry types checkboxes
        $('.checkbox-group').parent().after(toggleHtml);

        // Add event listener to toggle
        $('#instantFilterToggle').on('change', function() {
            isFilteringEnabled = $(this).is(':checked');
            console.log("⚡ Instant filtering", isFilteringEnabled ? "ENABLED" : "DISABLED");

            if (isFilteringEnabled && originalFigure) {
                // Apply current filter immediately
                applyClientSideFilter();
            } else if (!isFilteringEnabled && originalFigure) {
                // Restore original figure
                restoreOriginalFigure();
            }
        });
    }

    // Setup hooks into Plotly rendering
    function setupPlotlyHooks() {
        // Store figure data after any plot is rendered
        $(document).on('plotly_afterplot', '#mapContainer', function() {
            console.log("📊 Plot rendered, storing figure data");
            storeOriginalFigure();
        });

        // Also hook into the AJAX success to capture geometry metadata
        $(document).ajaxSuccess(function(event, xhr, settings) {
            if (settings.url === "/generate_map") {
                setTimeout(function() {
                    extractGeometryMetadata();
                }, 500);
            }
        });
    }

    // Store the original figure data with enhanced metadata
    function storeOriginalFigure() {
        const mapDiv = document.getElementById('mapContainer');
        if (mapDiv && mapDiv.data && mapDiv.layout) {
            // Deep clone the figure data
            originalFigure = {
                data: JSON.parse(JSON.stringify(mapDiv.data)),
                layout: JSON.parse(JSON.stringify(mapDiv.layout))
            };

            // Enhance traces with geometry type metadata
            enhanceTracesWithMetadata();

            console.log("💾 Stored original figure with", originalFigure.data.length, "traces");
            console.log("📐 Detected geometry types:", currentGeometryTypes);
        }
    }

    // Extract geometry metadata from the current state
    function extractGeometryMetadata() {
        currentGeometryTypes = {};
        const mapDiv = document.getElementById('mapContainer');

        if (mapDiv && mapDiv.data) {
            mapDiv.data.forEach((trace, index) => {
                const geomType = detectGeometryType(trace);
                if (!currentGeometryTypes[geomType]) {
                    currentGeometryTypes[geomType] = [];
                }
                currentGeometryTypes[geomType].push(index);
            });
        }

        console.log("📋 Geometry type inventory:", currentGeometryTypes);
    }

    // Enhance traces with detailed geometry type metadata
    function enhanceTracesWithMetadata() {
        if (!originalFigure || !originalFigure.data) return;

        originalFigure.data.forEach((trace, index) => {
            // Try to detect geometry type from trace properties
            const detectedType = detectGeometryType(trace);

            // Store both detected type and original index
            trace._geometryType = detectedType;
            trace._originalIndex = index;

            // Try to extract from name or other properties
            if (trace.name) {
                // Check if the name contains geometry type hints
                const nameLower = trace.name.toLowerCase();
                if (nameLower.includes('pipeline') || nameLower.includes('road') || nameLower.includes('interstate')) {
                    trace._geometryType = 'LineString';
                } else if (nameLower.includes('boundary') || nameLower.includes('area') || nameLower.includes('zone')) {
                    trace._geometryType = 'Polygon';
                }
            }

            console.log(`Trace ${index} (${trace.name}): detected as ${trace._geometryType}`);
        });
    }

    // Enhanced geometry type detection
    function detectGeometryType(trace) {
        // First check if we have explicit metadata
        if (trace._geometryType) {
            return trace._geometryType;
        }

        // Check the mode property
        if (trace.type === 'scattermapbox') {
            if (trace.mode === 'markers') {
                // Points or MultiPoints
                if (trace.lon && trace.lat) {
                    if (trace.lon.length === 1) {
                        return 'Point';
                    } else if (trace.lon.length > 1) {
                        // Could be MultiPoint or multiple individual points
                        // Check if all points have the same properties (likely MultiPoint)
                        return 'MultiPoint';
                    }
                }
                return 'Point';
            } else if (trace.mode === 'lines' || trace.mode === 'lines+markers') {
                // Lines or Polygons
                if (trace.fill === 'toself' || trace.fill === 'tonext') {
                    return 'Polygon';
                }

                // Check if the line forms a closed loop (polygon)
                if (trace.lon && trace.lat && trace.lon.length > 2) {
                    const firstLon = trace.lon[0];
                    const firstLat = trace.lat[0];
                    const lastLon = trace.lon[trace.lon.length - 1];
                    const lastLat = trace.lat[trace.lat.length - 1];

                    if (Math.abs(firstLon - lastLon) < 0.0001 && Math.abs(firstLat - lastLat) < 0.0001) {
                        return 'Polygon';
                    }
                }

                return 'LineString';
            }
        }

        // Check for other trace types
        if (trace.type === 'scattergeo') {
            if (trace.mode === 'markers') return 'Point';
            if (trace.mode === 'lines') return 'LineString';
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
        console.log("✅ Selected geometry types for filtering:", selectedTypes);

        if (selectedTypes.length === 0) {
            console.log("⚠️ No geometry types selected, showing empty map");
            showEmptyMap();
            return;
        }

        // Filter traces based on selected geometry types
        const filteredTraces = originalFigure.data.filter((trace, index) => {
            const traceGeomType = trace._geometryType || detectGeometryType(trace);

            // Check if this trace's geometry type is selected
            const shouldInclude = selectedTypes.some(selectedType => {
                // Exact match
                if (selectedType === traceGeomType) return true;

                // Handle related types
                if (selectedType === 'Point' && (traceGeomType === 'Point' || traceGeomType === 'MultiPoint')) return true;
                if (selectedType === 'MultiPoint' && (traceGeomType === 'Point' || traceGeomType === 'MultiPoint')) return true;
                if (selectedType === 'LineString' && (traceGeomType === 'LineString' || traceGeomType === 'MultiLineString')) return true;
                if (selectedType === 'MultiLineString' && (traceGeomType === 'LineString' || traceGeomType === 'MultiLineString')) return true;
                if (selectedType === 'Polygon' && (traceGeomType === 'Polygon' || traceGeomType === 'MultiPolygon')) return true;
                if (selectedType === 'MultiPolygon' && (traceGeomType === 'Polygon' || traceGeomType === 'MultiPolygon')) return true;

                return false;
            });

            if (!shouldInclude) {
                console.log(`🚫 Filtering out trace ${index} (${trace.name}) with geometry type: ${traceGeomType}`);
            } else {
                console.log(`✅ Including trace ${index} (${trace.name}) with geometry type: ${traceGeomType}`);
            }

            return shouldInclude;
        });

        console.log(`📊 Filtered ${originalFigure.data.length} traces down to ${filteredTraces.length}`);

        // Update the map with filtered traces
        if (filteredTraces.length > 0) {
            // Create a copy of the layout to preserve annotations
            const updatedLayout = JSON.parse(JSON.stringify(originalFigure.layout));

            // Update or add filter annotation
            updateFilterAnnotation(selectedTypes, updatedLayout);

            // Apply the filtered data
            Plotly.react('mapContainer', filteredTraces, updatedLayout);

            console.log("🗺️ Map updated with filtered traces");
        } else {
            showEmptyMap();
        }
    }

    // Restore the original unfiltered figure
    function restoreOriginalFigure() {
        if (!originalFigure) return;

        console.log("🔄 Restoring original figure with all traces");
        Plotly.react('mapContainer', originalFigure.data, originalFigure.layout);
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
            layout: originalFigure ? JSON.parse(JSON.stringify(originalFigure.layout)) : {
                mapbox: {
                    style: "open-street-map",
                    center: {lat: 39.8283, lon: -98.5795},
                    zoom: 3
                },
                margin: {r: 0, t: 0, b: 0, l: 0}
            }
        };

        // Add empty state annotation
        if (!emptyFigure.layout.annotations) {
            emptyFigure.layout.annotations = [];
        }

        emptyFigure.layout.annotations.push({
            x: 0.5, y: 0.5,
            xref: "paper", yref: "paper",
            text: "No geometry types selected - select at least one to see data",
            showarrow: false,
            font: {size: 16, color: "gray"},
            bgcolor: "rgba(255,255,255,0.8)",
            bordercolor: "gray",
            borderwidth: 1
        });

        Plotly.react('mapContainer', emptyFigure.data, emptyFigure.layout);
    }

    // Update the filter annotation on the map
    function updateFilterAnnotation(selectedTypes, layout) {
        if (!layout) return;

        // Initialize annotations if needed
        if (!layout.annotations) {
            layout.annotations = [];
        }

        // Remove existing client-side filter annotation
        layout.annotations = layout.annotations.filter(ann =>
            !ann.text || !ann.text.includes('⚡ Client Filter:')
        );

        // Add new annotation for client-side filter
        layout.annotations.push({
            text: `⚡ Client Filter: ${selectedTypes.join(', ')}`,
            showarrow: false,
            xref: "paper", yref: "paper",
            x: 0.02, y: 0.10,
            xanchor: "left", yanchor: "bottom",
            bgcolor: "rgba(255,255,0,0.8)",
            bordercolor: "orange",
            borderwidth: 1,
            font: {size: 10, color: "darkred"}
        });
    }

    // Public API
    return {
        init: init,
        applyFilter: applyClientSideFilter,
        restoreOriginal: restoreOriginalFigure,
        storeOriginalFigure: storeOriginalFigure,
        getSelectedTypes: getSelectedGeometryTypes,
        isEnabled: function() { return isFilteringEnabled; },
        enable: function() {
            isFilteringEnabled = true;
            $('#instantFilterToggle').prop('checked', true);
        },
        disable: function() {
            isFilteringEnabled = false;
            $('#instantFilterToggle').prop('checked', false);
        }
    };
})();

// Initialize when document is ready
$(document).ready(function() {
    GeometryFilter.init();

    // Debug helper
    window.GeoFilter = GeometryFilter;
});