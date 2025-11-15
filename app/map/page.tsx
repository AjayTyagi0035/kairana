'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useMap } from 'react-leaflet'; // new import

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import('react-leaflet').then((mod) => mod.GeoJSON),
  { ssr: false }
);

const center: [number, number] = [40.7128, -74.006];

export default function MapPage() {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [activeLayer, setActiveLayer] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const availableLayers = [1, 2, 3, 4, 5]; // manually define if detection removed

  // Styles per layer
  const layerStyles: { [key: number]: any } = {
    1: { color: '#3b82f6', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.4 },
    2: { color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 0.4 },
    3: { color: '#f59e0b', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.4 },
    4: { color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.4 },
    5: { color: '#6366f1', weight: 2, fillColor: '#6366f1', fillOpacity: 0.4 },
  };

  // ⭐ LOAD SHAPEFILES (ZIP)
  const loadShapefile = async (layerNumber: number) => {
    setLoading(true);
    try {
      const shp = await import('shpjs');

      // Load the zip file for the layer
      const zipUrl = `/maps/layer${layerNumber}/layer${layerNumber}.zip`;
      const response = await fetch(zipUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${zipUrl}: ${response.status} ${response.statusText}`);
      }

      const zipBuffer = await response.arrayBuffer();

      // Convert zip to GeoJSON
      const geojson = await shp.default(zipBuffer);

      setGeoJsonData(geojson);
      setActiveLayer(layerNumber);

      // Fit map bounds
      if (mapRef.current && geojson) {
        const bounds = calculateBounds(geojson);
        if (bounds) mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error loading layer ${layerNumber}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate bounding box of GeoJSON
  // return a properly typed LatLngBounds tuple so Leaflet's fitBounds accepts it
  const calculateBounds = (geojson: any): [[number, number], [number, number]] | null => {
    if (!geojson?.features?.length) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    const processCoordinates = (coords: any) => {
      if (typeof coords[0] === 'number') {
        const [lng, lat] = coords;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      } else {
        coords.forEach(processCoordinates);
      }
    };

    geojson.features.forEach((feature: any) => {
      if (feature.geometry?.coordinates) {
        processCoordinates(feature.geometry.coordinates);
      }
    });

    if (minLat === Infinity) return null;
    return [[minLat, minLng], [maxLat, maxLng]];
  };

  const getStyle = () => {
    if (activeLayer && layerStyles[activeLayer]) {
      return layerStyles[activeLayer];
    }
    return { color: '#3b82f6', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.4 };
  };

  // MapListener: capture the Leaflet map instance from react-leaflet context
  function MapListener() {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
      return () => {
        mapRef.current = null;
      };
    }, [map]);
    return null;
  }

  return (
    <div className="h-screen w-full relative">
      {/* Buttons */}
      <div className="absolute top-4 left-4 z-[1000] flex gap-2 flex-wrap">
        {availableLayers.map((layerNum) => (
          <Button
            key={layerNum}
            onClick={() => loadShapefile(layerNum)}
            disabled={loading}
            variant={activeLayer === layerNum ? 'default' : 'outline'}
            className="shadow-lg"
          >
            {loading && activeLayer === layerNum ? "Loading..." : `Layer ${layerNum}`}
          </Button>
        ))}
      </div>

      {/* Map */}
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        {/* insert listener to populate mapRef */}
        <MapListener />

        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geoJsonData && (
          <GeoJSON
            key={activeLayer}
            data={geoJsonData}
            style={getStyle()}
          />
        )}
      </MapContainer>
    </div>
  );
}
