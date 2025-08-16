from __future__ import annotations

import geopandas as gpd
import plotly.graph_objects as go
import pandas as pd
import numpy as np
from typing import Dict, Any, List
import logging

from .display import (
    ensure_shapely, color_for_label, traces_from_geometry,
    center_of, openstreetmap_layout, flatten_points
)

logger = logging.getLogger(__name__)


def create_regular_display(gdf: gpd.GeoDataFrame, config: Dict[str, Any] = None) -> go.Figure:
    """
    Enhanced regular display with better geometry support and configuration options.

    Args:
        gdf: GeoDataFrame with geometry and optional Dataset column
        config: Optional configuration dict with keys:
            - data_fraction: float 0-1 for sampling
            - geometry_types: list of geometry types to include
            - show_unavailable: bool
            - display_method: str for rendering method
    """
    config = config or {}

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to create_regular_display")
        return _create_empty_figure()

    # Apply configuration filters
    filtered_gdf = _apply_filters(gdf, config)

    if filtered_gdf.empty:
        logger.warning("No data remaining after applying filters")
        return _create_empty_figure()

    # Generate traces based on display method
    display_method = config.get('display_method', 'default')

    if display_method == 'advanced':
        return _create_advanced_display(filtered_gdf, config)
    else:
        return _create_default_display(filtered_gdf, config)


# def _apply_filters(gdf: gpd.GeoDataFrame, config: Dict[str, Any]) -> gpd.GeoDataFrame:
#     """Apply configuration-based filters to the GeoDataFrame."""
#     filtered_gdf = gdf.copy()
#
#     # Apply data fraction sampling
#     data_fraction = config.get('data_fraction', 1.0)
#     if data_fraction < 1.0:
#         sample_size = int(len(filtered_gdf) * data_fraction)
#         if sample_size > 0:
#             filtered_gdf = filtered_gdf.sample(n=sample_size, random_state=42)
#
#     # Filter by geometry types
#     geometry_types = config.get('geometry_types')
#     if geometry_types:
#         mask = filtered_gdf.geometry.apply(
#             lambda geom: ensure_shapely(geom) is not None and
#                          getattr(ensure_shapely(geom), 'geom_type', '') in geometry_types
#         )
#         filtered_gdf = filtered_gdf[mask]
#
#     # Filter out invalid geometries
#     filtered_gdf = filtered_gdf[filtered_gdf.geometry.notna()]
#
#     return filtered_gdf


def _create_default_display(gdf: gpd.GeoDataFrame, config: Dict[str, Any]) -> go.Figure:
    """Create the standard display with dataset-based coloring."""
    has_ds = "Dataset" in gdf.columns
    seen_datasets: Dict[str, bool] = {}
    all_lons, all_lats = [], []
    traces = []

    for idx, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Determine dataset label and color
        label = str(row["Dataset"]) if has_ds else "Data"
        color = color_for_label(label)

        # Create hover text
        hover = _create_hover_text(row)

        # Check if this is the first occurrence of this dataset (for legend)
        show_legend = label not in seen_datasets
        seen_datasets[label] = True

        # Generate traces for this geometry
        geom_traces = traces_from_geometry(
            geom,
            name=label,
            color=color,
            hovertext=hover,
            showlegend=show_legend,
            legendgroup=label
        )
        traces.extend(geom_traces)

        # Collect coordinates for centering
        points = flatten_points(geom)
        if points:
            for lon, lat in points:
                all_lons.append(lon)
                all_lats.append(lat)
        else:
            # For non-point geometries, use bounds
            bounds = geom.bounds
            if len(bounds) >= 4:
                all_lons.extend([bounds[0], bounds[2]])
                all_lats.extend([bounds[1], bounds[3]])

    # Calculate map center and create layout
    cx, cy = center_of(all_lons, all_lats)
    layout = openstreetmap_layout(cx, cy, 6, "Datasets" if has_ds else "Data")

    # Add configuration-specific layout updates
    _update_layout_from_config(layout, config)

    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Created regular display with {len(traces)} traces for {len(gdf)} features")
    return fig


def _create_advanced_display(gdf: gpd.GeoDataFrame, config: Dict[str, Any]) -> go.Figure:
    """Create advanced display with additional interactive features."""
    # This is where you can add more sophisticated rendering
    # For now, delegate to default but could be extended
    fig = _create_default_display(gdf, config)

    # Add advanced features
    fig.update_layout(
        updatemenus=[{
            'buttons': [
                {
                    'args': [{'visible': [True] * len(fig.data)}],
                    'label': 'Show All',
                    'method': 'restyle'
                },
                {
                    'args': [{'visible': [False] * len(fig.data)}],
                    'label': 'Hide All',
                    'method': 'restyle'
                }
            ],
            'direction': 'down',
            'showactive': True,
            'x': 0.1,
            'xanchor': 'left',
            'y': 1.02,
            'yanchor': 'top'
        }]
    )

    return fig


def _create_hover_text(row) -> str:
    """Create formatted hover text from a row of data."""
    hover_parts = []

    for key, value in row.items():
        if key.lower() == "geometry":
            continue

        # Format the value nicely
        if pd.isna(value):
            continue
        elif isinstance(value, (int, float)):
            if isinstance(value, float):
                formatted_value = f"{value:.3f}" if abs(value) < 1000 else f"{value:.2e}"
            else:
                formatted_value = str(value)
        else:
            formatted_value = str(value)

        hover_parts.append(f"{key}: {formatted_value}")

    return "<br>".join(hover_parts)


def _update_layout_from_config(layout: Dict[str, Any], config: Dict[str, Any]) -> None:
    """Update layout based on configuration options."""
    # Add custom styling based on config
    if config.get('show_legend', True):
        layout.setdefault('showlegend', True)

    # Update zoom level based on data density
    data_fraction = config.get('data_fraction', 1.0)
    if data_fraction < 0.1:
        # Zoom out more for sparse data
        layout['mapbox']['zoom'] = max(3, layout['mapbox'].get('zoom', 6) - 2)


def _create_empty_figure() -> go.Figure:
    """Create an empty figure with appropriate messaging."""
    fig = go.Figure()
    fig.update_layout(**openstreetmap_layout(-98.5795, 39.8283, 3, "No Data"))

    # Add annotation for empty state
    fig.add_annotation(
        x=0.5, y=0.5,
        xref="paper", yref="paper",
        text="No data available for the selected filters",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig


# Additional utility for handling complex geometries
def _simplify_geometry_for_display(gdf: gpd.GeoDataFrame, tolerance: float = 0.001) -> gpd.GeoDataFrame:
    """Simplify geometries for better display performance."""
    simplified_gdf = gdf.copy()

    # Only simplify complex geometries
    complex_mask = simplified_gdf.geometry.apply(
        lambda geom: ensure_shapely(geom) is not None and
                     getattr(ensure_shapely(geom), 'geom_type', '') in ['Polygon', 'MultiPolygon']
    )

    if complex_mask.any():
        simplified_gdf.loc[complex_mask, 'geometry'] = simplified_gdf.loc[complex_mask, 'geometry'].simplify(tolerance)

    return simplified_gdf


# Export enhanced function for backward compatibility
def create_regular_display_enhanced(gdf: gpd.GeoDataFrame, **kwargs) -> go.Figure:
    """Enhanced version with keyword arguments converted to config."""
    return create_regular_display(gdf, kwargs)