from __future__ import annotations

from typing import Iterable, List, Tuple, Dict, Any
import numpy as np
import plotly.graph_objects as go
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry
import plotly.graph_objects as go

def create_default_display(gdf=None):
    """Return a very basic empty/fallback map figure."""
    fig = go.Figure()
    fig.update_layout(
        mapbox_style="open-street-map",
        mapbox_center={"lat": 39.8283, "lon": -98.5795},
        mapbox_zoom=3,
        margin={"r": 0, "t": 0, "b": 0, "l": 0}
    )
    return fig



# -------------------------------------------------
# Color utilities
# -------------------------------------------------
_PALETTE = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
    "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
    "#bcbd22", "#17becf", "#7B68EE", "#F08080",
    "#48D1CC", "#FFD700", "#ADFF2F", "#EE82EE"
]

def color_for_label(label: str) -> str:
    if not label:
        return _PALETTE[0]
    h = 0
    for ch in str(label):
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return _PALETTE[h % len(_PALETTE)]

# -------------------------------------------------
# Geometry utilities
# -------------------------------------------------

def ensure_shapely(geom: Any) -> BaseGeometry | None:
    """Accept Shapely geometry, GeoJSON-like dict, or None → Shapely or None."""
    if geom is None:
        return None
    if isinstance(geom, BaseGeometry):
        return geom
    try:
        return shape(geom)
    except Exception:
        return None


def center_of(lons: Iterable[float], lats: Iterable[float]) -> Tuple[float, float]:
    lons = [x for x in lons if x is not None and np.isfinite(x)]
    lats = [y for y in lats if y is not None and np.isfinite(y)]
    if not lons or not lats:
        return (-98.5795, 39.8283)  # CONUS fallback
    return (float(np.mean(lons)), float(np.mean(lats)))


def flatten_points(geom: BaseGeometry) -> List[Tuple[float, float]]:
    """Return all (lon, lat) pairs from Point/MultiPoint; empty for other types."""
    if geom is None or geom.is_empty:
        return []
    gt = getattr(geom, "geom_type", "")
    if gt == "Point":
        return [(geom.x, geom.y)]
    if gt == "MultiPoint":
        return [(p.x, p.y) for p in geom.geoms]
    return []


def traces_from_geometry(
    geom: BaseGeometry,
    *,
    name: str,
    color: str,
    hovertext: str = "",
    showlegend: bool = False,
    legendgroup: str | None = None,
    marker_size: float = 8,
    weight_value: float = None,
) -> List[go.Scattermapbox]:
    """Plotly traces for a single geometry with comprehensive hover text handling.
    - Points/MultiPoints → markers (with optional weight-based sizing)
    - LineString/MultiLineString → lines
    - Polygon/MultiPolygon → outline as lines (no fill)
    """
    traces: List[go.Scattermapbox] = []
    if geom is None or geom.is_empty:
        return traces
    gt = getattr(geom, "geom_type", "")

    # Configure marker based on whether this is weighted data
    marker_config = {"size": marker_size, "color": color, "opacity": 0.8}
    if weight_value is not None:
        # For weighted data, size based on weight but keep it reasonable
        # Note: scattermapbox markers don't support 'line' property like regular scatter plots
        marker_config["size"] = max(6, min(30, weight_value * 15.0)) if np.isfinite(weight_value) else marker_size

    # Configure hover label with dataset color
    hover_config = dict(
        bgcolor=color,
        bordercolor="white",
        font=dict(color="white", size=10)
    )

    if gt == "Point":
        traces.append(go.Scattermapbox(
            lon=[geom.x],
            lat=[geom.y],
            mode="markers",
            marker=marker_config,
            name=name,
            customdata=[hovertext],
            hovertemplate="%{customdata}<extra></extra>",
            hoverlabel=hover_config,
            showlegend=showlegend,
            legendgroup=legendgroup,
        ))
        return traces

    if gt == "MultiPoint":
        xs = [p.x for p in geom.geoms]
        ys = [p.y for p in geom.geoms]
        # Repeat hover text for each point
        hover_texts = [hovertext] * len(xs)
        traces.append(go.Scattermapbox(
            lon=xs,
            lat=ys,
            mode="markers",
            marker=marker_config,
            name=name,
            customdata=hover_texts,
            hovertemplate="%{customdata}<extra></extra>",
            hoverlabel=hover_config,
            showlegend=showlegend,
            legendgroup=legendgroup,
        ))
        return traces

    if gt == "LineString":
        xs, ys = geom.xy
        # For lines, we can still show hover text at each vertex
        hover_texts = [hovertext] * len(xs)
        traces.append(go.Scattermapbox(
            lon=list(xs),
            lat=list(ys),
            mode="lines",
            line={"color": color, "width": 2},
            name=name,
            customdata=hover_texts,
            hovertemplate="%{customdata}<extra></extra>",
            hoverlabel=hover_config,
            showlegend=showlegend,
            legendgroup=legendgroup,
        ))
        return traces

    if gt == "MultiLineString":
        for line in geom.geoms:
            xs, ys = line.xy
            hover_texts = [hovertext] * len(xs)
            traces.append(go.Scattermapbox(
                lon=list(xs),
                lat=list(ys),
                mode="lines",
                line={"color": color, "width": 2},
                name=name,
                customdata=hover_texts,
                hovertemplate="%{customdata}<extra></extra>",
                hoverlabel=hover_config,
                showlegend=showlegend,
                legendgroup=legendgroup,
            ))
        return traces

    if gt == "Polygon":
        xs, ys = geom.exterior.coords.xy
        hover_texts = [hovertext] * len(xs)
        traces.append(go.Scattermapbox(
            lon=list(xs),
            lat=list(ys),
            mode="lines",
            fill="none",
            line={"color": color, "width": 2},
            name=name,
            customdata=hover_texts,
            hovertemplate="%{customdata}<extra></extra>",
            hoverlabel=hover_config,
            showlegend=showlegend,
            legendgroup=legendgroup,
        ))
        return traces

    if gt == "MultiPolygon":
        for poly in geom.geoms:
            xs, ys = poly.exterior.coords.xy
            hover_texts = [hovertext] * len(xs)
            traces.append(go.Scattermapbox(
                lon=list(xs),
                lat=list(ys),
                mode="lines",
                fill="none",
                line={"color": color, "width": 2},
                name=name,
                customdata=hover_texts,
                hovertemplate="%{customdata}<extra></extra>",
                hoverlabel=hover_config,
                showlegend=showlegend,
                legendgroup=legendgroup,
            ))
        return traces

    return traces

def openstreetmap_layout(center_lon: float, center_lat: float, zoom: float = 6, legend_title: str | None = None) -> Dict[str, Any]:
    layout: Dict[str, Any] = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lon": center_lon, "lat": center_lat},
            "zoom": zoom,
        },
        "margin": {"r": 0, "t": 0, "l": 0, "b": 0},
    }
    if legend_title:
        layout["legend"] = {"title": {"text": legend_title}}
    return layout