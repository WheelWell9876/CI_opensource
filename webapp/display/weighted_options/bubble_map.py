# geo_open_source/webapp/display/weighted_options/bubble_map.py

import logging
import numpy as np
import plotly.graph_objects as go
import geopandas as gpd
import pandas as pd
from scipy.spatial.distance import pdist, squareform

from ..display import ensure_shapely, center_of, color_for_label

logger = logging.getLogger(__name__)


def figure(gdf: gpd.GeoDataFrame, weight_type: str = "original", config: dict = None) -> go.Figure:
    """Create a clustered bubble map visualization where bubble size represents aggregated weights."""
    logger.info(f"Creating clustered bubble map display from {len(gdf)} features with weight_type: {weight_type}")
    print(f"🔧 DEBUG: bubble_map.figure() called with {len(gdf)} rows, weight_type='{weight_type}'")

    if config:
        print(f"🔧 DEBUG: Config received: {config}")

    if gdf.empty:
        logger.warning("Empty GeoDataFrame provided to bubble_map")
        return create_empty_figure()

    # Apply data fraction sampling if specified
    original_size = len(gdf)
    data_fraction = 1.0

    print(f"🔧 DEBUG: Config received in bubble_map: {config}")

    if config and 'data_fraction' in config:
        data_fraction = config['data_fraction']
        print(f"📊 DEBUG: Found data_fraction in config: {data_fraction}")
    elif config and 'dataFraction' in config:  # Handle both naming conventions
        data_fraction = config['dataFraction']
        print(f"📊 DEBUG: Found dataFraction in config: {data_fraction}")
    else:
        print(f"📊 DEBUG: No data fraction found in config, using default: {data_fraction}")

    print(f"📊 DEBUG: Original dataset size: {original_size}")
    print(f"📊 DEBUG: Data fraction to use: {data_fraction}")

    if data_fraction < 1.0 and len(gdf) > 10:  # Only sample if we have enough data
        sample_size = max(10, int(len(gdf) * data_fraction))  # Minimum 10 points
        print(f"📊 DEBUG: Calculated sample size: {sample_size}")
        gdf = gdf.sample(n=sample_size, random_state=42).reset_index(drop=True)
        print(f"📊 DEBUG: After sampling - actual dataset size: {len(gdf)}")
        print(f"📊 DEBUG: Sampled {len(gdf)} points from {original_size} ({data_fraction * 100:.1f}%)")
    else:
        print(f"📊 DEBUG: Using all {len(gdf)} data points (no sampling applied)")

    # Extract points and weights
    points_data = []
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

        # Get dataset name
        dataset_name = str(row.get("Dataset", "Bubble Data")) if "Dataset" in gdf.columns else "Bubble Data"

        # Handle different geometry types
        if geom.geom_type == "Point":
            points_data.append({
                'lon': geom.x,
                'lat': geom.y,
                'weight': weight,
                'dataset': dataset_name,
                'original_data': row.to_dict()
            })
        elif geom.geom_type == "MultiPoint":
            for point in geom.geoms:
                points_data.append({
                    'lon': point.x,
                    'lat': point.y,
                    'weight': weight,
                    'dataset': dataset_name,
                    'original_data': row.to_dict()
                })

    if not points_data:
        logger.warning("No valid point data found for clustering")
        return create_empty_figure()

    # Convert to DataFrame for easier processing
    points_df = pd.DataFrame(points_data)

    # Perform spatial clustering using simple distance-based clustering
    clustered_bubbles = cluster_points_simple(points_df, distance_threshold=0.5)  # Adjust threshold as needed

    print(f"🎯 DEBUG: Clustered {len(points_data)} points into {len(clustered_bubbles)} bubbles")

    # Create traces
    traces = []
    dataset_colors = {}
    seen_datasets = set()
    all_lons, all_lats = [], []

    for bubble in clustered_bubbles:
        # Determine dominant dataset for coloring
        dominant_dataset = bubble['dominant_dataset']
        if dominant_dataset not in dataset_colors:
            dataset_colors[dominant_dataset] = "#1E88E5"  # Blue color as requested

        # Calculate bubble size based on total weight
        total_weight = bubble['total_weight']
        if total_weight > 0:
            # Logarithmic scaling for better visual differentiation
            bubble_size = max(15, min(80, 20 + np.log10(total_weight + 1) * 30))
        else:
            bubble_size = 15

        # Create hover text
        hover_text = create_cluster_hover_text(bubble, weight_type)

        # Add coordinates for map centering
        all_lons.append(bubble['center_lon'])
        all_lats.append(bubble['center_lat'])

        # Create trace
        trace = go.Scattermapbox(
            lon=[bubble['center_lon']],
            lat=[bubble['center_lat']],
            mode="markers",
            marker=dict(
                size=bubble_size,
                color=dataset_colors[dominant_dataset],
                opacity=0.7
                # Note: Scattermapbox markers don't support line/border properties
            ),
            name=dominant_dataset,
            customdata=[hover_text],
            hovertemplate="%{customdata}<extra></extra>",
            hoverlabel=dict(
                bgcolor=dataset_colors[dominant_dataset],
                bordercolor="white",
                font=dict(color="white", size=11)
            ),
            showlegend=dominant_dataset not in seen_datasets,
            legendgroup=dominant_dataset
        )
        traces.append(trace)
        seen_datasets.add(dominant_dataset)

    if not traces:
        logger.warning("No valid traces created for clustered bubble map")
        return create_empty_figure()

    print(f"✅ DEBUG: Created {len(traces)} clustered bubble traces")

    # Calculate map center and zoom
    if all_lons and all_lats:
        cx, cy = center_of(all_lons, all_lats)
        lon_range = max(all_lons) - min(all_lons) if len(all_lons) > 1 else 0
        lat_range = max(all_lats) - min(all_lats) if len(all_lats) > 1 else 0
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
        cx, cy = -98.5795, 39.8283
        zoom = 4

    # Create layout
    layout = {
        "mapbox": {
            "style": "open-street-map",
            "center": {"lat": cy, "lon": cx},
            "zoom": zoom,
        },
        "margin": {"r": 0, "t": 0, "l": 0, "b": 0},
        "title": f"Clustered Bubble Map - Size represents aggregated {weight_type}",
        "hovermode": "closest",
        "hoverdistance": 30,
    }

    # Add legend if multiple datasets
    if len(seen_datasets) > 1:
        layout["legend"] = {
            "title": {"text": f"Datasets (Bubble size: {weight_type})"},
            "x": 1,
            "y": 1,
            "bgcolor": "rgba(255,255,255,0.9)",
            "bordercolor": "black",
            "borderwidth": 1
        }

    # Add annotations
    annotations = [
        dict(
            text=f"💡 Bubble size represents clustered {weight_type} values<br>Nearby points are merged into larger bubbles",
            showarrow=False,
            xref="paper", yref="paper",
            x=0.02, y=0.98,
            xanchor="left", yanchor="top",
            bgcolor="rgba(255,255,255,0.8)",
            bordercolor="gray",
            borderwidth=1,
            font=dict(size=12)
        )
    ]

    # Add sampling info if data was sampled
    if data_fraction < 1.0:
        annotations.append(
            dict(
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
        )

    layout["annotations"] = annotations

    fig = go.Figure(data=traces)
    fig.update_layout(**layout)

    logger.info(f"Successfully created clustered bubble map with {len(traces)} bubbles")
    print(f"✅ DEBUG: Clustered bubble map created successfully with {len(traces)} bubbles")

    return fig


def cluster_points_simple(points_df: pd.DataFrame, distance_threshold: float = 0.5) -> list:
    """
    Simple clustering algorithm using only numpy and pandas.
    Groups nearby points and aggregates their weights.

    Args:
        points_df: DataFrame with columns 'lon', 'lat', 'weight', 'dataset', 'original_data'
        distance_threshold: Distance threshold for clustering (in degrees)

    Returns:
        List of clustered bubble dictionaries
    """
    if len(points_df) == 0:
        return []

    # Convert to numpy arrays for faster computation
    coords = points_df[['lon', 'lat']].values
    n_points = len(coords)

    # Calculate distance matrix using vectorized operations
    # Using Euclidean distance in lat/lon space (good enough for visualization)
    lon_diff = coords[:, 0:1] - coords[:, 0:1].T  # Broadcasting to get all pairwise differences
    lat_diff = coords[:, 1:2] - coords[:, 1:2].T
    distances = np.sqrt(lon_diff ** 2 + lat_diff ** 2)

    # Simple clustering: merge points within threshold distance
    visited = np.zeros(n_points, dtype=bool)
    clusters = []

    for i in range(n_points):
        if visited[i]:
            continue

        # Find all points within threshold distance of point i
        cluster_mask = distances[i] <= distance_threshold
        cluster_indices = np.where(cluster_mask)[0]

        # Mark these points as visited
        visited[cluster_indices] = True

        # Create cluster
        cluster_points = points_df.iloc[cluster_indices]
        clusters.append(cluster_points)

    # Convert clusters to bubble format
    clustered_bubbles = []

    for cluster_id, cluster_points in enumerate(clusters):
        # Calculate cluster properties
        center_lon = cluster_points['lon'].mean()
        center_lat = cluster_points['lat'].mean()
        total_weight = cluster_points['weight'].sum()
        point_count = len(cluster_points)

        # Determine dominant dataset
        dataset_counts = cluster_points['dataset'].value_counts()
        dominant_dataset = dataset_counts.index[0]

        # Collect all original data for hover info
        original_data_list = cluster_points['original_data'].tolist()

        clustered_bubbles.append({
            'center_lon': center_lon,
            'center_lat': center_lat,
            'total_weight': total_weight,
            'point_count': point_count,
            'dominant_dataset': dominant_dataset,
            'dataset_distribution': dataset_counts.to_dict(),
            'original_data_list': original_data_list,
            'cluster_id': cluster_id
        })

    return clustered_bubbles


def create_cluster_hover_text(bubble: dict, weight_type: str) -> str:
    """Create comprehensive hover text for clustered bubbles."""
    hover_parts = []

    # Cluster summary
    point_count = bubble['point_count']
    total_weight = bubble['total_weight']

    if point_count == 1:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🫧 Single Data Point</b>")
    else:
        hover_parts.append(f"<b style='color: #1E88E5; font-size: 14px;'>🫧 Clustered Bubble ({point_count} points)</b>")

    # Weight information
    hover_parts.append(
        f"<b style='color: #FF6B35; font-size: 13px;'>Total Weight ({weight_type}): {total_weight:.3f}</b>")

    if point_count > 1:
        avg_weight = total_weight / point_count
        hover_parts.append(
            f"<b style='color: #FF8C00; font-size: 12px;'>Average Weight: {avg_weight:.3f}</b>")

    hover_parts.append("<span style='color: #666;'>─────────────────────────────────────────</span>")

    # Dataset distribution
    dataset_dist = bubble['dataset_distribution']
    if len(dataset_dist) > 1:
        hover_parts.append("<b style='color: #555; font-size: 11px;'>Dataset Distribution:</b>")
        for dataset, count in dataset_dist.items():
            percentage = (count / point_count) * 100
            hover_parts.append(
                f"<span style='color: #333; font-size: 10px;'>  • {dataset}: {count} ({percentage:.1f}%)</span>")
    else:
        dataset_name = list(dataset_dist.keys())[0]
        hover_parts.append(
            f"<b style='color: #555; font-size: 11px;'>Dataset:</b> <span style='color: #000; font-size: 11px;'>{dataset_name}</span>")

    # Location info
    hover_parts.append("<span style='color: #666;'>─────────────────────────────────────────</span>")
    hover_parts.append(
        f"<b style='color: #555; font-size: 10px;'>Center:</b> <span style='color: #000; font-size: 10px;'>{bubble['center_lat']:.4f}°N, {bubble['center_lon']:.4f}°W</span>")

    # Sample data from the cluster (show first few items)
    if bubble['original_data_list']:
        hover_parts.append("<span style='color: #666;'>─────────────────────────────────────────</span>")
        hover_parts.append("<b style='color: #555; font-size: 10px;'>Sample Data:</b>")

        # Show up to 3 sample records
        sample_count = min(3, len(bubble['original_data_list']))
        for i in range(sample_count):
            data = bubble['original_data_list'][i]

            # Try to find a meaningful name field
            name_fields = ['name', 'Name', 'title', 'Title', 'facility_name', 'FACILITY_NAME']
            name = None
            for field in name_fields:
                if field in data and pd.notna(data[field]):
                    name = str(data[field])[:30]  # Truncate long names
                    break

            if name:
                hover_parts.append(f"<span style='color: #333; font-size: 9px;'>  • {name}</span>")
            else:
                hover_parts.append(f"<span style='color: #333; font-size: 9px;'>  • Data point {i + 1}</span>")

        if len(bubble['original_data_list']) > sample_count:
            remaining = len(bubble['original_data_list']) - sample_count
            hover_parts.append(f"<i style='color: #888; font-size: 9px;'>  ... +{remaining} more points</i>")

    return "<br>".join(hover_parts)


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
        text="No data available for bubble map visualization",
        showarrow=False,
        font=dict(size=16, color="gray"),
        bgcolor="rgba(255,255,255,0.8)",
        bordercolor="gray",
        borderwidth=1
    )

    return fig