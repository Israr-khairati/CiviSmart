import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';

const MapPicker = ({ onLocationSelect, initialLocation = null, externalSearchQuery = '' }) => {
  const { t } = useTranslation();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const lastSearchedQuery = useRef('');
  const searchTimeout = useRef(null);
  const activeFetchId = useRef(0);
  const geocodeCache = useRef(new Map());
  const [mapContainer, setMapContainer] = useState(null);
  const lastSetLocation = useRef({ lat: null, lng: null });

  useEffect(() => {
    // Find the container for the map portal
    const container = document.getElementById('map-only-container');
    if (container) {
      setMapContainer(container);
    } else {
      // Retry after a short delay if not found immediately (e.g. if parent is still rendering)
      const timer = setTimeout(() => {
        const retryContainer = document.getElementById('map-only-container');
        if (retryContainer) setMapContainer(retryContainer);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const fetchAddress = async (lat, lng) => {
    // Round coordinates to 5 decimal places (~1.1 meters) for caching
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (geocodeCache.current.has(cacheKey)) {
      return geocodeCache.current.get(cacheKey);
    }

    const fetchId = ++activeFetchId.current;

    // Create a controller to abort other requests once we get the first successful result
    const controller = new AbortController();
    const { signal } = controller;

    try {
      // Try multiple services for better reliability
      const fetchers = [];

      // 1. Nominatim (Free, with 1.5s timeout)
      fetchers.push(fetchNominatimAddress(lat, lng, signal));

      // 2. Google (if available, with 2s timeout)
      if (window.google && window.google.maps) {
        fetchers.push((async () => {
          const geocoder = new window.google.maps.Geocoder();
          const latlng = { lat: parseFloat(lat), lng: parseFloat(lng) };

          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Google timeout')), 2000);

            geocoder.geocode({ location: latlng }, (results, status) => {
              clearTimeout(timeoutId);
              if (status === "OK" && results[0]) {
                resolve(results[0].formatted_address);
              } else {
                reject(new Error('Google geocoding failed'));
              }
            });
          });
        })());
      }

      const address = await Promise.any(fetchers);

      // Cancel remaining requests
      controller.abort();

      if (address && fetchId === activeFetchId.current) {
        geocodeCache.current.set(cacheKey, address);
        return address;
      }
      return fetchId === activeFetchId.current ? address : null;
    } catch (error) {
      if (error.name === 'AbortError') return fetchId === activeFetchId.current ? '' : null;
      console.error('All address fetchers failed:', error);
      return fetchId === activeFetchId.current ? '' : null;
    }
  };

  const fetchNominatimAddress = async (lat, lng, signal) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CiviSmart-Gov/1.0'
          },
          signal: signal || AbortSignal.timeout(3000)
        }
      );
      if (!response.ok) throw new Error('Nominatim request failed');
      const data = await response.json();

      if (data.address) {
        const addr = data.address;
        const parts = [];

        if (addr.house_number) parts.push(addr.house_number);
        if (addr.road) parts.push(addr.road);
        if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
        if (addr.city_district) parts.push(addr.city_district);
        if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
        if (addr.postcode) parts.push(addr.postcode);

        if (parts.length > 0) {
          return parts.join(', ');
        }
      }

      return data.display_name || '';
    } catch (error) {
      throw error; // Rethrow for Promise.any
    }
  };

  const handleSearch = async (query) => {
    if (!query || !query.trim() || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    setShowSuggestions(true);

    try {
      // 1. Try Google Places first if available (for better results)
      if (window.google && window.google.maps && window.google.maps.places) {
        const service = new window.google.maps.places.AutocompleteService();

        // Safety timeout for Google Places
        const googleTimeout = setTimeout(() => {
          console.warn('Google Places timed out, falling back to Nominatim');
          fetchNominatimSearch(query);
        }, 3500);

        service.getPlacePredictions({
          input: query,
          componentRestrictions: { country: 'in' }
        }, (predictions, status) => {
          clearTimeout(googleTimeout);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            const formattedSuggestions = predictions.map(p => ({
              display_name: p.description,
              place_id: p.place_id,
              isGoogle: true
            }));
            setSuggestions(formattedSuggestions);
            setIsSearching(false);
          } else {
            console.log('Google Places status:', status, 'falling back to Nominatim');
            fetchNominatimSearch(query);
          }
        });
        return;
      }

      // 2. Fallback to Nominatim
      await fetchNominatimSearch(query);
    } catch (error) {
      console.error('Search error:', error);
      setSuggestions([]);
      setIsSearching(false);
    }
  };

  const fetchNominatimSearch = async (query) => {
    try {
      // Get current map center to bias results for "nearby" suggestions
      let biasParams = '';
      if (mapInstance.current) {
        const center = mapInstance.current.getCenter();
        // Use a 1 degree bounding box around current center for bias
        const viewbox = [
          center.lng - 0.5,
          center.lat - 0.5,
          center.lng + 0.5,
          center.lat + 0.5
        ].join(',');
        biasParams = `&viewbox=${viewbox}&bounded=0`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=in${biasParams}`,
        {
          headers: {
            'User-Agent': 'CiviSmart-Gov/1.0 (contact: support@civismart.gov)'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Nominatim error: ${response.status}`);
      }

      const data = await response.json();
      const formatted = data.map(item => ({
        display_name: item.display_name,
        lat: item.lat,
        lon: item.lon,
        isGoogle: false
      }));
      setSuggestions(formatted);
    } catch (error) {
      console.error('Nominatim search error:', error);
      if (error.name === 'AbortError') {
        console.warn('Nominatim search timed out');
      }
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSuggestion = async (suggestion) => {
    console.log('Selecting suggestion:', suggestion);
    setIsSearching(true);
    setShowSuggestions(false);

    if (suggestion.isGoogle && window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: suggestion.place_id }, (results, status) => {
        setIsSearching(false);
        if (status === "OK" && results[0]) {
          const { lat, lng } = results[0].geometry.location;
          updateMapLocation(lat(), lng(), results[0].formatted_address);
        }
      });
    } else {
      const { lat, lon, display_name } = suggestion;
      setIsSearching(false);
      updateMapLocation(parseFloat(lat), parseFloat(lon), display_name);
    }
  };

  const updateMapLocation = (newLat, newLng, address) => {
    console.log('Updating map location:', newLat, newLng, address);
    if (mapInstance.current) {
      // Use higher zoom level for better accuracy (18 instead of 16)
      mapInstance.current.setView([newLat, newLng], 18);
      lastSetLocation.current = { lat: newLat, lng: newLng };

      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng]);
      } else if (window.L) {
        markerRef.current = window.L.marker([newLat, newLng], { draggable: true }).addTo(mapInstance.current);
        markerRef.current.on('dragend', async (event) => {
          const marker = event.target;
          const position = marker.getLatLng();
          const address = await fetchAddress(position.lat, position.lng);
          onLocationSelect(position.lat, position.lng, address);
        });
      }

      onLocationSelect(newLat, newLng, address);
    }
    setShowSuggestions(false);
    lastSearchedQuery.current = address;
  };

  // Handle external search query updates
  useEffect(() => {
    console.log('External search query updated:', externalSearchQuery);
    if (externalSearchQuery && externalSearchQuery !== lastSearchedQuery.current) {
      console.log('Triggering handleSearch for:', externalSearchQuery);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        handleSearch(externalSearchQuery);
      }, 500); // 500ms debounce
      return () => clearTimeout(searchTimeout.current);
    } else if (!externalSearchQuery) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [externalSearchQuery]);

  useEffect(() => {
    if (!window.L || !mapRef.current) return;

    const L = window.L;

    const initMap = async (lat, lng, isDefault = false) => {
      if (!mapRef.current) return;

      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current, {
          zoomControl: true,
          scrollWheelZoom: true
        }).setView([lat, lng], 15);
        lastSetLocation.current = { lat, lng };

        // Standard Google Maps layer
        const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: 'Map data &copy; Google'
        });

        // Hybrid Google Maps layer
        const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: 'Map data &copy; Google'
        });

        // OSM as fallback
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        });

        // Add default layer (Streets)
        googleStreets.addTo(mapInstance.current);

        // Add layer control
        const baseMaps = {
          "Google Streets": googleStreets,
          "Google Hybrid": googleHybrid,
          "OpenStreetMap": osm
        };

        L.control.layers(baseMaps).addTo(mapInstance.current);

        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapInstance.current);

        // Attach click listener immediately so user can mark location even while address is fetching
        mapInstance.current.on('click', async (e) => {
          const { lat, lng } = e.latlng;
          lastSetLocation.current = { lat, lng };
          if (markerRef.current) {
            markerRef.current.setLatLng(e.latlng);
          }

          // Round coordinates for cache lookup
          const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
          if (geocodeCache.current.has(cacheKey)) {
            const cachedAddress = geocodeCache.current.get(cacheKey);
            onLocationSelect(lat, lng, cachedAddress);
            lastSearchedQuery.current = cachedAddress;
            return;
          }

          // Signal loading state only if not in cache
          onLocationSelect(lat, lng, null);

          const address = await fetchAddress(lat, lng);
          if (address !== null) {
            onLocationSelect(lat, lng, address);
            lastSearchedQuery.current = address;
          }
        });

        markerRef.current.on('dragend', async (event) => {
          const marker = event.target;
          const position = marker.getLatLng();
          const { lat, lng } = position;
          lastSetLocation.current = { lat, lng };

          // Round coordinates for cache lookup
          const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
          if (geocodeCache.current.has(cacheKey)) {
            const cachedAddress = geocodeCache.current.get(cacheKey);
            onLocationSelect(lat, lng, cachedAddress);
            lastSearchedQuery.current = cachedAddress;
            return;
          }

          // Signal loading state only if not in cache
          onLocationSelect(lat, lng, null);

          const address = await fetchAddress(lat, lng);
          if (address !== null) {
            onLocationSelect(lat, lng, address);
            lastSearchedQuery.current = address;
          }
        });

        // If it's a detected location, we auto-populate the address 
        const address = await fetchAddress(lat, lng);
        if (address !== null) {
          onLocationSelect(lat, lng, address);
          lastSearchedQuery.current = address;
        }
      }
    };

    if (initialLocation && initialLocation.latitude) {
      initMap(initialLocation.latitude, initialLocation.longitude);
    } else {
      const tryGeolocation = () => {
        // Check if we are in a secure context (HTTPS or localhost)
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          console.warn('Map initialization: Geolocation not available on insecure origin. Trying IP fallback.');
          tryIpFallback();
          return;
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              initMap(position.coords.latitude, position.coords.longitude);
            },
            () => {
              console.warn('Map initialization: GPS failed. Trying IP fallback.');
              tryIpFallback();
            },
            { timeout: 5000, enableHighAccuracy: true, maximumAge: 0 }
          );
        } else {
          tryIpFallback();
        }
      };

      const tryIpFallback = async () => {
        try {
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();
          if (data.latitude && data.longitude) {
            initMap(data.latitude, data.longitude);
          } else {
            initMap(15.3647, 75.1240); // Default to Hubballi
          }
        } catch (error) {
          initMap(15.3647, 75.1240); // Default to Hubballi
        }
      };

      tryGeolocation();
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [mapContainer]); // Run when mapContainer is available

  // Handle external updates to initialLocation (e.g. GPS button)
  useEffect(() => {
    if (mapInstance.current && initialLocation && initialLocation.latitude) {
      const { latitude, longitude } = initialLocation;

      // Only set view if the location is actually different from what we last set
      // This prevents the map from snapping back when the update originated from this component
      if (latitude !== lastSetLocation.current.lat || longitude !== lastSetLocation.current.lng) {
        const newPos = [latitude, longitude];
        mapInstance.current.setView(newPos, 15);
        lastSetLocation.current = { lat: latitude, lng: longitude };

        if (markerRef.current) {
          markerRef.current.setLatLng(newPos);
        }
      }
    }
  }, [initialLocation]);

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      {showSuggestions && (suggestions.length > 0 || isSearching) && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '1.25rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          zIndex: 9999,
          maxHeight: '350px',
          overflowY: 'auto',
          padding: '8px',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          scrollbarWidth: 'thin'
        }}>
          {isSearching && suggestions.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.9375rem' }}>
              <div style={{
                display: 'inline-block',
                width: '20px',
                height: '20px',
                border: '2.5px solid #f1f5f9',
                borderTopColor: '#2563eb',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: '12px'
              }}></div>
              <div style={{ fontWeight: '500' }}>{t('map_searching')}</div>
            </div>
          ) : suggestions.length > 0 ? (
            <>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(s);
                  }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderRadius: '0.875rem',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    marginBottom: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.transform = 'translateX(6px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: s.isGoogle ? '#f0f9ff' : '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    color: s.isGoogle ? '#0369a1' : '#64748b',
                    flexShrink: 0,
                    border: '1px solid',
                    borderColor: s.isGoogle ? '#e0f2fe' : '#f1f5f9'
                  }}>
                    {s.isGoogle ? '🏢' : '📍'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: '700',
                      color: '#0f172a',
                      fontSize: '0.9375rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '3px'
                    }}>
                      {s.display_name.split(',')[0]}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: '#64748b',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: '400'
                    }}>
                      {s.display_name.split(',').slice(1).join(',').trim() || 'Location details'}
                    </div>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.875rem', paddingRight: '4px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              ))}

              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '4px'
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#94a3b8',
                  fontStyle: 'italic',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {suggestions.some(s => s.isGoogle) ? (
                    <><span>Powered by</span> <strong style={{ color: '#475569' }}>Google</strong></>
                  ) : (
                    <><span>Data from</span> <strong style={{ color: '#475569' }}>OpenStreetMap</strong></>
                  )}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                  {suggestions.length} {t('map_results')}
                </div>
              </div>
            </>
          ) : !isSearching && externalSearchQuery && externalSearchQuery.length >= 3 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔍</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: '500' }}>{t('map_no_results')} "{externalSearchQuery}"</div>
              <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>{t('map_try_specific')}</div>
            </div>
          ) : null}
        </div>
      )}

      {mapContainer && ReactDOM.createPortal(
        <div
          ref={mapRef}
          style={{ width: '100%', height: '100%' }}
        />,
        mapContainer
      )}
    </>
  );
};

export default MapPicker;
