import React, { useEffect, useRef } from 'react';

const MapView = ({ complaints, selectedComplaint = null, height = '400px' }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  const hasInitialFit = useRef(false);

  useEffect(() => {
    if (!window.L || !mapRef.current) return;

    // Initialize map if not already done
    if (!mapInstance.current) {
      mapInstance.current = window.L.map(mapRef.current).setView([15.3647, 75.1240], 12); // Default to Hubballi coordinates
      
      // Track user interaction to stop auto-fitting
      mapInstance.current.on('movestart', () => {
        hasInitialFit.current = true;
      });

      // Standard Google Maps layer
      const googleStreets = window.L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Map data &copy; Google'
      });

      // Hybrid Google Maps layer
      const googleHybrid = window.L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Map data &copy; Google'
      });

      // Satellite Google Maps layer
      const googleSat = window.L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Map data &copy; Google'
      });

      // OSM as fallback
      const osm = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      });

      // Add default layer
      googleStreets.addTo(mapInstance.current);

      // Add layer control
      const baseMaps = {
        "Google Streets": googleStreets,
        "Google Hybrid": googleHybrid,
        "Google Satellite": googleSat,
        "OpenStreetMap": osm
      };
      
      window.L.control.layers(baseMaps).addTo(mapInstance.current);
    }

    const L = window.L;
    const map = mapInstance.current;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    markersRef.current = {};

    // Add markers for complaints with location
    const validComplaints = complaints.filter(c => c.location && c.location.latitude && c.location.longitude);

    if (validComplaints.length > 0) {
      const markers = [];
      validComplaints.forEach(c => {
        const marker = L.marker([c.location.latitude, c.location.longitude])
          .bindPopup(`
            <div style="min-width: 200px">
              <strong style="color: #1e293b; font-size: 1rem;">${c.category}</strong><br/>
              ${c.description ? `<p style="margin: 5px 0; color: #64748b; font-size: 0.85rem;">${c.description.substring(0, 100)}${c.description.length > 100 ? '...' : ''}</p>` : ''}
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                <span style="font-size: 0.75rem; font-weight: 700; color: ${c.priority === 'High' ? '#dc2626' : '#a16207'}">${c.priority} Priority</span>
                <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; background-color: ${c.status === 'Resolved' ? '#f0fdf4' : '#fff7ed'}; color: ${c.status === 'Resolved' ? '#10b981' : '#f97316'}">${c.status}</span>
              </div>
            </div>
          `)
          .addTo(map);
        markers.push(marker);
        markersRef.current[c._id] = marker;
      });

      // Only auto-fit if no complaint is selected and we haven't done it yet
      if (!selectedComplaint && !hasInitialFit.current) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
        hasInitialFit.current = true;
      }
    }

    return () => {};
  }, [complaints]);

  // Handle selected complaint changes
  useEffect(() => {
    if (selectedComplaint && mapInstance.current && markersRef.current[selectedComplaint._id]) {
      const marker = markersRef.current[selectedComplaint._id];
      const map = mapInstance.current;
      
      map.setView(marker.getLatLng(), 16, { animate: true });
      marker.openPopup();
      hasInitialFit.current = true; // Stop auto-fitting after a complaint is selected
    }
  }, [selectedComplaint]);

  return (
    <div 
      ref={mapRef} 
      style={{ 
        height, 
        width: '100%', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        zIndex: 1
      }} 
    />
  );
};

export default MapView;
