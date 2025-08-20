import logging
import numpy as np
import plotly.graph_objects as go
import geopandas as gpd
import pandas as pd
import requests
import json
from shapely.geometry import Point
from ..display import ensure_shapely, center_of, color_for_label

logger = logging.getLogger(__name__)


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original", config: dict = None) -> go.Figure:
    """Create a state-level choropleth map with data point overlay."""
    logger.info(f"Creating state choropleth map from {len(gdf)} features with weight_type: {weight_type}")
    print(f"🗺️ DEBUG: state_choropleth.figure() called with {len(gdf)} rows, weight_type='{weight_type}'")

    if config:
        print(f"🔧 DEBUG: Config received: {config}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to state choropleth")
        return create_empty_figure()

    # Apply data fraction sampling if specified
    original_size = len(gdf)
    data_fraction = 1.0

    if config and 'data_fraction' in config:
        data_fraction = config['data_fraction']
    elif config and 'dataFraction' in config:
        data_fraction = config['dataFraction']

    print(f"📊 DEBUG: Original dataset size: {original_size}")
    print(f"📊 DEBUG: Data fraction to use: {data_fraction}")

    if data_fraction < 1.0 and len(gdf) > 10:
        sample_size = max(10, int(len(gdf) * data_fraction))
        gdf = gdf.sample(n=sample_size, random_state=42).reset_index(drop=True)
        print(f"📊 DEBUG: Sampled {len(gdf)} points from {original_size} ({data_fraction * 100:.1f}%)")

    # Extract point data with state assignment
    state_data = assign_states_to_points(gdf, weight_type)

    if not state_data:
        logger.warning("No valid state data found")
        return create_empty_figure()

    # Load US state boundaries GeoJSON
    us_states_geojson = load_us_states_geojson()

    if not us_states_geojson:
        logger.warning("Could not load US states GeoJSON, falling back to point overlay")
        return create_fallback_state_map(gdf, weight_type, state_data, config)

    # Aggregate data by state
    state_aggregates = aggregate_by_state(state_data)

    # Create choropleth map
    fig = create_choropleth_figure(state_aggregates, us_states_geojson, weight_type)

    # Add data points as overlay
    fig = add_data_point_overlay(fig, gdf, weight_type, state_data)

    # Add sampling info if data was sampled
    if data_fraction < 1.0:
        fig.add_annotation(
            text=f"📊 Showing {len(gdf)} of {original_size} data points ({data_fraction * 100:.1f}%)",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.02, y=0.02,
            xanchor="left", yanchor="bottom",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="blue",
            borderwidth=1,
            font=dict(size=10, color="blue")
        )

    logger.info(f"Successfully created state choropleth map with {len(state_aggregates)} states")
    print(f"✅ DEBUG: State choropleth created with {len(state_aggregates)} states")

    return fig


def assign_states_to_points(gdf: gpd.GeoDataFrame, weight_type: str) -> list:
    """Assign state information to data points based on coordinates."""
    points_with_states = []

    for idx, row in gdf.iterrows():
        geom = ensure_shapely(row.get("geometry"))
        if geom is None or geom.is_empty:
            continue

        # Get weight value
        weight = 1.0
        if weight_type and weight_type in gdf.columns:
            try:
                weight = float(row[weight_type])
            except Exception:
                weight = 1.0

        # Handle different geometry types
        if geom.geom_type == "Point":
            state = get_state_from_coordinates(geom.y, geom.x)
            if state:
                points_with_states.append({
                    'lon': geom.x,
                    'lat': geom.y,
                    'weight': weight,
                    'state': state,
                    'original_data': row.to_dict()
                })
        elif geom.geom_type == "MultiPoint":
            for point in geom.geoms:
                state = get_state_from_coordinates(point.y, point.x)
                if state:
                    points_with_states.append({
                        'lon': point.x,
                        'lat': point.y,
                        'weight': weight,
                        'state': state,
                        'original_data': row.to_dict()
                    })

    print(f"🗺️ DEBUG: Assigned states to {len(points_with_states)} points")
    return points_with_states


def get_state_from_coordinates(lat: float, lon: float) -> str:
    """
    Get US state from coordinates using a simple geometric approach.
    This is a simplified version - you might want to use a more sophisticated method.
    """
    # Simple state boundary approximations (this is very rough!)
    # In production, you'd want to use proper state boundary data

    state_boundaries = {
        'California': {'lat_min': 32.5, 'lat_max': 42.0, 'lon_min': -124.5, 'lon_max': -114.1},
        'Texas': {'lat_min': 25.8, 'lat_max': 36.5, 'lon_min': -106.6, 'lon_max': -93.5},
        'Florida': {'lat_min': 24.5, 'lat_max': 31.0, 'lon_min': -87.6, 'lon_max': -80.0},
        'New York': {'lat_min': 40.5, 'lat_max': 45.0, 'lon_min': -79.8, 'lon_max': -71.9},
        'Pennsylvania': {'lat_min': 39.7, 'lat_max': 42.3, 'lon_min': -80.5, 'lon_max': -74.7},
        'Illinois': {'lat_min': 36.9, 'lat_max': 42.5, 'lon_min': -91.5, 'lon_max': -87.0},
        'Ohio': {'lat_min': 38.4, 'lat_max': 42.0, 'lon_min': -84.8, 'lon_max': -80.5},
        'Georgia': {'lat_min': 30.4, 'lat_max': 35.0, 'lon_min': -85.6, 'lon_max': -80.8},
        'North Carolina': {'lat_min': 33.8, 'lat_max': 36.6, 'lon_min': -84.3, 'lon_max': -75.5},
        'Michigan': {'lat_min': 41.7, 'lat_max': 48.3, 'lon_min': -90.4, 'lon_max': -82.4},
        # Add more states as needed...
    }

    # Check which state contains this point
    for state, bounds in state_boundaries.items():
        if (bounds['lat_min'] <= lat <= bounds['lat_max'] and
                bounds['lon_min'] <= lon <= bounds['lon_max']):
            return state

    # If no specific state found, try to categorize by region
    if lat >= 49.0:
        return "Alaska"
    elif lat <= 25.0 and lon >= -160.0:
        return "Hawaii"
    elif lat >= 45.0:
        return "Northern States"
    elif lat <= 30.0:
        return "Southern States"
    elif lon <= -100.0:
        return "Western States"
    else:
        return "Central States"


def load_us_states_geojson():
    """Load US states GeoJSON from a public source."""
    try:
        # Use a public GeoJSON source for US states
        url = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
        # Alternative: https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json

        # For now, create a simplified structure
        # In production, you'd load actual state boundary data
        return {
            "type": "FeatureCollection",
            "features": []  # This would contain actual state boundary features
        }
    except Exception as e:
        logger.warning(f"Could not load US states GeoJSON: {e}")
        return None


def aggregate_by_state(state_data: list) -> dict:
    """Aggregate weights by state."""
    if not state_data:
        return {}

    df = pd.DataFrame(state_data)
    aggregates = df.groupby('state').agg({
        'weight': ['sum', 'mean', 'count'],
        'lat': 'mean',
        'lon': 'mean'
    }).reset_index()

    # Flatten column names
    aggregates.columns = ['state', 'total_weight', 'avg_weight', 'point_count', 'center_lat', 'center_lon']

    return aggregates.to_dict('records')


def create_choropleth_figure(state_aggregates: list, us_states_geojson: dict, weight_type: str) -> go.Figure:
    """Create the main choropleth figure."""

    # Since we don't have actual state boundary GeoJSON, create a bubble map instead
    # that simulates a choropleth by using state-level aggregated data

    traces = []

    for state_data in state_aggregates:
        state_name = state_data['state']
        total_weight = state_data['total_weight']
        avg_weight = state_data['avg_weight']
        point_count = state_data['point_count']
        center_lat = state_data['center_lat']
        center_lon = state_data['center_lon']

        # Create a large bubble to represent the state
        bubble_size = max(30, min(100, 30 + np.log10(total_weight + 1) * 40))

        # Color based on average weight
        color_intensity = min(1.0, avg_weight / max([s['avg_weight'] for s in state_aggregates]))
        color = f"rgba(0, 100, 200, {0.3 + color_intensity * 0.5})"

        hover_text = create_state_hover_text(state_data, weight_type)

        trace = go.Scattermapbox(
            lon=[center_lon],
            lat=[center_lat],
            mode="markers",
            marker=dict(
                size=bubble_size,
                color=color,
                opacity=0.6
            ),
            name=f"{state_name} (State Level)",
            customdata=[hover_text],
            hovertemplate="%{customdata}<extra></extra>",
            hoverlabel=dict(
                bgcolor="rgba(0,100,200,0.8)",
                bordercolor="white",
                font=dict(color="white", size=12)
            ),
            showlegend=True
        )
        traces.append(trace)

    # Calculate map center
    if state_aggregates:
        center_lat = np.mean([s['center_lat'] for s in state_aggregates])
        center_lon = np.mean([s['center_lon'] for s in state_aggregates])
        zoom = 4
    else:
        center_lat, center_lon = 39.8283, -98.5795
        zoom = 4

    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": center_lat, "lon": center_lon},
            "zoom": zoom,
        },
        "margin": {"r": 0, "t": 0, "l": 0, "b": 0},
        "title": f"State-Level Choropleth - {weight_type} weights",
        "legend": {
            "title": {"text": "Data Layers"},
            "x": 1,
            "y": 1,
            "bgcolor": "rgba(255,255,255,0.9)",
            "bordercolor": "black",
            "borderwidth": 1
        }
    }

    # Add explanatory annotation
    layout["annotations"] = [
        dict(
            text="🗺️ State-level aggregation shown as bubbles<br>💡 Bubble size = total weight, opacity = average weight",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.02, y=0.98,
            xanchor="left", yanchor="top",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="gray",
            borderwidth=1,
            font=dict(size=11)
        )
    ]

    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    return fig


def add_data_point_overlay(fig: go.Figure, gdf: gpd.GeoDataFrame, weight_type: str, state_data: list) -> go.Figure:
    """Add individual data points as an overlay on the choropleth."""

    # Create a scatter trace for individual data points
    lons, lats, weights, hover_texts = [], [], [], []

    for point_data in state_data[:50]:  # Limit to 50 points for performance
        lons.append(point_data['lon'])
        lats.append(point_data['lat'])
        weights.append(point_data['weight'])

        hover_text = f"<b>Individual Data Point</b><br>"
        hover_text += f"State: {point_data['state']}<br>"
        hover_text += f"Weight ({weight_type}): {point_data['weight']:.3f}<br>"
        hover_text += f"Location: {point_data['lat']:.3f}°N, {point_data['lon']:.3f}°W"
        hover_texts.append(hover_text)

    if lons:
        # Add individual points
        point_trace = go.Scattermapbox(
            lon=lons,
            lat=lats,
            mode="markers",
            marker=dict(
                size=8,
                color="red",
                opacity=0.8
            ),
            name="Individual Data Points",
            customdata=hover_texts,
            hovertemplate="%{customdata}<extra></extra>",
            hoverlabel=dict(
                bgcolor="red",
                bordercolor="white",
                font=dict(color="white", size=10)
            ),
            showlegend=True
        )
        fig.add_trace(point_trace)

    return fig


def create_state_hover_text(state_data: dict, weight_type: str) -> str:
    """Create hover text for state-level aggregated data."""
    hover_parts = [
        f"<b style='color: #1E88E5; font-size: 16px;'>🗺️ {state_data['state']}</b>",
        f"<b style='color: #FF6B35; font-size: 14px;'>Total Weight ({weight_type}): {state_data['total_weight']:.2f}</b>",
        f"<b style='color: #FF8C00; font-size: 13px;'>Average Weight: {state_data['avg_weight']:.3f}</b>",
        f"<b style='color: #32CD32; font-size: 12px;'>Data Points: {state_data['point_count']}</b>",
        "<span style='color: #666;'>─────────────────────────────────</span>",
        f"<b style='color: #555; font-size: 11px;'>State Center:</b> <span style='color: #000; font-size: 11px;'>{state_data['center_lat']:.2f}°N, {state_data['center_lon']:.2f}°W</span>"
    ]

    return "<br>".join(hover_parts)


def create_fallback_state_map(gdf: gpd.GeoDataFrame, weight_type: str, state_data: list, config: dict) -> go.Figure:
    """Fallback to a simple state-aggregated bubble map."""

    if not state_data:
        return create_empty_figure()

    # Aggregate by state
    state_aggregates = aggregate_by_state(state_data)

    # Create simple bubble map
    return create_choropleth_figure(state_aggregates, None, weight_type)


def create_empty_figure() -> go.Figure:
    """Create an empty figure when no data is available."""
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
        text="No data available for state choropleth visualization",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig