# geo_open_source/webapp/display/weighted_options/voronoi_tessellation.py

import logging
import numpy as np
import plotly.graph_objects as go
import geopandas as gpd
import pandas as pd
from scipy.spatial import Voronoi
from ..display import ensure_shapely, center_of, color_for_label

logger = logging.getLogger(__name__)


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original", config: dict = None) -> go.Figure:
    """Create a Voronoi tessellation visualization where cell colors represent weights."""
    logger.info(f"Creating Voronoi tessellation display from {len(gdf)} features with weight_type: {weight_type}")
    print(f"🔶 DEBUG: voronoi_tessellation.figure() called with {len(gdf)} rows, weight_type='{weight_type}'")

    if config:
        print(f"🔧 DEBUG: Config received: {config}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to Voronoi tessellation")
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

    # Extract Voronoi data
    voronoi_data = extract_voronoi_data(gdf, weight_type)

    if not voronoi_data or len(voronoi_data['points']) < 3:
        logger.warning("Insufficient points for Voronoi tessellation (need at least 3)")
        return create_empty_figure()

    print(f"🔶 DEBUG: Extracted {len(voronoi_data['points'])} points for Voronoi tessellation")

    # Create Voronoi tessellation
    try:
        vor = Voronoi(voronoi_data['coordinates'])
        print(
            f"🔶 DEBUG: Voronoi tessellation successful - {len(vor.regions)} regions, {len(vor.ridge_vertices)} ridges")
    except Exception as e:
        logger.error(f"Voronoi tessellation failed: {e}")
        print(f"❌ DEBUG: Voronoi tessellation failed: {e}")
        return create_fallback_figure(voronoi_data, weight_type, config)

    # Create Voronoi figure
    fig = create_voronoi_figure(vor, voronoi_data, weight_type, config)

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

    logger.info(f"Successfully created Voronoi tessellation with {len(vor.regions)} regions")
    print(f"✅ DEBUG: Voronoi tessellation created with {len(vor.regions)} regions")

    return fig


def extract_voronoi_data(gdf: gpd.GeoDataFrame, weight_type: str) -> dict:
    """Extract point data for Voronoi tessellation."""
    points_data = []
    coordinates = []

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

        # Get dataset name for coloring
        dataset_name = str(row.get("Dataset", "Voronoi Data")) if "Dataset" in gdf.columns else "Voronoi Data"

        # Handle different geometry types - only process points
        if geom.geom_type == "Point":
            points_data.append({
                'lon': geom.x,
                'lat': geom.y,
                'weight': weight,
                'dataset': dataset_name,
                'original_data': row.to_dict()
            })
            coordinates.append([geom.x, geom.y])
        elif geom.geom_type == "MultiPoint":
            for point in geom.geoms:
                points_data.append({
                    'lon': point.x,
                    'lat': point.y,
                    'weight': weight,
                    'dataset': dataset_name,
                    'original_data': row.to_dict()
                })
                coordinates.append([point.x, point.y])

    return {
        'points': points_data,
        'coordinates': np.array(coordinates) if coordinates else np.array([])
    }


def create_voronoi_figure(vor: Voronoi, voronoi_data: dict, weight_type: str, config: dict) -> go.Figure:
    """Create the main Voronoi tessellation figure."""

    points = voronoi_data['points']
    coordinates = voronoi_data['coordinates']

    # Calculate bounds for clipping infinite regions
    bounds = {
        'min_x': coordinates[:, 0].min() - 0.1,
        'max_x': coordinates[:, 0].max() + 0.1,
        'min_y': coordinates[:, 1].min() - 0.1,
        'max_y': coordinates[:, 1].max() + 0.1
    }

    traces = []

    # Create Voronoi cell polygons
    print(f"🔶 DEBUG: Processing {len(vor.regions)} Voronoi regions")

    for point_idx, point_data in enumerate(points):
        # Find the region containing this point
        region_idx = vor.point_region[point_idx]
        region = vor.regions[region_idx]

        if not region or -1 in region:
            # Skip infinite regions or empty regions
            continue

        # Get vertices for this region
        polygon_vertices = [vor.vertices[i] for i in region]

        if len(polygon_vertices) < 3:
            continue

        # Close the polygon
        polygon_vertices.append(polygon_vertices[0])

        # Extract coordinates
        poly_lons = [v[0] for v in polygon_vertices]
        poly_lats = [v[1] for v in polygon_vertices]

        # Clip polygon to reasonable bounds (remove extreme vertices)
        clipped_lons, clipped_lats = clip_polygon(poly_lons, poly_lats, bounds)

        if len(clipped_lons) < 4:  # Need at least 3 vertices + closure
            continue

        # Create color based on weight
        weight = point_data['weight']
        # Normalize weight for color scaling
        all_weights = [p['weight'] for p in points]
        if len(set(all_weights)) > 1:
            weight_normalized = (weight - min(all_weights)) / (max(all_weights) - min(all_weights))
        else:
            weight_normalized = 0.5

        # Create color - use a gradient from light blue to dark red
        color_intensity = weight_normalized
        color = f"rgba({int(255 * color_intensity)}, {int(100 * (1 - color_intensity))}, {int(255 * (1 - color_intensity))}, 0.6)"

        # Create hover text
        hover_text = create_voronoi_hover_text(point_data, weight_type)

        # Create polygon trace
        polygon_trace = go.Scattermapbox(
            lon=clipped_lons,
            lat=clipped_lats,
            mode='lines',
            fill='toself',
            fillcolor=color,
            line=dict(color="black", width=1),
            name=f"Voronoi Cell",
            customdata=[hover_text] * len(clipped_lons),
            hovertemplate='%{customdata}<extra></extra>',
            hoverlabel=dict(
                bgcolor=color,
                bordercolor="black",
                font=dict(color="white", size=11)
            ),
            showlegend=False
        )
        traces.append(polygon_trace)

    # Add original points as markers
    point_lons = [p['lon'] for p in points]
    point_lats = [p['lat'] for p in points]
    point_weights = [p['weight'] for p in points]
    point_hovers = [create_voronoi_hover_text(p, weight_type) for p in points]

    # Determine if we have multiple datasets
    datasets = [p['dataset'] for p in points]
    unique_datasets = list(set(datasets))
    has_multiple_datasets = len(unique_datasets) > 1

    if has_multiple_datasets:
        # Create separate point traces for each dataset
        dataset_colors = {}
        for dataset in unique_datasets:
            dataset_colors[dataset] = color_for_label(dataset)

        for dataset in unique_datasets:
            dataset_indices = [i for i, d in enumerate(datasets) if d == dataset]
            dataset_lons = [point_lons[i] for i in dataset_indices]
            dataset_lats = [point_lats[i] for i in dataset_indices]
            dataset_weights = [point_weights[i] for i in dataset_indices]
            dataset_hovers = [point_hovers[i] for i in dataset_indices]

            point_trace = go.Scattermapbox(
                lon=dataset_lons,
                lat=dataset_lats,
                mode='markers',
                marker=dict(
                    size=10,
                    color=dataset_colors[dataset],
                    opacity=1.0
                    # Note: Scattermapbox markers don't support line property
                ),
                name=f"{dataset} (Centers)",
                customdata=dataset_hovers,
                hovertemplate='%{customdata}<extra></extra>',
                hoverlabel=dict(
                    bgcolor=dataset_colors[dataset],
                    bordercolor="white",
                    font=dict(color="white", size=11)
                )
            )
            traces.append(point_trace)
    else:
        # Single point trace
        point_trace = go.Scattermapbox(
            lon=point_lons,
            lat=point_lats,
            mode='markers',
            marker=dict(
                size=10,
                color="black",
                opacity=1.0
                # Note: Scattermapbox markers don't support line property
            ),
            name="Voronoi Centers",
            customdata=point_hovers,
            hovertemplate='%{customdata}<extra></extra>',
            hoverlabel=dict(
                bgcolor="black",
                bordercolor="white",
                font=dict(color="white", size=11)
            )
        )
        traces.append(point_trace)

    # Calculate map center and zoom
    center_lon = np.mean(point_lons) if point_lons else -98.5795
    center_lat = np.mean(point_lats) if point_lats else 39.8283

    if len(point_lons) > 1:
        lon_range = max(point_lons) - min(point_lons)
        lat_range = max(point_lats) - min(point_lats)
        max_range = max(lon_range, lat_range)

        if max_range < 0.1:
            zoom = 11
        elif max_range < 1:
            zoom = 7
        elif max_range < 5:
            zoom = 5
        else:
            zoom = 3
    else:
        zoom = 6

    # Create layout
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": center_lat, "lon": center_lon},
            "zoom": zoom,
        },
        "margin": {"r": 0, "t": 80, "b": 0, "l": 0},
        "title": {
            "text": f"Voronoi Tessellation - Cell colors represent {weight_type} values",
            "x": 0.5,
            "font": {"size": 16}
        },
        "showlegend": True,
        "legend": {
            "x": 1.02,
            "y": 1,
            "bgcolor": "rgba(255,255,255,0.9)",
            "bordercolor": "black",
            "borderwidth": 1
        }
    }

    # Add explanatory annotation
    layout["annotations"] = [
        dict(
            text="🔶 Voronoi Tessellation<br>💡 Each cell shows the region closest to a data point<br>🎨 Cell color intensity represents weight values",
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


def clip_polygon(lons: list, lats: list, bounds: dict) -> tuple:
    """Clip polygon vertices to reasonable bounds."""
    clipped_lons = []
    clipped_lats = []

    for lon, lat in zip(lons, lats):
        # Clip to bounds
        clipped_lon = max(bounds['min_x'], min(bounds['max_x'], lon))
        clipped_lat = max(bounds['min_y'], min(bounds['max_y'], lat))

        clipped_lons.append(clipped_lon)
        clipped_lats.append(clipped_lat)

    return clipped_lons, clipped_lats


def create_voronoi_hover_text(point_data: dict, weight_type: str) -> str:
    """Create hover text for Voronoi cells and points."""
    hover_parts = []

    # Title
    original_data = point_data['original_data']
    title_fields = ['name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME']
    title = None
    for field in title_fields:
        if field in original_data and pd.notna(original_data[field]):
            title = str(original_data[field])
            break

    if title:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🔶 {title}</b>")
    else:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🔶 Voronoi Cell</b>")

    # Weight information
    hover_parts.append(
        f"<b style='color: #FF6B35; font-size: 13px;'>Weight ({weight_type}): {point_data['weight']:.3f}</b>")
    hover_parts.append("<span style='color: #666;'>─────────────────────────────────────</span>")

    # Voronoi explanation
    hover_parts.append("<b style='color: #555; font-size: 11px;'>Voronoi Cell:</b>")
    hover_parts.append(
        "<span style='color: #333; font-size: 10px;'>This region contains all points closest to this data point</span>")
    hover_parts.append("<span style='color: #666;'>─────────────────────────────────────</span>")

    # Location and dataset info
    hover_parts.append(
        f"<b style='color: #555; font-size: 10px;'>Center:</b> <span style='color: #000; font-size: 10px;'>{point_data['lat']:.4f}°N, {point_data['lon']:.4f}°W</span>")
    hover_parts.append(
        f"<b style='color: #555; font-size: 10px;'>Dataset:</b> <span style='color: #000; font-size: 10px;'>{point_data['dataset']}</span>")

    # Additional fields from original data
    priority_fields = ['State', 'County', 'City', 'Type', 'Category']
    shown_fields = set(['geometry', 'name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME'])

    for field in priority_fields:
        if field in original_data and pd.notna(original_data[field]) and field not in shown_fields:
            value = str(original_data[field])
            hover_parts.append(
                f"<b style='color: #555; font-size: 10px;'>{field}:</b> <span style='color: #000; font-size: 10px;'>{value}</span>")
            shown_fields.add(field)

    return "<br>".join(hover_parts)


def create_fallback_figure(voronoi_data: dict, weight_type: str, config: dict) -> go.Figure:
    """Create a fallback figure when Voronoi tessellation fails."""
    points = voronoi_data['points']

    if not points:
        return create_empty_figure()

    # Create simple point map as fallback
    lons = [p['lon'] for p in points]
    lats = [p['lat'] for p in points]
    weights = [p['weight'] for p in points]
    hovers = [create_voronoi_hover_text(p, weight_type) for p in points]

    trace = go.Scattermapbox(
        lon=lons,
        lat=lats,
        mode='markers',
        marker=dict(
            size=15,
            color=weights,
            colorscale='Viridis',
            opacity=0.8,
            colorbar=dict(
                title=f"Weight ({weight_type})",
                x=1.02,
                len=0.8
            )
        ),
        name="Data Points (Voronoi Failed)",
        customdata=hovers,
        hovertemplate='%{customdata}<extra></extra>',
        hoverlabel=dict(
            bgcolor="rgba(50,50,50,0.8)",
            bordercolor="white",
            font=dict(color="white", size=11)
        )
    )

    center_lat = np.mean(lats) if lats else 39.8283
    center_lon = np.mean(lons) if lons else -98.5795

    fig = go.Figure(data=[trace])
    fig.update_layout(
        mapbox=dict(
            style="open-street-map",
            center=dict(lat=center_lat, lon=center_lon),
            zoom=6
        ),
        margin=dict(r=0, t=50, b=0, l=0),
        title="Voronoi Tessellation Failed - Showing Points Only"
    )

    return fig


def create_empty_figure() -> go.Figure:
    """Create an empty figure when no data is available."""
    fig = go.Figure()
    fig.update_layout(
        mapbox_style="open-street-map",
        mapbox_center={"lat": 39.8283, "lon": -98.5795},
        mapbox_zoom=3,
        margin={"r": 0, "t": 50, "b": 0, "l": 0}
    )

    fig.add_annotation(
        x=0.5, y=0.5,
        xref="paper", yref="paper",
        text="No data available for Voronoi tessellation visualization<br>Need at least 3 points for tessellation",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig