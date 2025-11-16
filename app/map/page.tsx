'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useMap } from 'react-leaflet';

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
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

const center: [number, number] = [40.7128, -74.006];

export default function MapPage() {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [activeLayer, setActiveLayer] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [householdData, setHouseholdData] = useState<any>(null);
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

      // Convert zip to GeoJSON - this will include all data from DBF files
      const geojson = await shp.default(zipBuffer);

      setGeoJsonData(geojson);
      setActiveLayer(layerNumber);

      // For layer 2 (points), extract household data from the geojson properties
      if (layerNumber === 2) {
        const extractedHouseholdData = extractHouseholdDataFromGeoJSON(geojson);
        setHouseholdData(extractedHouseholdData);
      } else {
        setHouseholdData(null);
      }

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

  // Extract household data from GeoJSON properties (from DBF file)
  const extractHouseholdDataFromGeoJSON = (geojson: any) => {
    const data: { [key: string]: any } = {};
    
    if (geojson?.features) {
      geojson.features.forEach((feature: any, index: number) => {
        const properties = feature.properties || {};
        
        // Try different possible ID field names
        const possibleIds = ['id', 'ID', 'fid', 'FID', 'objectid', 'OBJECTID', 'gid', 'GID'];
        let featureId = null;
        
        for (const idField of possibleIds) {
          if (properties[idField] !== undefined) {
            featureId = properties[idField];
            break;
          }
        }
        
        // If no ID found, use array index
        if (featureId === null) {
          featureId = index;
        }
        
        // Store all properties as household data
        const householdInfo = Object.entries(properties)
          .filter(([key, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => `${key}: ${value}`)
          .join('<br/>');
        
        data[featureId] = householdInfo;
      });
    }
    
    console.log('Extracted household data:', data); // Debug log
    return data;
  };

  // Custom point to layer function for markers
  const pointToLayer = (feature: any, latlng: any) => {
    if (typeof window !== 'undefined') {
      const L = require('leaflet');
      
      try {
        // Try to create custom icon with fallback
        const customIcon = new L.Icon({
          iconUrl: 'data:image/svg+xml;base64,' + btoa(`
            <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 0C5.6 0 0 5.6 0 12.5S12.5 41 12.5 41 25 19.4 25 12.5 19.4 0 12.5 0z" fill="#10b981"/>
              <circle cx="12.5" cy="12.5" r="6" fill="white"/>
            </svg>
          `),
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        });

        return L.marker(latlng, { icon: customIcon });
      } catch (error) {
        // Fallback to circle marker if icon creation fails
        return L.circleMarker(latlng, {
          radius: 8,
          fillColor: '#10b981',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        });
      }
    }
    return null;
  };

  // Handle popup content for points
  const onEachFeature = (feature: any, layer: any) => {
    if (feature.geometry.type === 'Point' && activeLayer === 2) {
      const properties = feature.properties || {};
      
      // Try to find the feature ID using various possible field names
      const possibleIds = ['id', 'ID', 'fid', 'FID', 'objectid', 'OBJECTID', 'gid', 'GID'];
      let featureId = 'Unknown';
      
      for (const idField of possibleIds) {
        if (properties[idField] !== undefined) {
          featureId = properties[idField];
          break;
        }
      }
      
      // If no ID found, try to match by array index
      if (featureId === 'Unknown' && geoJsonData?.features) {
        const featureIndex = geoJsonData.features.findIndex((f: any) => f === feature);
        if (featureIndex !== -1) {
          featureId = featureIndex;
        }
      }
      
      const householdInfo = householdData?.[featureId];
      
      const popupContent = `
        <div style="max-width: 300px;">
          <strong>Feature ID:</strong> ${featureId}<br/><br/>
          ${householdInfo ? `<strong>Household Data:</strong><br/>${householdInfo}` : `
            <strong>Available Properties:</strong><br/>
            ${Object.entries(properties)
              .filter(([key, value]) => value !== null && value !== undefined && value !== '')
              .map(([key, value]) => `${key}: ${value}`)
              .join('<br/>') || 'No data available'}
          `}
        </div>
      `;
      
      layer.bindPopup(popupContent);
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

  // Determine if current layer has points
  const isPointLayer = () => {
    return geoJsonData?.features?.some((feature: any) => 
      feature.geometry?.type === 'Point'
    );
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
            key={`${activeLayer}-${geoJsonData.features?.length}`}
            data={geoJsonData}
            style={isPointLayer() ? undefined : getStyle()}
            pointToLayer={isPointLayer() ? pointToLayer : undefined}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}
