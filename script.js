// Event Map Integration Prototype
// Enhanced with loading states, debouncing, and improved security

class EventMap {
  constructor() {
    this.map = null;
    this.markers = [];
    this.events = [];
    this.filteredEvents = [];
    this.displayedEvents = []; // Events currently shown in the list

    // Recurring event IDs to exclude (Public Announcements)
    this.excludedRecurringEventIds = [
      "2scpgqhjtjh5tc33cg3jm3ik5c",
      "30ed1sa1ev6k8kgp0ucg1mq24j_R20260105",
    ];

    // Helper to check if a recurring event should be excluded
    this.isExcludedRecurringEvent = (recurringEventId) =>
      this.excludedRecurringEventIds.includes(recurringEventId);

    // Use config constants
    const config = window.EventMapUtils?.CONFIG || {};
    this.eventsPerPage = config.EVENTS_PER_PAGE || 20;
    this.maxMarkersOnMap = config.MAX_MARKERS_ON_MAP || 100;

    this.currentPage = 0;
    this.currentDateFilter = "all"; // 'today', 'week', 'month', 'all'

    // Utility functions
    this.utils = window.EventMapUtils;

    this.init();
  }

  async init() {
    // Show loading state
    if (this.utils) {
      this.utils.showLoadingSpinner("Loading events...");
    }

    // Try to load events from Google Calendar API

    try {
      await this.loadGoogleCalendarEvents();
    } catch (apiError) {
      console.warn(
        "Could not load Google Calendar events:",
        apiError
      );

    }

    this.filteredEvents = [...this.events];
    this.initMap();
    this.populateCategoryFilter();
    this.displayEvents();
    this.setupEventListeners();

    // Hide loading state
    if (this.utils) {
      this.utils.hideLoadingSpinner();
    }
  }

  async processCalendarItems(items) {
    const processedEvents = [];
    const now = new Date();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // Skip excluded recurring events (Public Announcements)
        if (
          this.isExcludedRecurringEvent(item.recurringEventId)
        ) {
          continue;
        }

        // Check if event is in the past
        const eventDate = new Date(item.start?.dateTime || item.start?.date);
        const eventDateTime = new Date(
          item.start?.dateTime || `${item.start?.date}T23:59:59`
        );
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDateOnly = new Date(eventDate);
        eventDateOnly.setHours(0, 0, 0, 0);

        // Skip events from previous days, but keep today's events even if elapsed
        if (eventDateOnly < today) {
          continue;
        }

        // Skip non-event entries like "Useful Information"
        if ((item.summary || "").toLowerCase().includes("useful information")) {
          continue;
        }

        // Transform to our event format
        const event = await this.transformCalendarItem(
          item,
          processedEvents.length + 1
        );

        // Mark event as elapsed if it's today but the time has passed
        event.isElapsed =
          eventDateTime < now && eventDateOnly.getTime() === today.getTime();

        // Skip events without valid location coordinates
        if (event.lat === 0 && event.lng === 0) {
          console.warn(
            `Skipping event "${event.title}" - no valid coordinates`
          );
          continue;
        }

        processedEvents.push(event);
      } catch (error) {
        console.warn(`Error processing event "${item.summary}":`, error);
        continue;
      }
    }

    // Sort events by date
    processedEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    return processedEvents;
  }

  async transformCalendarItem(item, id) {
    // Clean and sanitise the data
    const title = this.sanitiseText(item.summary || "Unnamed Event");
    const description = this.sanitiseHtml(
      item.description || "No description available"
    );
    const location = this.sanitiseText(item.location || "Location TBD");

    const categorization = this.categorizeEvent(title, description);

    const event = {
      id: id,
      title: title,
      description: description,
      category: categorization.primary,
      categories: categorization.tags,
      date: this.extractDate(item),
      time: this.extractTime(item),
      startTime: this.extractStartTime(item),
      endTime: this.extractEndTime(item),
      location: location,
      originalEvent: item, // Keep reference for debugging
    };

    // Get coordinates for the location (pass event title as venue name for better geocoding)
    const coordinates = await this.getCoordinatesForLocation(
      location,
      event.title
    );
    event.lat = coordinates.lat;
    event.lng = coordinates.lng;

    return event;
  }

  sanitiseText(text) {
    // Use enhanced sanitisation from utils if available
    if (this.utils && this.utils.sanitiseText) {
      return this.utils.sanitiseText(text);
    }

    // Fallback to basic sanitisation
    if (!text) return "";
    return text
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  async loadGoogleCalendarEvents() {
    // Check if configuration is available
    const config = window.CALENDAR_CONFIG;
    if (!config || !config.API_KEY || !config.CALENDAR_ID) {
      throw new Error(
        "Google Calendar configuration not found. Copy config.example.js to config.js and fill in your details."
      );
    }

    if (config.API_KEY === "your-google-calendar-api-key-here") {
      throw new Error(
        "Please configure your Google Calendar API key in config.js"
      );
    }

    try {
      const timeMin = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        config.CALENDAR_ID
      )}/events?key=${
        config.API_KEY
      }&timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=${
        config.MAX_EVENTS || 50
      }`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Google Calendar API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        console.warn("No events found in Google Calendar");
        this.events = [];
        return;
      }

      // Transform calendar events to our format
      const transformedEvents = [];
      for (let i = 0; i < data.items.length; i++) {
        const calendarEvent = data.items[i];

        // Skip excluded recurring events (Public Announcements)
        if (
         this.isExcludedRecurringEvent(calendarEvent.recurringEventId
          )
        ) {
          continue;
        }

        const transformedEvent = await this.transformGoogleCalendarEvent(
          calendarEvent,
          i + 1
        );
        transformedEvents.push(transformedEvent);
      }

      this.events = transformedEvents;
    } catch (error) {
      console.error("Failed to load Google Calendar events:", error);
      throw error;
    }
  }

  async transformGoogleCalendarEvent(calendarEvent, index) {
    // Transform Google Calendar event to our format
    const categorization = this.categorizeEvent(
      calendarEvent.summary,
      calendarEvent.description
    );

    // Decode HTML entities in description
    const decodedDescription = this.decodeHTMLEntities(
      calendarEvent.description || "No description available"
    );

    const event = {
      id: index,
      title: calendarEvent.summary || "Unnamed Event",
      description: decodedDescription,
      category: categorization.primary || categorization,
      categories: categorization.tags || [categorization],
      date: this.extractDate(calendarEvent),
      time: this.extractTime(calendarEvent),
      startTime: this.extractStartTime(calendarEvent),
      endTime: this.extractEndTime(calendarEvent),
      location: calendarEvent.location || "Location TBD",
      originalEvent: calendarEvent, // Keep reference for debugging
    };

    // Get coordinates for the location
    const coordinates = await this.getCoordinatesForLocation(event.location);
    event.lat = coordinates.lat;
    event.lng = coordinates.lng;

    return event;
  }

  extractDate(calendarEvent) {
    // Handle both all-day and timed events
    if (calendarEvent.start?.date) {
      return calendarEvent.start.date; // All-day event
    } else if (calendarEvent.start?.dateTime) {
      return calendarEvent.start.dateTime.split("T")[0]; // Timed event
    }
    return new Date().toISOString().split("T")[0]; // Fallback to today
  }

  extractTime(calendarEvent) {
    // Extract time range for display
    const startTime = this.extractStartTime(calendarEvent);
    const endTime = this.extractEndTime(calendarEvent);

    if (!startTime && !endTime) {
      return "All day";
    }

    if (startTime && endTime && startTime !== endTime) {
      return `${startTime} - ${endTime}`;
    }

    return startTime || "Time TBD";
  }

  extractStartTime(calendarEvent) {
    if (calendarEvent.start?.dateTime) {
      const dateTime = new Date(calendarEvent.start.dateTime);
      return this.formatTime(dateTime);
    }
    return null; // All-day events don't have times
  }

  extractEndTime(calendarEvent) {
    if (calendarEvent.end?.dateTime) {
      const dateTime = new Date(calendarEvent.end.dateTime);
      return this.formatTime(dateTime);
    }
    return null; // All-day events don't have times
  }

  formatTime(date) {
    // Format time in 12-hour format with AM/PM
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // Use 24-hour format for UK
    });
  }

  decodeHTMLEntities(text) {
    // Decode HTML entities like \u003cp\u003e to <p>
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }

  async getCoordinatesForLocation(location, venueName = null) {
    const config = window.CALENDAR_CONFIG;
    // Use Google Geocoding API directly (simplified for debugging)
    if (
      config?.ENABLE_GEOCODING &&
      config?.GEOCODING_API_KEY &&
      config.GEOCODING_API_KEY !== "your-google-geocoding-api-key-here"
    ) {
      try {
        const googleCoords = await this.geocodeWithGoogle(location, venueName);
        if (googleCoords) {
          return googleCoords;
        }
      } catch (error) {
        console.error(`[Geocoding] FAILED for "${location}":`, error);
      }
    } else {
      console.warn(
        `[Geocoding] Skipped - geocoding disabled or API key missing`
      );
    }

    // Fallback: Generate unique coordinates using hash-based offset
    console.warn(
      `[Geocoding] Using fallback hash coordinates for "${location}"`
    );
    const fallbackCoords = config?.DEFAULT_REGION || {
      lat: 54.9783,
      lng: -1.6178,
    };
    return this.generateUniqueCoordinates(location, fallbackCoords);
  }

  // Geocode address using Google Geocoding API
  async geocodeWithGoogle(address, venueName = null) {
    const config = window.CALENDAR_CONFIG;

    // Use the full address as-is (Google Calendar locations are usually complete)
    const searchQuery = address;

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        searchQuery
      )}&key=${config.GEOCODING_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Google Geocoding API HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const formattedAddress = data.results[0].formatted_address;

      return { lat: location.lat, lng: location.lng };
    } else if (data.status === "REQUEST_DENIED") {
      console.error(
        `[Google Geocoding] REQUEST_DENIED - Check API key permissions. Error: ${data.error_message}`
      );
      throw new Error(`API key issue: ${data.error_message}`);
    } else if (data.status === "OVER_QUERY_LIMIT") {
      console.error(`[Google Geocoding] OVER_QUERY_LIMIT - Too many requests`);
      throw new Error("Over query limit");
    } else if (data.status === "ZERO_RESULTS") {
      console.warn(`[Google Geocoding] No results for: "${searchQuery}"`);
      throw new Error("No results found");
    } else {
      console.error(`[Google Geocoding] Unexpected status: ${data.status}`);
      throw new Error(`Google API error: ${data.status}`);
    }
  }

  generateUniqueCoordinates(location, baseCoords) {
    // Create a simple hash from the location string
    let hash = 0;
    for (let i = 0; i < location.length; i++) {
      const char = location.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Use hash to create small offsets (within ~1km radius)
    const offsetRange = 0.008; // Roughly 1km at this latitude
    const latOffset = ((hash % 1000) / 1000 - 0.5) * offsetRange;
    const lngOffset = (((hash >> 10) % 1000) / 1000 - 0.5) * offsetRange;

    return {
      lat: baseCoords.lat + latOffset,
      lng: baseCoords.lng + lngOffset,
    };
  }

  async geocodeLocation(address, venueName = null) {
    const config = window.CALENDAR_CONFIG;
    try {
      // Combine venue name and location for better accuracy
      let searchQuery = address;
      if (venueName) {
        searchQuery = `${venueName}, ${address}`;
      }

      const query = encodeURIComponent(searchQuery);

      // Use Google Maps Geocoding API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          address + ", Northeast England, UK"
        )}&key=${config.GEOCODING_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
      } else {
        throw new Error("No geocoding results found");
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
      throw error;
    }
  }

  categorizeEvent(title, description) {
    const titleLower = (title || "").toLowerCase();
    const descLower = (description || "").toLowerCase();
    const combined = titleLower + " " + descLower;

    const tags = [];

    // Drop-in patterns
    if (
      descLower.includes("drop in") ||
      descLower.includes("drop-in") ||
      combined.includes("drop in") ||
      combined.includes("drop-in")
    ) {
      tags.push("drop-in");
    }

    // Support patterns
    if (
      combined.includes("support") ||
      combined.includes("counselling") ||
      combined.includes("therapy") ||
      combined.includes("help") ||
      combined.includes("advice") ||
      combined.includes("welfare")
    ) {
      tags.push("support");
    }

    // Breakfast Club patterns (more specific to avoid false positives)
    if (
      combined.includes("breakfast club") ||
      (combined.includes("breakfast") && !combined.includes("clay pigeon")) ||
      (combined.includes("naafi break") && !descLower.includes("drop in"))
    ) {
      tags.push("breakfast-club");
    }

    // Meeting patterns
    if (
      combined.includes("meeting") ||
      combined.includes("branch meeting") ||
      combined.includes("association") ||
      combined.includes("rbl") ||
      combined.includes("royal british legion") ||
      combined.includes("dli")
    ) {
      tags.push("meeting");
    }

    // Workshop patterns
    if (
      combined.includes("workshop") ||
      combined.includes("training") ||
      combined.includes("course") ||
      combined.includes("seminar")
    ) {
      tags.push("workshop");
    }

    // Social patterns
    if (
      combined.includes("social") ||
      combined.includes("mixer") ||
      combined.includes("party") ||
      combined.includes("celebration")
    ) {
      tags.push("social");
    }

    // Sport & Recreation patterns (highest priority for sport activities)
    if (
      combined.includes("clay pigeon") ||
      combined.includes("shooting") ||
      titleLower.includes("sport") ||
      combined.includes("football") ||
      combined.includes("rugby") ||
      combined.includes("sailing") ||
      combined.includes("fishing") ||
      combined.includes("golf") ||
      combined.includes("cycling") ||
      combined.includes("walking") ||
      combined.includes("hiking") ||
      combined.includes("swimming") ||
      combined.includes("offshore sailing")
    ) {
      tags.push("sport");
    }

    // Return array of tags and primary category
    return {
      tags: tags,
      primary: tags.length > 0 ? tags[0] : "other",
    };
  }

  showRealDataNotification() {
    // Create a notification banner for real calendar data
    const notification = document.createElement("div");
    notification.className =
      "bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-5 rounded";
    notification.innerHTML = `
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm">
                        <strong>Live Calendar Data:</strong> Showing real VFVIC events including clay pigeon shooting, breakfast clubs, and support groups.
                        Events are automatically filtered to show only upcoming activities.
                    </p>
                </div>
            </div>
        `;

    // Insert after the header
    const header = document.querySelector("header");
    header.parentNode.insertBefore(notification, header.nextSibling);
  }

  initMap() {
    // Initialize Leaflet map centered on Northeast England
    this.map = L.map("map").setView([54.9783, -1.6178], 8);

    // Add OpenStreetMap tiles (free, no API key required)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(this.map);

    this.addMarkers();
  }

  addMarkers() {
    // Clear existing markers
    this.markers.forEach((marker) => this.map.removeLayer(marker));
    this.markers = [];

    // Limit markers for performance (prioritize closer events if sorted by distance)
    const eventsToShow = this.filteredEvents.slice(0, this.maxMarkersOnMap);

    // Group events by exact location string AND date for more precise grouping
    const eventsByLocationAndDate = new Map();

    eventsToShow.forEach((event) => {
      // Use location string + date for grouping to ensure only same venue events are grouped
      const locationDateKey = `${event.location}|${event.date}`;
      if (!eventsByLocationAndDate.has(locationDateKey)) {
        eventsByLocationAndDate.set(locationDateKey, []);
      }
      eventsByLocationAndDate.get(locationDateKey).push(event);
    });

    // Create markers for each unique location-date combination
    eventsByLocationAndDate.forEach((eventsAtLocationDate, locationDateKey) => {
      const [location, date] = locationDateKey.split("|");
      // Use the coordinates from the first event in the group
      const firstEvent = eventsAtLocationDate[0];
      const lat = firstEvent.lat;
      const lng = firstEvent.lng;

      if (eventsAtLocationDate.length === 1) {
        // Single event at this location on this date
        const event = eventsAtLocationDate[0];
        const marker = L.marker([lat, lng])
          .addTo(this.map)
          .bindPopup(this.createPopupContent(event));

        // Store marker reference on the event for mobile focus functionality
        event._marker = marker;
        event._originalIcon = marker.getIcon();

        marker.on("click", () => {
          this.highlightEvent(event.id);
        });

        this.markers.push(marker);
      } else {
        // Multiple events at this exact location on the same date
        // Sort events by time (earliest first)
        const sortedEvents = eventsAtLocationDate.sort((a, b) => {
          const timeA = a.startTime || a.time || "00:00";
          const timeB = b.startTime || b.time || "00:00";
          return timeA.localeCompare(timeB);
        });

        const marker = L.marker([lat, lng])
          .addTo(this.map)
          .bindPopup(this.createMultiEventPopupContent(sortedEvents, date));

        // Store marker reference on the first event for mobile focus functionality
        sortedEvents[0]._marker = marker;
        sortedEvents[0]._originalIcon = marker.getIcon();

        // When marker is clicked, highlight the first (earliest) event
        marker.on("click", () => {
          this.highlightEvent(sortedEvents[0].id);
        });

        this.markers.push(marker);
      }
    });

    // Fit map to show all markers if there are any
    if (this.markers.length > 0) {
      const group = new L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  createPopupContent(event) {
    const elapsedLabel = event.isElapsed
      ? '<span style="background: #6b7280; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 8px;">Ended</span>'
      : "";
    const titleStyle = event.isElapsed
      ? "color: #6b7280; opacity: 0.8;"
      : "color: #1f2937;";

    return `
            <div style="max-width: 250px;">
                <h4 style="margin: 0 0 10px 0; ${titleStyle}">${
      event.title
    }${elapsedLabel}</h4>
                <p style="margin: 2px 0; font-size: 12px; color: #6b7280;">
                    <strong>📅</strong> ${this.formatDate(event.date)}
                </p>
                <p style="margin: 2px 0; font-size: 12px; color: #6b7280;">
                    <strong>⏰</strong> ${event.time}
                </p>
                <p style="margin: 2px 0; font-size: 12px; color: #6b7280;">
                    <strong>📍</strong> ${event.location}
                </p>
                <p style="margin: 5px 0; font-size: 12px; color: #6b7280;">
                    <span class="inline-block px-2 py-1 rounded text-xs text-white ${this.getCategoryColorClass(
                      event.category
                    )}">${this.formatCategoryName(event.category)}</span>
                </p>
                <p style="margin: 5px 0; font-size: 12px; color: #4b5563;">${
                  event.description
                }</p>
            </div>
        `;
  }

  createMultiEventPopupContent(events, date) {
    const location = events[0].location; // All events share the same location
    const eventCount = events.length;

    // Events are already sorted by time in addMarkers method
    const eventsHtml = events
      .map((event, index) => {
        const elapsedLabel = event.isElapsed
          ? '<span style="background: #6b7280; color: white; padding: 1px 4px; border-radius: 8px; font-size: 9px; margin-left: 5px;">Ended</span>'
          : "";
        const titleStyle = event.isElapsed
          ? "color: #6b7280; opacity: 0.8;"
          : "color: #1f2937;";

        return `
                <div class="border-b border-gray-200 pb-2 mb-2 ${
                  index === events.length - 1 ? "border-b-0 pb-0 mb-0" : ""
                }"
                     style="cursor: pointer;"
                     onclick="eventMap.highlightEvent(${
                       event.id
                     }); eventMap.map.closePopup();">
                    <h5 style="margin: 0 0 5px 0; ${titleStyle} font-weight: bold;">${
          event.title
        }${elapsedLabel}</h5>
                    <p style="margin: 2px 0; font-size: 12px; color: #6b7280;">
                        <strong>⏰</strong> ${event.time || "Time TBD"}
                    </p>
                    <p style="margin: 2px 0; font-size: 12px; color: #6b7280;">
                        <span class="inline-block px-2 py-1 rounded text-xs text-white ${this.getCategoryColorClass(
                          event.category
                        )}">${this.formatCategoryName(event.category)}</span>
                    </p>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #4b5563;">${event.description.substring(
                      0,
                      80
                    )}${event.description.length > 80 ? "..." : ""}</p>
                </div>
            `;
      })
      .join("");

    return `
            <div style="max-width: 300px;">
                <h4 style="margin: 0 0 10px 0; color: #1f2937;">📍 ${location}</h4>
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280;">
                    <strong>📅</strong> ${this.formatDate(date)}
                </p>
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #059669;">
                    ${eventCount} event${eventCount > 1 ? "s" : ""} on this day
                </p>
                <div style="max-height: 250px; overflow-y: auto;">
                    ${eventsHtml}
                </div>
                <p style="margin: 10px 0 0 0; font-size: 11px; color: #9ca3af; font-style: italic;">
                    Click on an event above to highlight it in the list
                </p>
            </div>
        `;
  }

  displayEvents() {
    const eventItems = document.getElementById("eventItems");

    if (this.filteredEvents.length === 0) {
      const searchQuery = document.getElementById("searchInput").value.trim();
      const isPostcodeSearch = this.isPostcode(searchQuery);
      let noResultsMessage = "No events found matching your criteria.";

      if (isPostcodeSearch) {
        noResultsMessage =
          "No events found within search radius. Try a larger area or different postcode.";
      }

      if (eventItems) {
        eventItems.innerHTML = `<div class="text-center py-5 text-gray-500">${noResultsMessage}</div>`;
      }

      // Update mobile event count
      this.updateMobileEventCount();
      return;
    }

    // Check if any events have distance info (location-based search active)
    const hasDistanceInfo = this.filteredEvents.some(
      (event) => event._searchDistance !== undefined
    );
    const isPartialPostcodeSearch = this.filteredEvents.some(
      (event) => event._isPartialPostcode
    );

    // Add header info for location-based searches
    let searchInfoHeader = "";
    if (hasDistanceInfo) {
      const searchQuery = document.getElementById("searchInput").value.trim();
      let searchType = "postcode";

      if (isPartialPostcodeSearch) {
        searchType = "partial postcode area";
      }

      const maxRadius = Math.max(
        ...this.filteredEvents.map((e) => e._searchRadius || 50)
      );
      searchInfoHeader = `
                <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p class="text-sm text-blue-800">
                        <strong>📍 ${
                          searchType.charAt(0).toUpperCase() +
                          searchType.slice(1)
                        } Search:</strong>
                        Showing events within ${maxRadius}km of "${searchQuery}", sorted by distance
                    </p>
                </div>
            `;
    }

    if (eventItems) {
      eventItems.innerHTML =
        searchInfoHeader + this.generateGroupedEventsList();
    }

    // Update mobile event count
    this.updateMobileEventCount();
  }

  updateMobileEventCount() {
    const count = this.filteredEvents.length;

    // Update mobile event count text
    const mobileEventCount = document.getElementById("mobileEventCount");
    if (mobileEventCount) {
      if (count === 0) {
        mobileEventCount.textContent =
          "No events found - try adjusting filters";
      } else {
        mobileEventCount.textContent = `${count} event${
          count !== 1 ? "s" : ""
        } found - click markers for details`;
      }
    }

    // Update all badge counters
    const eventCounter = document.getElementById("eventCounter");
    if (eventCounter) {
      eventCounter.textContent = `${count} event${count !== 1 ? "s" : ""}`;
    }

    const mobileCounter = document.getElementById("mobileCounter");
    if (mobileCounter) {
      mobileCounter.textContent = count.toString();
    }

    const mobileEventCounter = document.getElementById("mobileEventCounter");
    if (mobileEventCounter) {
      mobileEventCounter.textContent = count.toString();
    }
  }

  displayMobileEventList() {
    const mobileEventItems = document.getElementById("mobileEventItems");
    if (!mobileEventItems) return;

    if (this.filteredEvents.length === 0) {
      mobileEventItems.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p class="text-lg mb-2">No events found</p>
                    <p class="text-sm">Try adjusting your search criteria or filters</p>
                </div>
            `;
      return;
    }

    mobileEventItems.innerHTML = this.generateMobileEventsList();
  }

  generateMobileEventsList() {
    // Group events by date
    const eventsByDate = new Map();

    this.filteredEvents.forEach((event) => {
      const dateKey = event.date;
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, []);
      }
      eventsByDate.get(dateKey).push(event);
    });

    // Sort dates chronologically
    const sortedDates = Array.from(eventsByDate.keys()).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    // Generate HTML for each date group - mobile optimized
    return sortedDates
      .map((date) => {
        const eventsOnDate = eventsByDate.get(date);

        // Sort events within the date by time
        const sortedEvents = eventsOnDate.sort((a, b) => {
          const timeA = a.startTime || a.time || "00:00";
          const timeB = b.startTime || b.time || "00:00";
          return timeA.localeCompare(timeB);
        });

        const dateHeader = `
                <div class="mb-3 mt-4 first:mt-0">
                    <h4 class="text-lg font-bold text-gray-800 mb-2 pb-1 border-b border-gray-200">
                        📅 ${this.formatDate(date)}
                        <span class="text-sm font-normal text-gray-600">(${
                          eventsOnDate.length
                        })</span>
                    </h4>
                </div>
            `;

        const eventsHtml = sortedEvents
          .map((event) => {
            // Generate tag badges for all categories - smaller for mobile
            const categories =
              Array.isArray(event.categories) && event.categories.length > 0
                ? event.categories
                : event.category
                ? [event.category]
                : [];
            const tagBadges = categories
              .map(
                (category) =>
                  `<span class="inline-block px-2 py-1 rounded-full text-xs font-medium text-white mr-1 mb-1 ${this.getCategoryColorClass(
                    category
                  )}">${this.formatCategoryName(category)}</span>`
              )
              .join("");

            // Add distance information if available
            const distanceInfo =
              event._searchDistance !== undefined
                ? `<p class="text-gray-600 text-xs mb-1">📏 ${event._searchDistance.toFixed(
                    1
                  )} km away</p>`
                : "";

            // Apply elapsed styling for mobile
            const elapsedClass = event.isElapsed
              ? "opacity-60 bg-gray-100"
              : "bg-gray-50";
            const borderClass = event.isElapsed
              ? "border-gray-400"
              : "border-blue-500";
            const elapsedLabel = event.isElapsed
              ? '<span class="text-xs bg-gray-500 text-white px-1 py-0.5 rounded mr-1">Ended</span>'
              : "";

            return `
                    <div class="${elapsedClass} rounded-lg p-3 mb-3 border-l-4 ${borderClass}"
                         onclick="eventMap.focusOnEvent('${event.id}')">
                        <div class="flex justify-between items-start mb-2">
                            <h5 class="text-sm font-semibold text-gray-800 leading-tight flex-1">${
                              event.title
                            }</h5>
                            <div class="flex items-center ml-2">
                                ${elapsedLabel}
                                <span class="text-xs text-gray-600 whitespace-nowrap">${
                                  event.timeDisplay || event.time
                                }</span>
                            </div>
                        </div>
                        ${distanceInfo}
                        <p class="text-xs text-gray-600 mb-1"><strong>📍</strong> ${
                          event.location
                        }</p>
                        <div class="mb-2">${tagBadges}</div>
                        ${
                          event.description
                            ? `<p class="text-xs text-gray-700 line-clamp-2">${event.description}</p>`
                            : ""
                        }
                    </div>
                `;
          })
          .join("");

        return dateHeader + eventsHtml;
      })
      .join("");
  }

  focusOnEvent(eventId) {
    // Close mobile modal
    const mobileEventModal = document.getElementById("mobileEventModal");
    if (mobileEventModal) {
      mobileEventModal.classList.add("hidden");
      document.body.style.overflow = "";
    }

    // Find the event and its marker
    const event = this.filteredEvents.find((e) => e.id === eventId);
    if (!event || !event._marker) return;

    // Center map on the event marker
    this.map.setView([event.lat, event.lng], 15);

    // Open the popup
    event._marker.openPopup();

    // Add a brief highlight effect
    setTimeout(() => {
      event._marker.setIcon(event._originalIcon);
    }, 2000);
  }

  generateGroupedEventsList() {
    // Group events by date
    const eventsByDate = new Map();

    this.filteredEvents.forEach((event) => {
      const dateKey = event.date;
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, []);
      }
      eventsByDate.get(dateKey).push(event);
    });

    // Sort dates chronologically
    const sortedDates = Array.from(eventsByDate.keys()).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    // Generate HTML for each date group
    return sortedDates
      .map((date) => {
        const eventsOnDate = eventsByDate.get(date);

        // Sort events within the date by time
        const sortedEvents = eventsOnDate.sort((a, b) => {
          const timeA = a.startTime || a.time || "00:00";
          const timeB = b.startTime || b.time || "00:00";
          return timeA.localeCompare(timeB);
        });

        const dateHeader = `
                <div class="mb-4 mt-6 first:mt-0">
                    <h3 class="text-xl font-bold text-gray-800 mb-3 pb-2 border-b-2 border-blue-200">
                        📅 ${this.formatDate(date)}
                        <span class="text-sm font-normal text-gray-600 ml-2">(${
                          eventsOnDate.length
                        } event${eventsOnDate.length > 1 ? "s" : ""})</span>
                    </h3>
                </div>
            `;

        const eventsHtml = sortedEvents
          .map((event) => {
            // Generate tag badges for all categories
            const categories =
              Array.isArray(event.categories) && event.categories.length > 0
                ? event.categories
                : event.category != null
                ? [event.category]
                : [];
            const tagBadges = categories
              .map(
                (category) =>
                  `<span class="inline-block px-2 py-1 rounded-full text-xs font-medium text-white mr-1 mb-1 ${this.getCategoryColorClass(
                    category
                  )}">${this.formatCategoryName(category)}</span>`
              )
              .join("");

            // Add distance information if available (from postcode search)
            const distanceInfo =
              event._searchDistance !== undefined
                ? `<p class="text-gray-600 text-sm mb-1"><strong>📏</strong> ${event._searchDistance.toFixed(
                    1
                  )} km away</p>`
                : "";

            // Apply elapsed styling if event has passed
            const elapsedClass = event.isElapsed
              ? "opacity-60 bg-gray-100"
              : "bg-gray-50";
            const borderClass = event.isElapsed
              ? "border-gray-400"
              : "border-blue-500";
            const hoverClass = event.isElapsed
              ? "hover:bg-gray-200"
              : "hover:bg-blue-50";
            const elapsedLabel = event.isElapsed
              ? '<span class="text-xs bg-gray-500 text-white px-2 py-1 rounded-full mr-2">Ended</span>'
              : "";

            return `
                    <div class="${elapsedClass} rounded-lg p-4 cursor-pointer transition-all duration-300 border-l-4 ${borderClass} ${hoverClass} hover:shadow-md hover:-translate-y-1 mb-4"
                         data-event-id="${event.id}" onclick="eventMap.focusEvent(${event.id})">
                        <div class="flex items-start justify-between mb-2">
                            <h4 class="text-gray-800 text-lg font-semibold flex-1">${event.title}</h4>
                            ${elapsedLabel}
                        </div>
                        <p class="text-gray-600 text-sm mb-1"><strong>⏰</strong> ${event.time}</p>
                        <p class="text-gray-600 text-sm mb-1"><strong>📍</strong> ${event.location}</p>

                        <p class="text-gray-600 text-sm mb-1">${event.description}</p>
                        <div class="flex flex-wrap">${tagBadges}</div>
                    </div>
                `;
          })
          .join("");

        return dateHeader + eventsHtml;
      })
      .join("");
  }

  focusEvent(eventId) {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      // Center map on event location
      this.map.setView([event.lat, event.lng], 10);

      // Open popup for the marker
      const marker = this.markers.find(
        (m) =>
          m.getLatLng().lat === event.lat && m.getLatLng().lng === event.lng
      );
      if (marker) {
        marker.openPopup();
      }

      this.highlightEvent(eventId);
    }
  }

  highlightEvent(eventId) {
    // Remove highlight from all items by resetting border color
    document.querySelectorAll("[data-event-id]").forEach((item) => {
      item.classList.remove("border-red-500", "bg-red-50");
      item.classList.add("border-blue-500", "bg-gray-50");
    });

    // Add highlight to selected item
    const selectedItem = document.querySelector(`[data-event-id="${eventId}"]`);
    if (selectedItem) {
      selectedItem.classList.remove("border-blue-500", "bg-gray-50");
      selectedItem.classList.add("border-red-500", "bg-red-50");
      selectedItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  setupEventListeners() {
    // Search functionality with debouncing
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    const performSearch = async () => {
      // Validate and sanitise search input
      const rawQuery = searchInput.value;
      const sanitisedQuery =
        this.utils?.validateSearchInput(rawQuery) || rawQuery.trim();
      searchInput.value = sanitisedQuery; // Update input with sanitised value
      await this.filterEvents();
    };

    // Create debounced version of filter for typing
    const debouncedFilter =
      this.utils?.debounce(
        () => this.filterEvents(),
        this.utils.CONFIG.DEBOUNCE_DELAY
      ) || (() => this.filterEvents());

    // Real-time search as user types (debounced)
    searchInput.addEventListener("input", debouncedFilter);

    // Immediate search on button click
    searchBtn.addEventListener("click", performSearch);

    // Search on Enter key
    searchInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await performSearch();
      }
    });

    // Filter functionality
    const categoryFilter = document.getElementById("categoryFilter");
    const dateFilter = document.getElementById("dateFilter");
    const clearFilters = document.getElementById("clearFilters");

    categoryFilter.addEventListener(
      "change",
      async () => await this.filterEvents()
    );
    dateFilter.addEventListener(
      "change",
      async () => await this.filterEvents()
    );

    clearFilters.addEventListener("click", async () => {
      searchInput.value = "";
      categoryFilter.value = "";
      dateFilter.value = "";
      this.currentDateFilter = "all";
      this.currentPage = 0;
      await this.filterEvents();
    });

    // Quick date filter buttons
    const filterToday = document.getElementById("filterToday");
    const filterWeek = document.getElementById("filterWeek");
    const filterMonth = document.getElementById("filterMonth");
    const filterAll = document.getElementById("filterAll");

    if (filterToday) {
      filterToday.addEventListener("click", () => this.setDateFilter("today"));
    }
    if (filterWeek) {
      filterWeek.addEventListener("click", () => this.setDateFilter("week"));
    }
    if (filterMonth) {
      filterMonth.addEventListener("click", () => this.setDateFilter("month"));
    }
    if (filterAll) {
      filterAll.addEventListener("click", () => this.setDateFilter("all"));
    }

    // Load more functionality
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    const mobileLoadMoreBtn = document.getElementById("mobileLoadMoreBtn");

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => this.loadMoreEvents());
    }
    if (mobileLoadMoreBtn) {
      mobileLoadMoreBtn.addEventListener("click", () =>
        this.loadMoreEvents(true)
      );
    }

    // Mobile list modal functionality
    const showMobileList = document.getElementById("showMobileList");
    const closeMobileList = document.getElementById("closeMobileList");
    const mobileEventModal = document.getElementById("mobileEventModal");

    if (showMobileList) {
      showMobileList.addEventListener("click", () => {
        this.displayMobileEventList();
        mobileEventModal.classList.remove("hidden");
        document.body.style.overflow = "hidden"; // Prevent background scrolling
      });
    }

    if (closeMobileList) {
      closeMobileList.addEventListener("click", () => {
        mobileEventModal.classList.add("hidden");
        document.body.style.overflow = ""; // Restore scrolling
      });
    }

    // Close modal when clicking backdrop
    if (mobileEventModal) {
      mobileEventModal.addEventListener("click", (e) => {
        if (e.target === mobileEventModal) {
          mobileEventModal.classList.add("hidden");
          document.body.style.overflow = "";
        }
      });
    }
  }

  async setDateFilter(filterType) {
    this.currentDateFilter = filterType;
    this.currentPage = 0;
    this.updateDateFilterButtons();
    await this.filterEvents();
  }

  updateDateFilterButtons() {
    const buttons = {
      today: document.getElementById("filterToday"),
      week: document.getElementById("filterWeek"),
      month: document.getElementById("filterMonth"),
      all: document.getElementById("filterAll"),
    };

    // Reset all button styles
    Object.values(buttons).forEach((btn) => {
      if (btn) {
        btn.className = btn.className.replace(
          /bg-\w+-500|text-white/,
          "bg-gray-100 text-gray-800"
        );
      }
    });

    // Highlight active button
    const activeBtn = buttons[this.currentDateFilter];
    if (activeBtn) {
      const colorMap = {
        today: "bg-green-500 text-white",
        week: "bg-blue-500 text-white",
        month: "bg-purple-500 text-white",
        all: "bg-gray-500 text-white",
      };
      activeBtn.className = activeBtn.className.replace(
        /bg-\w+-\d+\s+text-\w+-\d+/,
        colorMap[this.currentDateFilter]
      );
    }
  }

  filterEventsByDate(events) {
    if (this.currentDateFilter === "all") {
      return events; // No filtering needed
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const filtered = events.filter((event) => {
      const eventDate = new Date(event.date);

      switch (this.currentDateFilter) {
        case "today":
          return eventDate.toDateString() === today.toDateString();
        case "week":
          const weekFromNow = new Date(
            today.getTime() + 7 * 24 * 60 * 60 * 1000
          );
          return eventDate >= today && eventDate <= weekFromNow;
        case "month":
          const monthFromNow = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            today.getDate()
          );
          return eventDate >= today && eventDate <= monthFromNow;
        case "all":
        default:
          return true;
      }
    });

    return filtered;
  }

  loadMoreEvents(isMobile = false) {
    this.currentPage++;
    this.displayEvents(isMobile, true); // true = append mode
  }

  updateEventCounters() {
    const totalFiltered = this.filteredEvents.length;
    const displayed = this.displayedEvents.length;

    // Desktop counter
    const eventCounter = document.getElementById("eventCounter");
    if (eventCounter) {
      eventCounter.textContent = `${displayed} of ${totalFiltered} events`;
    }

    // Mobile counters
    const mobileCounter = document.getElementById("mobileCounter");
    const mobileEventCounter = document.getElementById("mobileEventCounter");

    if (mobileCounter) {
      mobileCounter.textContent = totalFiltered.toString();
    }
    if (mobileEventCounter) {
      mobileEventCounter.textContent = totalFiltered.toString();
    }

    // Update mobile count text
    const mobileEventCount = document.getElementById("mobileEventCount");
    if (mobileEventCount) {
      if (totalFiltered === 0) {
        mobileEventCount.textContent =
          "No events found - try adjusting filters";
      } else {
        mobileEventCount.textContent = `${totalFiltered} event${
          totalFiltered !== 1 ? "s" : ""
        } found - click markers for details`;
      }
    }

    // Show/hide load more buttons
    const hasMore = displayed < totalFiltered;
    this.toggleLoadMoreButtons(hasMore);
  }

  toggleLoadMoreButtons(show) {
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    const mobileLoadMoreContainer = document.getElementById(
      "mobileLoadMoreContainer"
    );

    if (loadMoreContainer) {
      loadMoreContainer.classList.toggle("hidden", !show);
    }
    if (mobileLoadMoreContainer) {
      mobileLoadMoreContainer.classList.toggle("hidden", !show);
    }
  }

  async filterEvents() {
    const searchQuery = document
      .getElementById("searchInput")
      .value.toLowerCase()
      .trim();
    const categoryFilterValue = document.getElementById("categoryFilter").value;
    const dateFilterValue = document.getElementById("dateFilter").value;

    // Check if search query is a postcode for proximity search
    let searchCoords = null;
    const isPostcodeSearch = this.isPostcode(searchQuery);

    if (searchQuery.length > 0 && isPostcodeSearch) {
      searchCoords = await this.geocodePostcode(searchQuery);
    }

    this.filteredEvents = this.events.filter((event) => {
      // Search filter
      let matchesSearch = !searchQuery;

      if (searchQuery && !matchesSearch) {
        // Standard text search
        matchesSearch =
          event.title.toLowerCase().includes(searchQuery) ||
          event.description.toLowerCase().includes(searchQuery) ||
          event.location.toLowerCase().includes(searchQuery);

        // If postcode search and we have coordinates, include events within reasonable distance
        if (isPostcodeSearch && searchCoords && !matchesSearch) {
          const distance = this.calculateDistance(
            searchCoords.lat,
            searchCoords.lng,
            event.lat,
            event.lng
          );

          // Use dynamic radius based on search type
          const searchRadius = searchCoords.radius || 50;
          matchesSearch = distance <= searchRadius;

          // Store distance and search info for display
          event._searchDistance = distance;
          event._searchRadius = searchRadius;
          event._isPartialPostcode = searchCoords.isPartial;
        }
      }

      // Category filter - check both primary category and all categories
      const matchesCategory =
        !categoryFilterValue ||
        event.category === categoryFilterValue ||
        (event.categories && event.categories.includes(categoryFilterValue));

      // Date filter
      const matchesDate = !dateFilterValue || event.date === dateFilterValue;

      return matchesSearch && matchesCategory && matchesDate;
    });

    // Apply date range filtering based on quick filters
    this.filteredEvents = this.filterEventsByDate(this.filteredEvents);

    // If it was a postcode search, sort by distance
    if (isPostcodeSearch && searchCoords) {
      this.filteredEvents.sort((a, b) => {
        const distanceA = a._searchDistance || 0;
        const distanceB = b._searchDistance || 0;
        return distanceA - distanceB;
      });
    }

    // Reset pagination
    this.currentPage = 0;
    this.displayedEvents = [];

    this.displayEvents();
    this.addMarkers();
  }

  formatDate(dateString) {
    const options = { year: "numeric", month: "long", day: "numeric" };
    return new Date(dateString).toLocaleDateString("en-AU", options);
  }

  getCategoryColorClass(category) {
    const colorMap = {
      "breakfast-club": "bg-orange-500",
      "drop-in": "bg-blue-500",
      meeting: "bg-gray-700",
      workshop: "bg-yellow-500",
      social: "bg-purple-500",
      support: "bg-green-500",
      sport: "bg-red-500",
      other: "bg-gray-400",
    };
    return colorMap[category] || "bg-gray-400";
  }

  formatCategoryName(category) {
    const nameMap = {
      "breakfast-club": "Breakfast Club",
      "drop-in": "Drop-In Centre",
      meeting: "Association Meeting",
      workshop: "Workshop",
      social: "Social Event",
      support: "Support Group",
      sport: "Sport & Recreation",
      other: "Other",
    };
    return nameMap[category] || category;
  }

  // Distance calculation using Haversine formula
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Check if a string looks like a UK postcode (full or partial)
  isPostcode(searchQuery) {
    // Full UK postcode patterns: SW1A 1AA, M1 1AA, B33 8TH, etc.
    const fullPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;

    // Partial UK postcode patterns: TS28, TS 28, SW1A, M1, etc.
    const partialPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?$/i;

    const cleanQuery = searchQuery.replace(/\s+/g, "").trim();

    return (
      fullPostcodeRegex.test(searchQuery.replace(/\s+/g, " ").trim()) ||
      partialPostcodeRegex.test(cleanQuery)
    );
  }

  // Geocode a place name for proximity search
  async geocodePlaceName(placeName) {
    try {
      // Geocode the place name
      const cleanPlace = placeName.trim() + ", Northeast England, UK";

      // Try Google Geocoding API if available
      if (
        typeof config !== "undefined" &&
        config?.ENABLE_GEOCODING &&
        config?.GEOCODING_API_KEY &&
        config.GEOCODING_API_KEY !== "your-geocoding-api-key-here"
      ) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            cleanPlace
          )}&key=${config.GEOCODING_API_KEY}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            return {
              lat: location.lat,
              lng: location.lng,
              radius: 20,
              isPlace: true,
            };
          }
        }
      }

      // Fallback: Use free Nominatim API (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          cleanPlace
        )}&limit=1&countrycodes=gb`
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            radius: 20,
            isPlace: true,
          };
        }
      }

      throw new Error("Place not found");
    } catch (error) {
      console.warn("Place name geocoding failed:", error);
      return null;
    }
  }

  // Geocode a postcode (full or partial) and return coordinates
  async geocodePostcode(postcode) {
    try {
      const cleanPostcode = postcode.replace(/\s+/g, " ").trim().toUpperCase();

      // Determine if it's a partial postcode
      const isPartial =
        !/^[A-Z]{1,2}[0-9][A-Z0-9]?\s[0-9][A-Z]{2}$/.test(cleanPostcode) &&
        !/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(
          cleanPostcode.replace(/\s/g, "")
        );

      let searchQuery = cleanPostcode;
      let searchRadius = 15; // Default search radius in km

      // Try Google Geocoding API if available
      if (
        typeof config !== "undefined" &&
        config?.ENABLE_GEOCODING &&
        config?.GEOCODING_API_KEY &&
        config.GEOCODING_API_KEY !== "your-geocoding-api-key-here"
      ) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            searchQuery
          )}&key=${config.GEOCODING_API_KEY}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            return {
              lat: location.lat,
              lng: location.lng,
              radius: searchRadius,
              isPartial: isPartial,
            };
          }
        }
      }

      // Fallback: Use free Nominatim API (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1&countrycodes=gb`
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            radius: searchRadius,
            isPartial: isPartial,
          };
        }
      }

      throw new Error("Postcode not found");
    } catch (error) {
      console.warn("Postcode geocoding failed:", error);
      return null;
    }
  }

  populateCategoryFilter() {
    // Get all unique categories from events
    const allCategories = new Set();

    this.events.forEach((event) => {
      // Add primary category
      allCategories.add(event.category);

      // Add all secondary categories
      if (event.categories && Array.isArray(event.categories)) {
        event.categories.forEach((cat) => allCategories.add(cat));
      }
    });

    // Remove 'other' if no events are actually categorized as 'other'
    const availableCategories = Array.from(allCategories).filter(
      (cat) => cat && cat !== "other"
    );

    // Add 'other' only if there are events with 'other' category
    if (allCategories.has("other")) {
      availableCategories.push("other");
    }

    // Sort categories for consistent display
    availableCategories.sort();

    // Get the select element
    const categoryFilter = document.getElementById("categoryFilter");
    const currentValue = categoryFilter.value; // Preserve current selection

    // Clear existing options except "All Categories"
    categoryFilter.innerHTML = '<option value="">All Categories</option>';

    // Add options for categories that actually have events
    availableCategories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;

      // Count events in this category for display
      const eventCount = this.events.filter(
        (event) =>
          event.category === category ||
          (event.categories && event.categories.includes(category))
      ).length;

      option.textContent = `${this.formatCategoryName(
        category
      )} (${eventCount})`;

      // Restore previous selection if it still exists
      if (category === currentValue) {
        option.selected = true;
      }

      categoryFilter.appendChild(option);
    });
  }

  // Method to add new events (for future WordPress integration)
  addEvent(eventData) {
    const newEvent = {
      id: this.events.length + 1,
      ...eventData,
    };
    this.events.push(newEvent);
    this.filterEvents(); // Refresh display
  }

  // Method to get all events (for WordPress integration)
  getEvents() {
    return this.events;
  }
}

// Initialize the event map when page loads
let eventMap;

// Handle both cases: DOMContentLoaded already fired (dynamic script load) or not yet fired
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    eventMap = new EventMap();
  });
} else {
  // DOM already loaded, initialize immediately
  eventMap = new EventMap();
}

// Expose methods for WordPress integration
window.EventMapAPI = {
  addEvent: (eventData) => eventMap?.addEvent(eventData),
  getEvents: () => eventMap?.getEvents() || [],
  filterByCategory: (category) => {
    document.getElementById("categoryFilter").value = category;
    eventMap?.filterEvents();
  },
  searchEvents: (query) => {
    document.getElementById("searchInput").value = query;
    eventMap?.filterEvents();
  },
};
