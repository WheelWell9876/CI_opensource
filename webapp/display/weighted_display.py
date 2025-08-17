from __future__ import annotations

import numpy as np
import geopandas as gpd
import plotly.graph_objects as go
import pandas as pd
import logging
import traceback
from typing import List, Tuple, Dict, Any

from .display import (
    ensure_shapely, color_for_label, center_of, openstreetmap_layout,
)

# Set up logging
logger = logging.getLogger(__name__)


# -------------------------------------------------
# Default weighted (authoritative)
# -------------------------------------------------

def _points_and_weights(gdf: gpd.GeoDataFrame, weight_col: str) -> Tuple[List[float], List[float], List[float]]:
    lons: List[float] = []
    lats: List[float] = []
    ws: List[float] = []
    for _, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue
        w = 1.0
        if weight_col and weight_col in gdf.columns:
            try:
                w = float(row[weight_col])
            except Exception:
                w = 1.0
        gt = getattr(geom, "geom_type", "")
        if gt == "Point":
            lons.append(geom.x);
            lats.append(geom.y);
            ws.append(w)
        elif gt == "MultiPoint":
            for p in geom.geoms:
                lons.append(p.x);
                lats.append(p.y);
                ws.append(w)
    return lons, lats, ws


def create_weighted_default(gdf: gpd.GeoDataFrame, weight_type: str = "original") -> go.Figure:
    """Enhanced weighted display with comprehensive hover text and individual colored traces."""
    logger.info(f"Creating weighted default display with {len(gdf)} features, weight_type: {weight_type}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided")
        return create_empty_weighted_figure()

    # Determine if we have a Dataset column for coloring
    has_ds = "Dataset" in gdf.columns
    all_lons, all_lats = [], []
    traces = []

    # Group by dataset for consistent coloring
    dataset_colors = {}
    seen_datasets = set()

    for idx, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Get dataset name and color
        dataset_name = str(row.get("Dataset", "Weighted Data")) if has_ds else "Weighted Data"
        if dataset_name not in dataset_colors:
            dataset_colors[dataset_name] = color_for_label(dataset_name)

        # Get weight value
        weight = 1.0
        if weight_type and weight_type in gdf.columns:
            try:
                weight = float(row[weight_type])
            except Exception:
                weight = 1.0

        # Create comprehensive hover text
        hover_text = create_weighted_hover_text(row, weight_type, weight)

        # Calculate marker size based on weight
        marker_size = max(6, min(30, weight * 15.0)) if np.isfinite(weight) else 8

        # Handle different geometry types
        if geom.geom_type == "Point":
            lon, lat = geom.x, geom.y
            all_lons.append(lon)
            all_lats.append(lat)

            # Create individual trace for this point
            trace = go.Scattermapbox(
                lon=[lon],
                lat=[lat],
                mode="markers",
                marker=dict(
                    size=marker_size,
                    color=dataset_colors[dataset_name],
                    opacity=0.8
                    # Note: scattermapbox markers don't support 'line' property
                ),
                name=dataset_name,
                customdata=[hover_text],
                hovertemplate="%{customdata}<extra></extra>",
                hoverlabel=dict(
                    bgcolor=dataset_colors[dataset_name],
                    bordercolor="white",
                    font=dict(color="white", size=10)
                ),
                showlegend=dataset_name not in seen_datasets,
                legendgroup=dataset_name
            )
            traces.append(trace)
            seen_datasets.add(dataset_name)

        elif geom.geom_type == "MultiPoint":
            for point in geom.geoms:
                lon, lat = point.x, point.y
                all_lons.append(lon)
                all_lats.append(lat)

                trace = go.Scattermapbox(
                    lon=[lon],
                    lat=[lat],
                    mode="markers",
                    marker=dict(
                        size=marker_size,
                        color=dataset_colors[dataset_name],
                        opacity=0.8
                        # Note: scattermapbox markers don't support 'line' property
                    ),
                    name=dataset_name,
                    customdata=[hover_text],
                    hovertemplate="%{customdata}<extra></extra>",
                    hoverlabel=dict(
                        bgcolor=dataset_colors[dataset_name],
                        bordercolor="white",
                        font=dict(color="white", size=10)
                    ),
                    showlegend=dataset_name not in seen_datasets,
                    legendgroup=dataset_name
                )
                traces.append(trace)
                seen_datasets.add(dataset_name)

    # Calculate map center and zoom
    if all_lons and all_lats:
        cx, cy = center_of(all_lons, all_lats)
        # Calculate appropriate zoom based on data spread
        lon_range = max(all_lons) - min(all_lons) if all_lons else 0
        lat_range = max(all_lats) - min(all_lats) if all_lats else 0
        max_range = max(lon_range, lat_range)

        if max_range < 0.1:
            zoom = 12
        elif max_range < 1:
            zoom = 8
        elif max_range < 5:
            zoom = 6
        else:
            zoom = 4
    else:
        cx, cy = -98.5795, 39.8283
        zoom = 4

    # Create layout
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lon": cx, "lat": cy},
            "zoom": zoom,
        },
        "margin": {"r": 0, "t": 0, "l": 0, "b": 0},
        "hovermode": "closest",
        "hoverdistance": 20,
    }

    if has_ds and len(seen_datasets) > 1:
        layout["legend"] = {
            "title": {"text": f"Weighted Datasets ({weight_type})"},
            "x": 1,
            "y": 1,
            "bgcolor": "rgba(255,255,255,0.8)",
            "bordercolor": "black",
            "borderwidth": 1
        }

    # Create figure
    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Successfully created weighted default display with {len(traces)} traces")
    return fig


def create_weighted_hover_text(row, weight_type: str, weight_value: float) -> str:
    """Create comprehensive hover text for weighted datasets."""
    hover_parts = []

    # Add a title with weight information
    title_fields = ['name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME']
    title = None
    for field in title_fields:
        if field in row and pd.notna(row[field]):
            title = str(row[field])
            break

    if title:
        hover_parts.append(f"<b style='color: #2E86AB; font-size: 13px;'>{title}</b>")
    else:
        hover_parts.append(f"<b style='color: #2E86AB; font-size: 13px;'>Weighted Data Point</b>")

    # Add weight information prominently
    hover_parts.append(f"<b style='color: #FF6B35; font-size: 12px;'>Weight ({weight_type}): {weight_value:.3f}</b>")
    hover_parts.append("<span style='color: #666;'>─────────────────────────</span>")

    # Show priority fields first
    priority_fields = ['Dataset', 'Category', 'State', 'County', 'City', 'Type']
    shown_fields = set(['geometry'])  # Track what we've shown

    for field in priority_fields:
        if field in row and pd.notna(row[field]):
            value = str(row[field])
            hover_parts.append(
                f"<b style='color: #555; font-size: 10px;'>{field}:</b> <span style='color: #000; font-size: 10px;'>{value}</span>")
            shown_fields.add(field)

    # Add separator if we have more fields
    remaining_fields = [k for k in row.index if k not in shown_fields and pd.notna(row[k])]
    if remaining_fields:
        hover_parts.append("<span style='color: #666;'>─────────────────</span>")

    # Show other weight-related fields
    weight_fields = [k for k in row.index if 'weight' in k.lower() or 'normalized' in k.lower()]
    for field in weight_fields:
        if field in shown_fields or field not in row.index or pd.isna(row[field]):
            continue
        value = row[field]
        if isinstance(value, (int, float)):
            formatted_value = f"{value:.6f}" if abs(value) < 0.001 else f"{value:.3f}"
        else:
            formatted_value = str(value)
        hover_parts.append(
            f"<b style='color: #666; font-size: 9px;'>{field}:</b> <span style='color: #333; font-size: 9px;'>{formatted_value}</span>")
        shown_fields.add(field)

    # Show other important fields (limit to prevent huge hover boxes)
    field_count = 0
    max_additional_fields = 8

    for key, value in row.items():
        if key in shown_fields or pd.isna(value) or field_count >= max_additional_fields:
            continue

        # Format the value nicely
        if isinstance(value, (int, float)):
            if isinstance(value, float):
                if abs(value) < 0.001 and value != 0:
                    formatted_value = f"{value:.2e}"
                elif abs(value) < 1000:
                    formatted_value = f"{value:.3f}".rstrip('0').rstrip('.')
                else:
                    formatted_value = f"{value:,.2f}"
            else:
                formatted_value = f"{value:,}"
        else:
            formatted_value = str(value)
            if len(formatted_value) > 50:
                formatted_value = formatted_value[:47] + "..."

        hover_parts.append(
            f"<b style='color: #555; font-size: 10px;'>{key}:</b> <span style='color: #000; font-size: 10px;'>{formatted_value}</span>")
        field_count += 1

    # Add summary of remaining fields if any
    total_remaining = len([k for k in row.index if k not in shown_fields and pd.notna(row[k])]) - field_count
    if total_remaining > 0:
        hover_parts.append(f"<i style='color: #888; font-size: 9px;'>... +{total_remaining} more fields</i>")

    return "<br>".join(hover_parts)


def create_empty_weighted_figure() -> go.Figure:
    """Create an empty figure for weighted data."""
    fig = go.Figure()
    fig.update_layout(
        mapbox_style="open-street-map",
        mapbox_center={"lat": 39.8283, "lon": -98.5795},
        mapbox_zoom=3,
        margin={"r": 0, "t": 0, "b": 0, "l": 0}
    )

    fig.add_annotation(
        x=0.5, y=0.5,
        xref="paper", yref="paper",
        text="No weighted data available for the selected filters",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig


# -------------------------------------------------
# Router for weighted options (delegates to option modules if present)
# -------------------------------------------------

def build_weighted_figure(
        gdf: gpd.GeoDataFrame,
        display_method: str = "default",
        weight_type: str = "original",
        config: dict = None,
) -> go.Figure:
    """Enhanced router with detailed debugging and error handling."""

    dm = (display_method or "default").lower()
    logger.info(f"🎯 Building weighted figure: method='{dm}', weight_type='{weight_type}', data_rows={len(gdf)}")

    # Log some debug info about the display method
    print(f"🔍 DEBUG: build_weighted_figure called with display_method='{display_method}' (normalized: '{dm}')")
    print(f"🔍 DEBUG: GeoDataFrame shape: {gdf.shape}")
    print(f"🔍 DEBUG: Weight type: {weight_type}")
    print(f"🔍 DEBUG: Config: {config}")

    if dm == "default":
        logger.info("Using default weighted display")
        return create_weighted_default(gdf, weight_type)

    # Import optional modules lazily to avoid circular deps.
    try:
        logger.info(f"🔧 Attempting to load custom display method: {dm}")
        print(f"🔧 DEBUG: Attempting to import and execute display method: {dm}")

        if dm in ("basic_heatmap", "weighted_heatmap"):
            logger.info("Importing basic_heatmap module")
            print("🔧 DEBUG: Importing basic_heatmap module...")
            try:
                from .weighted_options.basic_heatmap import figure as _heat
                logger.info("Successfully imported basic_heatmap")
                print("✅ DEBUG: basic_heatmap imported successfully")
                # Pass config if the function supports it
                try:
                    result = _heat(gdf, weight_type, config)
                except TypeError:
                    # Fallback if function doesn't accept config parameter
                    result = _heat(gdf, weight_type)
                logger.info("basic_heatmap figure created successfully")
                print("✅ DEBUG: basic_heatmap figure created successfully")
                return result
            except ImportError as e:
                logger.error(f"ImportError for basic_heatmap: {e}")
                print(f"❌ DEBUG: ImportError for basic_heatmap: {e}")
                print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
                raise
            except Exception as e:
                logger.error(f"Error executing basic_heatmap: {e}")
                print(f"❌ DEBUG: Error executing basic_heatmap: {e}")
                print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
                raise

        elif dm == "bubble_map":
            logger.info("Importing bubble_map module")
            print("🔧 DEBUG: Importing bubble_map module...")
            try:
                from .weighted_options.bubble_map import figure as _bubble
                logger.info("Successfully imported bubble_map")
                print("✅ DEBUG: bubble_map imported successfully")
                # Pass config to bubble_map
                result = _bubble(gdf, weight_type, config)
                logger.info("bubble_map figure created successfully")
                print("✅ DEBUG: bubble_map figure created successfully")
                return result
            except ImportError as e:
                logger.error(f"ImportError for bubble_map: {e}")
                print(f"❌ DEBUG: ImportError for bubble_map: {e}")
                print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
                raise
            except Exception as e:
                logger.error(f"Error executing bubble_map: {e}")
                print(f"❌ DEBUG: Error executing bubble_map: {e}")
                print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
                raise

        elif dm == "animated":
            logger.info("Importing animated_display module")
            print("🔧 DEBUG: Importing animated_display module...")
            try:
                from .weighted_options.animated_display import figure as _anim
                logger.info("Successfully imported animated_display")
                print("✅ DEBUG: animated_display imported successfully")
                # Pass config if the function supports it
                try:
                    result = _anim(gdf, weight_type, config)
                except TypeError:
                    # Fallback if function doesn't accept config parameter
                    result = _anim(gdf, weight_type)
                logger.info("animated_display figure created successfully")
                print("✅ DEBUG: animated_display figure created successfully")
                return result
            except ImportError as e:
                logger.error(f"ImportError for animated_display: {e}")
                print(f"❌ DEBUG: ImportError for animated_display: {e}")
                print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
                raise
            except Exception as e:
                logger.error(f"Error executing animated_display: {e}")
                print(f"❌ DEBUG: Error executing animated_display: {e}")
                print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
                raise

        elif dm == "convex_hull":
            logger.info("Importing convex_hull module")
            print("🔧 DEBUG: Importing convex_hull module...")
            try:
                from .weighted_options.convex_hull import figure as _hull
                logger.info("Successfully imported convex_hull")
                print("✅ DEBUG: convex_hull imported successfully")
                # Pass config if the function supports it
                try:
                    result = _hull(gdf, weight_type, config)
                except TypeError:
                    # Fallback if function doesn't accept config parameter
                    result = _hull(gdf, weight_type)
                logger.info("convex_hull figure created successfully")
                print("✅ DEBUG: convex_hull figure created successfully")
                return result
            except ImportError as e:
                logger.error(f"ImportError for convex_hull: {e}")
                print(f"❌ DEBUG: ImportError for convex_hull: {e}")
                print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
                raise
            except Exception as e:
                logger.error(f"Error executing convex_hull: {e}")
                print(f"❌ DEBUG: Error executing convex_hull: {e}")
                print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
                raise

        else:
            logger.warning(f"Unknown display method: {dm}")
            print(f"⚠️ DEBUG: Unknown display method '{dm}', falling back to default")

    except Exception as e:
        # Log the full error for debugging
        logger.error(f"❌ ERROR in build_weighted_figure: {e}")
        logger.error(f"❌ Full traceback: {traceback.format_exc()}")

        print(f"❌ DEBUG: CRITICAL ERROR in build_weighted_figure")
        print(f"❌ DEBUG: Error: {e}")
        print(f"❌ DEBUG: Display method attempted: {dm}")
        print(f"❌ DEBUG: Full traceback:")
        print(traceback.format_exc())
        print(f"❌ DEBUG: Falling back to default display")

        # Any import/exec failure falls back to default rather than crashing the UI.
        pass

    logger.info("Falling back to default weighted display")
    print("🔄 DEBUG: Using fallback default weighted display")
    return create_weighted_default(gdf, weight_type)