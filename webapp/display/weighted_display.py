from __future__ import annotations

import numpy as np
import geopandas as gpd
import plotly.graph_objects as go
from typing import List, Tuple, Dict, Any

from .display import (
    ensure_shapely, color_for_label, center_of, openstreetmap_layout,
)

# -------------------------------------------------
# Default weighted (authoritative)
# -------------------------------------------------

def _points_and_weights(gdf: gpd.GeoDataFrame, weight_col: str) -> Tuple[List[float], List[float], List[float]]:
    lons: List[float] = []
    lats: List[float] = []
    ws:   List[float] = []
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
            lons.append(geom.x); lats.append(geom.y); ws.append(w)
        elif gt == "MultiPoint":
            for p in geom.geoms:
                lons.append(p.x); lats.append(p.y); ws.append(w)
    return lons, lats, ws


def create_weighted_default(gdf: gpd.GeoDataFrame, weight_type: str = "original") -> go.Figure:
    """Bubble map sized by the chosen weight column (or 1.0 if absent)."""
    lons, lats, ws = _points_and_weights(gdf, weight_type)
    cx, cy = center_of(lons, lats)
    sizes = [max(6, min(30, (w if np.isfinite(w) else 1.0) * 30.0)) for w in ws] if ws else [8] * len(lats)

    trace = go.Scattermapbox(
        lon=lons, lat=lats, mode="markers",
        marker={"size": sizes, "opacity": 0.7},
        name="Weighted points",
        hovertemplate="weight=%{marker.size:.2f}<extra></extra>",
    )
    fig = go.Figure([trace])
    fig.update_layout(**openstreetmap_layout(cx, cy, 6, "Weighted"))
    return fig

# -------------------------------------------------
# Router for weighted options (delegates to option modules if present)
# -------------------------------------------------

def build_weighted_figure(
    gdf: gpd.GeoDataFrame,
    display_method: str = "default",
    weight_type: str = "original",
) -> go.Figure:
    dm = (display_method or "default").lower()
    if dm == "default":
        return create_weighted_default(gdf, weight_type)

    # Import optional modules lazily to avoid circular deps.
    try:
        if dm in ("basic_heatmap", "weighted_heatmap"):
            from .weighted_options.basic_heatmap import figure as _heat
            return _heat(gdf, weight_type)
        if dm == "bubble_map":
            from .weighted_options.bubble_map import figure as _bubble
            return _bubble(gdf, weight_type)
        if dm == "animated":
            from .weighted_options.animated_display import figure as _anim
            return _anim(gdf, weight_type)
        if dm == "convex_hull":
            from .weighted_options.convex_hull import figure as _hull
            return _hull(gdf, weight_type)
    except Exception:
        # Any import/exec failure falls back to default rather than crashing the UI.
        pass

    return create_weighted_default(gdf, weight_type)