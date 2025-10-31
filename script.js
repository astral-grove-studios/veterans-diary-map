// Event Map Integration Prototype
// Simple vanilla JavaScript implementation for easy WordPress integration

class EventMap {
    constructor() {
        this.map = null;
        this.markers = [];
        this.events = [];
        this.filteredEvents = [];
        this.displayedEvents = []; // Events currently shown in the list
        this.eventsPerPage = 20; // Number of events to load per page
        this.currentPage = 0;
        this.currentDateFilter = 'all'; // 'today', 'week', 'month', 'all'
        this.maxMarkersOnMap = 100; // Limit markers for performance

        this.init();
    }

    async init() {
        // Try to load events from local calendar file first, then Google Calendar API, then sample data
        try {
            await this.loadLocalCalendarEvents();
        } catch (error) {
            console.warn('Could not load local calendar events, trying Google Calendar API:', error);
            try {
                await this.loadGoogleCalendarEvents();
            } catch (apiError) {
                console.warn('Could not load Google Calendar events, using sample data:', apiError);
                this.loadSampleEvents();
            }
        }


        this.filteredEvents = [...this.events];
        this.initMap();
        this.populateCategoryFilter();
        this.displayEvents();
        this.setupEventListeners();
    }

    async loadLocalCalendarEvents() {
        console.log('Loading events from local calendar file...');

        try {
            const response = await fetch('./google-calendar-events');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            // Parse the JSON data (it starts with "items": so we need to wrap it)
            const jsonText = text.trim().startsWith('"items"') ? `{${text}}` : text;
            const data = JSON.parse(jsonText);

            console.log(`Found ${data.items?.length || 0} calendar items`);

            if (!data.items || data.items.length === 0) {
                throw new Error('No events found in calendar file');
            }

            // Transform and filter events
            this.events = await this.processCalendarItems(data.items);
            console.log(`Processed ${this.events.length} events for display`);

            // Show success notification
            this.showRealDataNotification();

        } catch (error) {
            console.error('Failed to load local calendar events:', error);
            throw error;
        }
    }

    async processCalendarItems(items) {
        const processedEvents = [];
        const now = new Date();

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            try {
                // Check if event is in the past
                const eventDate = new Date(item.start?.dateTime || item.start?.date);
                const eventDateTime = new Date(item.start?.dateTime || `${item.start?.date}T23:59:59`);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const eventDateOnly = new Date(eventDate);
                eventDateOnly.setHours(0, 0, 0, 0);
                
                // Skip events from previous days, but keep today's events even if elapsed
                if (eventDateOnly < today) {
                    continue;
                }

                // Skip non-event entries like "Useful Information"
                if ((item.summary || '').toLowerCase().includes('useful information')) {
                    continue;
                }

                // Transform to our event format
                const event = await this.transformCalendarItem(item, processedEvents.length + 1);
                
                // Mark event as elapsed if it's today but the time has passed
                event.isElapsed = eventDateTime < now && eventDateOnly.getTime() === today.getTime();

                // Skip events without valid location coordinates
                if (event.lat === 0 && event.lng === 0) {
                    console.warn(`Skipping event "${event.title}" - no valid coordinates`);
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
        // Clean and sanitize the data
        const title = this.sanitizeText(item.summary || 'Unnamed Event');
        const description = this.sanitizeHtml(item.description || 'No description available');
        const location = this.sanitizeText(item.location || 'Location TBD');
        
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
            organizer: this.extractOrganizer(item),
            originalEvent: item // Keep reference for debugging
        };

        // Get coordinates for the location
        const coordinates = await this.getCoordinatesForLocation(location);
        event.lat = coordinates.lat;
        event.lng = coordinates.lng;

        return event;
    }

    sanitizeText(text) {
        if (!text) return '';

        // Remove HTML tags and decode HTML entities
        return text
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\u003c/g, '<')
            .replace(/\u003e/g, '>')
            .trim();
    }

    sanitizeHtml(html) {
        if (!html) return '';

        // Convert HTML to plain text, preserving line breaks
        return html
            .replace(/<p[^>]*>/g, '')
            .replace(/<\/p>/g, '\n')
            .replace(/<br[^>]*>/g, '\n')
            .replace(/<[^>]*>/g, '') // Remove all other HTML tags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\u003c/g, '<')
            .replace(/\u003e/g, '>')
            .replace(/\u0080\u008b/g, '') // Remove invisible characters
            .replace(/\n+/g, ' ') // Replace multiple newlines with space
            .trim();
    }

    extractOrganizer(item) {
        // Try to extract organizer from various fields
        if (item.organizer?.displayName) {
            return item.organizer.displayName;
        }
        if (item.creator?.displayName) {
            return item.creator.displayName;
        }

        // Default to VFVIC for events from this calendar
        return 'VFVIC';
    }

    async loadGoogleCalendarEvents() {
        // Check if configuration is available
        const config = window.CALENDAR_CONFIG;
        if (!config || !config.API_KEY || !config.CALENDAR_ID) {
            throw new Error('Google Calendar configuration not found. Copy config.example.js to config.js and fill in your details.');
        }

        if (config.API_KEY === 'your-google-calendar-api-key-here') {
            throw new Error('Please configure your Google Calendar API key in config.js');
        }

        try {
            const timeMin = new Date().toISOString();
            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.CALENDAR_ID)}/events?key=${config.API_KEY}&timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=${config.MAX_EVENTS || 50}`;

            console.log('Loading events from Google Calendar...');
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`Found ${data.items?.length || 0} events in calendar`);

            if (!data.items || data.items.length === 0) {
                console.warn('No events found in Google Calendar');
                this.events = [];
                return;
            }

            // Transform calendar events to our format
            const transformedEvents = [];
            for (let i = 0; i < data.items.length; i++) {
                const calendarEvent = data.items[i];
                const transformedEvent = await this.transformGoogleCalendarEvent(calendarEvent, i + 1);
                transformedEvents.push(transformedEvent);
            }

            this.events = transformedEvents;
            console.log(`Successfully loaded ${this.events.length} events`);

        } catch (error) {
            console.error('Failed to load Google Calendar events:', error);
            throw error;
        }
    }

    async transformGoogleCalendarEvent(calendarEvent, index) {
        // Transform Google Calendar event to our format
        const event = {
            id: index,
            title: calendarEvent.summary || 'Unnamed Event',
            description: calendarEvent.description || 'No description available',
            category: this.categorizeEvent(calendarEvent.summary, calendarEvent.description),
            date: this.extractDate(calendarEvent),
            location: calendarEvent.location || 'Location TBD',
            organizer: calendarEvent.organizer?.displayName || 'VFVIC',
            originalEvent: calendarEvent // Keep reference for debugging
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
            return calendarEvent.start.dateTime.split('T')[0]; // Timed event
        }
        return new Date().toISOString().split('T')[0]; // Fallback to today
    }

    extractTime(calendarEvent) {
        // Extract time range for display
        const startTime = this.extractStartTime(calendarEvent);
        const endTime = this.extractEndTime(calendarEvent);

        if (!startTime && !endTime) {
            return 'All day';
        }

        if (startTime && endTime && startTime !== endTime) {
            return `${startTime} - ${endTime}`;
        }

        return startTime || 'Time TBD';
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
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false // Use 24-hour format for UK
        });
    }

    async getCoordinatesForLocation(location) {
        // First try predefined locations for common Northeast England venues
        const coordinates = this.getKnownLocationCoordinates(location);
        if (coordinates) {
            return coordinates;
        }

        // If geocoding is enabled and we have an API key, try that
        const config = window.CALENDAR_CONFIG;
        if (config?.ENABLE_GEOCODING && config?.GEOCODING_API_KEY && config.GEOCODING_API_KEY !== 'your-geocoding-api-key-here') {
            try {
                return await this.geocodeLocation(location);
            } catch (error) {
                console.warn(`Geocoding failed for "${location}":`, error);
            }
        }

        // Fallback: Generate unique coordinates for each venue using hash-based offset
        const fallbackCoords = config?.DEFAULT_REGION || { lat: 54.9783, lng: -1.6178 };
        return this.generateUniqueCoordinates(location, fallbackCoords);
    }

    generateUniqueCoordinates(location, baseCoords) {
        // Create a simple hash from the location string
        let hash = 0;
        for (let i = 0; i < location.length; i++) {
            const char = location.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Use hash to create small offsets (within ~1km radius)
        const offsetRange = 0.008; // Roughly 1km at this latitude
        const latOffset = ((hash % 1000) / 1000 - 0.5) * offsetRange;
        const lngOffset = (((hash >> 10) % 1000) / 1000 - 0.5) * offsetRange;
        
        return {
            lat: baseCoords.lat + latOffset,
            lng: baseCoords.lng + lngOffset
        };
    }

    getKnownLocationCoordinates(location) {
        const locationMap = {
            // Major cities in Northeast England (these are now fallbacks)
            'newcastle': { lat: 54.9783, lng: -1.6178 },
            'newcastle upon tyne': { lat: 54.9783, lng: -1.6178 },
            'sunderland': { lat: 54.9069, lng: -1.3838 },
            'middlesbrough': { lat: 54.5742, lng: -1.2349 },
            'durham': { lat: 54.7753, lng: -1.5849 },
            'gateshead': { lat: 54.9537, lng: -1.6103 },
            'hartlepool': { lat: 54.6896, lng: -1.2115 },
            'south shields': { lat: 54.9986, lng: -1.4323 },
            'north shields': { lat: 55.0176, lng: -1.4486 },
            'tynemouth': { lat: 55.0179, lng: -1.4217 },
            'whitley bay': { lat: 55.0390, lng: -1.4465 },
            'cramlington': { lat: 55.0789, lng: -1.5906 },
            'hexham': { lat: 54.9719, lng: -2.1019 },
            'consett': { lat: 54.8521, lng: -1.8317 },
            'stanley': { lat: 54.8697, lng: -1.6947 },
            'chester-le-street': { lat: 54.8556, lng: -1.5706 },
            'washington': { lat: 54.9000, lng: -1.5197 },
            'jarrow': { lat: 54.9806, lng: -1.4847 },
            'hebburn': { lat: 54.9733, lng: -1.5114 },
            'seaham': { lat: 54.8387, lng: -1.3467 },
            'ferryhill': { lat: 54.6998, lng: -1.5639 },
            'spennymoor': { lat: 54.6998, lng: -1.5996 },
            'bishop auckland': { lat: 54.6612, lng: -1.6776 },
            'peterlee': { lat: 54.7610, lng: -1.3372 },
            'blyth': { lat: 55.1278, lng: -1.5085 },
            'ashington': { lat: 55.1883, lng: -1.5686 },

            // Specific venues with unique coordinates (more precise)
            'dawdon youth and community centre': { lat: 54.8400, lng: -1.3480 },
            'royal british legion hebburn': { lat: 54.9740, lng: -1.5120 },
            'royal british legion branch meeting': { lat: 54.9740, lng: -1.5120 },
            'royal british legion': { lat: 54.9990, lng: -1.4330 }, // South Shields default
            'spennymoor clay pigeon club': { lat: 54.7010, lng: -1.5650 },
            'west house farm': { lat: 54.7020, lng: -1.5660 },
            'iona social club': { lat: 54.9750, lng: -1.5130 },
            'hebburn iona social club': { lat: 54.9750, lng: -1.5130 },
            'hebburn iona social club, station rd': { lat: 54.9750, lng: -1.5130 },
            
            // Newcastle specific venues with unique coordinates
            'newcastle civic centre': { lat: 54.9720, lng: -1.6100 },
            'newcastle university': { lat: 54.9800, lng: -1.6130 },
            'st james park': { lat: 54.9755, lng: -1.6220 },
            'quayside': { lat: 54.9690, lng: -1.6040 },
            'central station': { lat: 54.9680, lng: -1.6170 },
            'monument': { lat: 54.9730, lng: -1.6140 },
            'grainger market': { lat: 54.9710, lng: -1.6120 },
            'eldon square': { lat: 54.9750, lng: -1.6160 },
            
            // Additional specific venues to prevent clustering
            'walker activity dome': { lat: 54.9850, lng: -1.5800 },
            'byker community centre': { lat: 54.9820, lng: -1.5950 },
            'scotswood community centre': { lat: 54.9650, lng: -1.6600 },
            'benwell community centre': { lat: 54.9700, lng: -1.6400 },
            'arthurs hill community centre': { lat: 54.9760, lng: -1.6300 },
            'elswick community centre': { lat: 54.9720, lng: -1.6350 }
        };

        if (!location) return null;

        const locationLower = location.toLowerCase();

        // Direct match first (most specific)
        if (locationMap[locationLower]) {
            return locationMap[locationLower];
        }

        // Look for specific venue names (longer matches first)
        const venues = Object.keys(locationMap).filter(venue => venue.includes(' ')).sort((a, b) => b.length - a.length);
        for (const venue of venues) {
            if (locationLower.includes(venue)) {
                return locationMap[venue];
            }
        }

        // City-level matching with deterministic offset to avoid overlapping markers
        const cities = ['newcastle upon tyne', 'newcastle', 'sunderland', 'middlesbrough', 'durham', 'gateshead', 'hartlepool'];
        for (const city of cities) {
            if (locationLower.includes(city)) {
                const baseCoords = locationMap[city];
                if (baseCoords) {
                    // Create deterministic offset based on location string hash
                    const offset = this.getLocationOffset(location);
                    return { 
                        lat: baseCoords.lat + offset.lat, 
                        lng: baseCoords.lng + offset.lng 
                    };
                }
            }
        }

        return null;
    }

    // Generate deterministic coordinate offset based on location string to avoid overlapping markers
    getLocationOffset(location) {
        // Simple hash function for location string
        let hash = 0;
        for (let i = 0; i < location.length; i++) {
            const char = location.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Convert hash to offset values (±0.008 degrees ≈ ±800m max)
        const maxOffset = 0.008;
        const latOffset = ((hash % 1000) / 1000 - 0.5) * maxOffset;
        const lngOffset = (((hash >>> 16) % 1000) / 1000 - 0.5) * maxOffset;
        
        return { lat: latOffset, lng: lngOffset };
    }

    async geocodeLocation(address) {
        const config = window.CALENDAR_CONFIG;
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', Northeast England, UK')}&key=${config.GEOCODING_API_KEY}`
            );

            if (!response.ok) {
                throw new Error(`Geocoding API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                return { lat: location.lat, lng: location.lng };
            } else {
                throw new Error('No geocoding results found');
            }
        } catch (error) {
            console.error('Geocoding failed:', error);
            throw error;
        }
    }

    categorizeEvent(title, description) {
        const titleLower = (title || '').toLowerCase();
        const descLower = (description || '').toLowerCase();
        const combined = titleLower + ' ' + descLower;
        
        const tags = [];

        // Drop-in patterns
        if (descLower.includes('drop in') || descLower.includes('drop-in') || 
            combined.includes('drop in') || combined.includes('drop-in')) {
            tags.push('drop-in');
        }

        // Support patterns
        if (combined.includes('support') || combined.includes('counselling') || 
            combined.includes('therapy') || combined.includes('help') ||
            combined.includes('advice') || combined.includes('welfare')) {
            tags.push('support');
        }

        // Breakfast Club patterns (more specific to avoid false positives)
        if (combined.includes('breakfast club') || 
            (combined.includes('breakfast') && !combined.includes('clay pigeon')) ||
            (combined.includes('naafi break') && !descLower.includes('drop in'))) {
            tags.push('breakfast-club');
        }

        // Meeting patterns
        if (combined.includes('meeting') || combined.includes('branch meeting') || 
            combined.includes('association') || combined.includes('rbl') || 
            combined.includes('royal british legion') || combined.includes('dli')) {
            tags.push('meeting');
        }

        // Workshop patterns
        if (combined.includes('workshop') || combined.includes('training') || 
            combined.includes('course') || combined.includes('seminar')) {
            tags.push('workshop');
        }

        // Social patterns
        if (combined.includes('social') || combined.includes('mixer') || 
            combined.includes('party') || combined.includes('celebration')) {
            tags.push('social');
        }

        // Sport & Recreation patterns (highest priority for sport activities)
        if (combined.includes('clay pigeon') || combined.includes('shooting') || 
            titleLower.includes('sport') || combined.includes('football') || 
            combined.includes('rugby') || combined.includes('sailing') || 
            combined.includes('fishing') || combined.includes('golf') ||
            combined.includes('cycling') || combined.includes('walking') ||
            combined.includes('hiking') || combined.includes('swimming') ||
            combined.includes('offshore sailing')) {
            tags.push('sport');
        }

        // Return array of tags and primary category
        return {
            tags: tags,
            primary: tags.length > 0 ? tags[0] : 'other'
        };
    }

    loadSampleEvents() {
        // Show notification that sample data is being used
        this.showSampleDataNotification();

        // Sample veteran events data for the Northeast of England
        this.events = [
            {
                id: 1,
                title: "Veterans Breakfast Club - Newcastle",
                description: "Weekly breakfast meetup for veterans in Newcastle. Come and join fellow veterans for a friendly chat over breakfast.",
                category: "breakfast-club",
                categories: ["breakfast-club", "social"],
                date: "2025-11-02",
                time: "10:30 - 11:30",
                startTime: "10:30",
                endTime: "11:30",
                location: "Newcastle upon Tyne, UK",
                lat: 54.9783,
                lng: -1.6178,
                organizer: "VFVIC"
            },
            {
                id: 2,
                title: "Drop-In Support Centre",
                description: "Open drop-in centre for veterans needing support, advice, or just a chat. No appointment necessary.",
                category: "drop-in",
                date: "2025-11-05",
                time: "09:00 - 16:00",
                startTime: "09:00",
                endTime: "16:00",
                location: "Sunderland, UK",
                lat: 54.9069,
                lng: -1.3838,
                organizer: "VFVIC"
            },
            {
                id: 3,
                title: "Veterans Association Meeting",
                description: "Monthly meeting for the local veterans association. Discussing upcoming events and community support.",
                category: "meeting",
                date: "2025-11-10",
                location: "Middlesbrough, UK",
                lat: 54.5742,
                lng: -1.2349,
                organizer: "Middlesbrough Veterans"
            },
            {
                id: 1,
                title: "Veterans Support Meeting",
                description: "Monthly support meeting for veterans in the Newcastle area. Open to all service members and their families.",
                category: "support",
                date: "2025-11-15",
                time: "14:00 - 16:00",
                location: "Newcastle upon Tyne, UK",
                lat: 54.9783,
                lng: -1.6178,
                organizer: "VFVIC"
            },
            {
                id: 5,
                title: "Veterans Social Evening",
                description: "Social gathering for veterans and their families. Light refreshments provided.",
                category: "social",
                date: "2025-11-20",
                time: "18:30 - 21:00",
                location: "Gateshead, UK",
                lat: 54.9537,
                lng: -1.6103,
                organizer: "Gateshead Veterans"
            },
            {
                id: 6,
                title: "Support Group Session",
                description: "Confidential support group for veterans dealing with transition challenges.",
                category: "support",
                date: "2025-11-25",
                location: "Hartlepool, UK",
                lat: 54.6896,
                lng: -1.2115,
                organizer: "VFVIC"
            },
            {
                id: 7,
                title: "Clay Pigeon Shooting",
                description: "Sunday morning clay pigeon shooting event for veterans. Equipment provided, all skill levels welcome.",
                category: "sport",
                categories: ["sport"],
                date: "2025-11-03",
                time: "09:30 - 12:00",
                location: "Durham, UK",
                lat: 54.7753,
                lng: -1.5849,
                organizer: "VFVIC"
            }
        ];

        this.filteredEvents = [...this.events];
        this.initMap();
        this.populateCategoryFilter();
        this.displayEvents();
        this.setupEventListeners();
    }

    showSampleDataNotification() {
        // Create a notification banner for real calendar data
        const notification = document.createElement('div');
        notification.className = 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-5 rounded';
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
        const header = document.querySelector('header');
        header.parentNode.insertBefore(notification, header.nextSibling);
    }

    showRealDataNotification() {
        // Create a notification banner for real calendar data
        const notification = document.createElement('div');
        notification.className = 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-5 rounded';
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
        const header = document.querySelector('header');
        header.parentNode.insertBefore(notification, header.nextSibling);
    }
    
    initMap() {
        // Initialize Leaflet map centered on Northeast England
        this.map = L.map('map').setView([54.9783, -1.6178], 8);

        // Add OpenStreetMap tiles (free, no API key required)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.addMarkers();
    }

    addMarkers() {
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        // Limit markers for performance (prioritize closer events if sorted by distance)
        const eventsToShow = this.filteredEvents.slice(0, this.maxMarkersOnMap);
        
        if (eventsToShow.length < this.filteredEvents.length) {
            console.log(`Showing ${eventsToShow.length} of ${this.filteredEvents.length} events on map for performance`);
        }

        // Group events by exact location string AND date for more precise grouping
        const eventsByLocationAndDate = new Map();
        
        eventsToShow.forEach(event => {
            // Use location string + date for grouping to ensure only same venue events are grouped
            const locationDateKey = `${event.location}|${event.date}`;
            if (!eventsByLocationAndDate.has(locationDateKey)) {
                eventsByLocationAndDate.set(locationDateKey, []);
            }
            eventsByLocationAndDate.get(locationDateKey).push(event);
        });

        // Create markers for each unique location-date combination
        eventsByLocationAndDate.forEach((eventsAtLocationDate, locationDateKey) => {
            const [location, date] = locationDateKey.split('|');
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

                marker.on('click', () => {
                    this.highlightEvent(event.id);
                });

                this.markers.push(marker);
            } else {
                // Multiple events at this exact location on the same date
                // Sort events by time (earliest first)
                const sortedEvents = eventsAtLocationDate.sort((a, b) => {
                    const timeA = a.startTime || a.time || '00:00';
                    const timeB = b.startTime || b.time || '00:00';
                    return timeA.localeCompare(timeB);
                });

                const marker = L.marker([lat, lng])
                    .addTo(this.map)
                    .bindPopup(this.createMultiEventPopupContent(sortedEvents, date));

                // Store marker reference on the first event for mobile focus functionality
                sortedEvents[0]._marker = marker;
                sortedEvents[0]._originalIcon = marker.getIcon();

                // When marker is clicked, highlight the first (earliest) event
                marker.on('click', () => {
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
        const elapsedLabel = event.isElapsed ? '<span style="background: #6b7280; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 8px;">Ended</span>' : '';
        const titleStyle = event.isElapsed ? 'color: #6b7280; opacity: 0.8;' : 'color: #1f2937;';
        
        return `
            <div style="max-width: 250px;">
                <h4 style="margin: 0 0 10px 0; ${titleStyle}">${event.title}${elapsedLabel}</h4>
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
                    <span class="inline-block px-2 py-1 rounded text-xs text-white ${this.getCategoryColorClass(event.category)}">${this.formatCategoryName(event.category)}</span>
                </p>
                <p style="margin: 5px 0; font-size: 12px; color: #4b5563;">${event.description}</p>
                <p style="margin: 5px 0 0 0; font-size: 11px; color: #6b7280;">
                    <strong>Organizer:</strong> ${event.organizer}
                </p>
            </div>
        `;
    }

    createMultiEventPopupContent(events, date) {
        const location = events[0].location; // All events share the same location
        const eventCount = events.length;
        
        // Events are already sorted by time in addMarkers method
        const eventsHtml = events.map((event, index) => {
            const elapsedLabel = event.isElapsed ? '<span style="background: #6b7280; color: white; padding: 1px 4px; border-radius: 8px; font-size: 9px; margin-left: 5px;">Ended</span>' : '';
            const titleStyle = event.isElapsed ? 'color: #6b7280; opacity: 0.8;' : 'color: #1f2937;';
            
            return `
                <div class="border-b border-gray-200 pb-2 mb-2 ${index === events.length - 1 ? 'border-b-0 pb-0 mb-0' : ''}" 
                     style="cursor: pointer;" 
                     onclick="eventMap.highlightEvent(${event.id}); eventMap.map.closePopup();">
                    <h5 style="margin: 0 0 5px 0; ${titleStyle} font-weight: bold;">${event.title}${elapsedLabel}</h5>
                    <p style="margin: 2px 0; font-size: 12px; color: #6b7280;">
                        <strong>⏰</strong> ${event.time || 'Time TBD'}
                    </p>
                    <p style="margin: 2px 0; font-size: 12px; color: #6b7280;">
                        <span class="inline-block px-2 py-1 rounded text-xs text-white ${this.getCategoryColorClass(event.category)}">${this.formatCategoryName(event.category)}</span>
                    </p>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #4b5563;">${event.description.substring(0, 80)}${event.description.length > 80 ? '...' : ''}</p>
                </div>
            `;
        }).join('');

        return `
            <div style="max-width: 300px;">
                <h4 style="margin: 0 0 10px 0; color: #1f2937;">📍 ${location}</h4>
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280;">
                    <strong>📅</strong> ${this.formatDate(date)}
                </p>
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #059669;">
                    ${eventCount} event${eventCount > 1 ? 's' : ''} on this day
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
        const eventItems = document.getElementById('eventItems');

        if (this.filteredEvents.length === 0) {
            const searchQuery = document.getElementById('searchInput').value.trim();
            const isPostcodeSearch = this.isPostcode(searchQuery);
            const isPlaceSearch = this.isKnownPlace(searchQuery);
            let noResultsMessage = 'No events found matching your criteria.';
            
            if (isPostcodeSearch) {
                noResultsMessage = 'No events found within search radius. Try a larger area or different postcode.';
            } else if (isPlaceSearch) {
                noResultsMessage = 'No events found within 20km of this location. Try a different place name or broader search.';
            }
            
            if (eventItems) {
                eventItems.innerHTML = `<div class="text-center py-5 text-gray-500">${noResultsMessage}</div>`;
            }
            
            // Update mobile event count
            this.updateMobileEventCount();
            return;
        }

        // Check if any events have distance info (location-based search active)
        const hasDistanceInfo = this.filteredEvents.some(event => event._searchDistance !== undefined);
        const isPartialPostcodeSearch = this.filteredEvents.some(event => event._isPartialPostcode);
        const isPlaceSearch = this.filteredEvents.some(event => event._isPlaceSearch);
        
        // Add header info for location-based searches
        let searchInfoHeader = '';
        if (hasDistanceInfo) {
            const searchQuery = document.getElementById('searchInput').value.trim();
            let searchType = 'postcode';
            
            if (isPlaceSearch) {
                searchType = 'place name';
            } else if (isPartialPostcodeSearch) {
                searchType = 'partial postcode area';
            }
            
            const maxRadius = Math.max(...this.filteredEvents.map(e => e._searchRadius || 50));
            searchInfoHeader = `
                <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p class="text-sm text-blue-800">
                        <strong>📍 ${searchType.charAt(0).toUpperCase() + searchType.slice(1)} Search:</strong> 
                        Showing events within ${maxRadius}km of "${searchQuery}", sorted by distance
                    </p>
                </div>
            `;
        }

        if (eventItems) {
            eventItems.innerHTML = searchInfoHeader + this.generateGroupedEventsList();
        }
        
        // Update mobile event count
        this.updateMobileEventCount();
    }

    updateMobileEventCount() {
        const count = this.filteredEvents.length;
        
        // Update mobile event count text
        const mobileEventCount = document.getElementById('mobileEventCount');
        if (mobileEventCount) {
            if (count === 0) {
                mobileEventCount.textContent = 'No events found - try adjusting filters';
            } else {
                mobileEventCount.textContent = `${count} event${count !== 1 ? 's' : ''} found - click markers for details`;
            }
        }
        
        // Update all badge counters
        const eventCounter = document.getElementById('eventCounter');
        if (eventCounter) {
            eventCounter.textContent = `${count} event${count !== 1 ? 's' : ''}`;
        }
        
        const mobileCounter = document.getElementById('mobileCounter');
        if (mobileCounter) {
            mobileCounter.textContent = count.toString();
        }
        
        const mobileEventCounter = document.getElementById('mobileEventCounter');
        if (mobileEventCounter) {
            mobileEventCounter.textContent = count.toString();
        }
    }

    displayMobileEventList() {
        const mobileEventItems = document.getElementById('mobileEventItems');
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
        
        this.filteredEvents.forEach(event => {
            const dateKey = event.date;
            if (!eventsByDate.has(dateKey)) {
                eventsByDate.set(dateKey, []);
            }
            eventsByDate.get(dateKey).push(event);
        });

        // Sort dates chronologically
        const sortedDates = Array.from(eventsByDate.keys()).sort((a, b) => new Date(a) - new Date(b));

        // Generate HTML for each date group - mobile optimized
        return sortedDates.map(date => {
            const eventsOnDate = eventsByDate.get(date);
            
            // Sort events within the date by time
            const sortedEvents = eventsOnDate.sort((a, b) => {
                const timeA = a.startTime || a.time || '00:00';
                const timeB = b.startTime || b.time || '00:00';
                return timeA.localeCompare(timeB);
            });

            const dateHeader = `
                <div class="mb-3 mt-4 first:mt-0">
                    <h4 class="text-lg font-bold text-gray-800 mb-2 pb-1 border-b border-gray-200">
                        📅 ${this.formatDate(date)} 
                        <span class="text-sm font-normal text-gray-600">(${eventsOnDate.length})</span>
                    </h4>
                </div>
            `;

            const eventsHtml = sortedEvents.map(event => {
                // Generate tag badges for all categories - smaller for mobile
                const tagBadges = (event.categories || [event.category]).map(category => 
                    `<span class="inline-block px-2 py-1 rounded-full text-xs font-medium text-white mr-1 mb-1 ${this.getCategoryColorClass(category)}">${this.formatCategoryName(category)}</span>`
                ).join('');

                // Add distance information if available
                const distanceInfo = event._searchDistance !== undefined ? 
                    `<p class="text-gray-600 text-xs mb-1">📏 ${event._searchDistance.toFixed(1)} km away</p>` : '';

                // Apply elapsed styling for mobile
                const elapsedClass = event.isElapsed ? 'opacity-60 bg-gray-100' : 'bg-gray-50';
                const borderClass = event.isElapsed ? 'border-gray-400' : 'border-blue-500';
                const elapsedLabel = event.isElapsed ? '<span class="text-xs bg-gray-500 text-white px-1 py-0.5 rounded mr-1">Ended</span>' : '';

                return `
                    <div class="${elapsedClass} rounded-lg p-3 mb-3 border-l-4 ${borderClass}" 
                         onclick="eventMap.focusOnEvent('${event.id}')">
                        <div class="flex justify-between items-start mb-2">
                            <h5 class="text-sm font-semibold text-gray-800 leading-tight flex-1">${event.title}</h5>
                            <div class="flex items-center ml-2">
                                ${elapsedLabel}
                                <span class="text-xs text-gray-600 whitespace-nowrap">${event.timeDisplay || event.time}</span>
                            </div>
                        </div>
                        ${distanceInfo}
                        <p class="text-xs text-gray-600 mb-1"><strong>📍</strong> ${event.location}</p>
                        <div class="mb-2">${tagBadges}</div>
                        ${event.description ? `<p class="text-xs text-gray-700 line-clamp-2">${event.description}</p>` : ''}
                    </div>
                `;
            }).join('');

            return dateHeader + eventsHtml;
        }).join('');
    }

    focusOnEvent(eventId) {
        // Close mobile modal
        const mobileEventModal = document.getElementById('mobileEventModal');
        if (mobileEventModal) {
            mobileEventModal.classList.add('hidden');
            document.body.style.overflow = '';
        }

        // Find the event and its marker
        const event = this.filteredEvents.find(e => e.id === eventId);
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
        
        this.filteredEvents.forEach(event => {
            const dateKey = event.date;
            if (!eventsByDate.has(dateKey)) {
                eventsByDate.set(dateKey, []);
            }
            eventsByDate.get(dateKey).push(event);
        });

        // Sort dates chronologically
        const sortedDates = Array.from(eventsByDate.keys()).sort((a, b) => new Date(a) - new Date(b));

        // Generate HTML for each date group
        return sortedDates.map(date => {
            const eventsOnDate = eventsByDate.get(date);
            
            // Sort events within the date by time
            const sortedEvents = eventsOnDate.sort((a, b) => {
                const timeA = a.startTime || a.time || '00:00';
                const timeB = b.startTime || b.time || '00:00';
                return timeA.localeCompare(timeB);
            });

            const dateHeader = `
                <div class="mb-4 mt-6 first:mt-0">
                    <h3 class="text-xl font-bold text-gray-800 mb-3 pb-2 border-b-2 border-blue-200">
                        📅 ${this.formatDate(date)} 
                        <span class="text-sm font-normal text-gray-600 ml-2">(${eventsOnDate.length} event${eventsOnDate.length > 1 ? 's' : ''})</span>
                    </h3>
                </div>
            `;

            const eventsHtml = sortedEvents.map(event => {
                // Generate tag badges for all categories
                const tagBadges = (event.categories || [event.category]).map(category => 
                    `<span class="inline-block px-2 py-1 rounded-full text-xs font-medium text-white mr-1 mb-1 ${this.getCategoryColorClass(category)}">${this.formatCategoryName(category)}</span>`
                ).join('');

                // Add distance information if available (from postcode search)
                const distanceInfo = event._searchDistance !== undefined ? 
                    `<p class="text-gray-600 text-sm mb-1"><strong>📏</strong> ${event._searchDistance.toFixed(1)} km away</p>` : '';

                // Apply elapsed styling if event has passed
                const elapsedClass = event.isElapsed ? 'opacity-60 bg-gray-100' : 'bg-gray-50';
                const borderClass = event.isElapsed ? 'border-gray-400' : 'border-blue-500';
                const hoverClass = event.isElapsed ? 'hover:bg-gray-200' : 'hover:bg-blue-50';
                const elapsedLabel = event.isElapsed ? '<span class="text-xs bg-gray-500 text-white px-2 py-1 rounded-full mr-2">Ended</span>' : '';

                return `
                    <div class="${elapsedClass} rounded-lg p-4 cursor-pointer transition-all duration-300 border-l-4 ${borderClass} ${hoverClass} hover:shadow-md hover:-translate-y-1 mb-4"
                         data-event-id="${event.id}" onclick="eventMap.focusEvent(${event.id})">
                        <div class="flex items-start justify-between mb-2">
                            <h4 class="text-gray-800 text-lg font-semibold flex-1">${event.title}</h4>
                            ${elapsedLabel}
                        </div>
                        <p class="text-gray-600 text-sm mb-1"><strong>⏰</strong> ${event.time}</p>
                        <p class="text-gray-600 text-sm mb-1"><strong>📍</strong> ${event.location}</p>
                        ${distanceInfo}
                        <p class="text-gray-600 text-sm mb-1">${event.description}</p>
                        <p class="text-gray-600 text-sm mb-2"><strong>👤</strong> ${event.organizer}</p>
                        <div class="flex flex-wrap">${tagBadges}</div>
                    </div>
                `;
            }).join('');

            return dateHeader + eventsHtml;
        }).join('');
    }

    focusEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            // Center map on event location
            this.map.setView([event.lat, event.lng], 10);

            // Open popup for the marker
            const marker = this.markers.find(m =>
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
        document.querySelectorAll('[data-event-id]').forEach(item => {
            item.classList.remove('border-red-500', 'bg-red-50');
            item.classList.add('border-blue-500', 'bg-gray-50');
        });

        // Add highlight to selected item
        const selectedItem = document.querySelector(`[data-event-id="${eventId}"]`);
        if (selectedItem) {
            selectedItem.classList.remove('border-blue-500', 'bg-gray-50');
            selectedItem.classList.add('border-red-500', 'bg-red-50');
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');

        const performSearch = async () => {
            const query = searchInput.value.toLowerCase();
            await this.filterEvents();
        };

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') await performSearch();
        });

        // Filter functionality
        const categoryFilter = document.getElementById('categoryFilter');
        const dateFilter = document.getElementById('dateFilter');
        const clearFilters = document.getElementById('clearFilters');

        categoryFilter.addEventListener('change', async () => await this.filterEvents());
        dateFilter.addEventListener('change', async () => await this.filterEvents());

        clearFilters.addEventListener('click', async () => {
            searchInput.value = '';
            categoryFilter.value = '';
            dateFilter.value = '';
            this.currentDateFilter = 'all';
            this.currentPage = 0;
            await this.filterEvents();
        });

        // Quick date filter buttons
        const filterToday = document.getElementById('filterToday');
        const filterWeek = document.getElementById('filterWeek');
        const filterMonth = document.getElementById('filterMonth');
        const filterAll = document.getElementById('filterAll');

        if (filterToday) {
            filterToday.addEventListener('click', () => this.setDateFilter('today'));
        }
        if (filterWeek) {
            filterWeek.addEventListener('click', () => this.setDateFilter('week'));
        }
        if (filterMonth) {
            filterMonth.addEventListener('click', () => this.setDateFilter('month'));
        }
        if (filterAll) {
            filterAll.addEventListener('click', () => this.setDateFilter('all'));
        }

        // Load more functionality
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const mobileLoadMoreBtn = document.getElementById('mobileLoadMoreBtn');

        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreEvents());
        }
        if (mobileLoadMoreBtn) {
            mobileLoadMoreBtn.addEventListener('click', () => this.loadMoreEvents(true));
        }

        // Mobile list modal functionality
        const showMobileList = document.getElementById('showMobileList');
        const closeMobileList = document.getElementById('closeMobileList');
        const mobileEventModal = document.getElementById('mobileEventModal');

        if (showMobileList) {
            showMobileList.addEventListener('click', () => {
                this.displayMobileEventList();
                mobileEventModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            });
        }

        if (closeMobileList) {
            closeMobileList.addEventListener('click', () => {
                mobileEventModal.classList.add('hidden');
                document.body.style.overflow = ''; // Restore scrolling
            });
        }

        // Close modal when clicking backdrop
        if (mobileEventModal) {
            mobileEventModal.addEventListener('click', (e) => {
                if (e.target === mobileEventModal) {
                    mobileEventModal.classList.add('hidden');
                    document.body.style.overflow = '';
                }
            });
        }
    }

    async setDateFilter(filterType) {
        console.log(`Setting date filter to: ${filterType}`);
        this.currentDateFilter = filterType;
        this.currentPage = 0;
        this.updateDateFilterButtons();
        await this.filterEvents();
        console.log(`After filtering: ${this.filteredEvents.length} events found`);
    }

    updateDateFilterButtons() {
        const buttons = {
            'today': document.getElementById('filterToday'),
            'week': document.getElementById('filterWeek'),
            'month': document.getElementById('filterMonth'),
            'all': document.getElementById('filterAll')
        };

        // Reset all button styles
        Object.values(buttons).forEach(btn => {
            if (btn) {
                btn.className = btn.className.replace(/bg-\w+-500|text-white/, 'bg-gray-100 text-gray-800');
            }
        });

        // Highlight active button
        const activeBtn = buttons[this.currentDateFilter];
        if (activeBtn) {
            const colorMap = {
                'today': 'bg-green-500 text-white',
                'week': 'bg-blue-500 text-white',
                'month': 'bg-purple-500 text-white',
                'all': 'bg-gray-500 text-white'
            };
            activeBtn.className = activeBtn.className.replace(/bg-\w+-\d+\s+text-\w+-\d+/, colorMap[this.currentDateFilter]);
        }
    }

    filterEventsByDate(events) {
        if (this.currentDateFilter === 'all') {
            return events; // No filtering needed
        }
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        console.log(`Filtering ${events.length} events by date filter: ${this.currentDateFilter}`);
        
        const filtered = events.filter(event => {
            const eventDate = new Date(event.date);
            
            switch (this.currentDateFilter) {
                case 'today':
                    return eventDate.toDateString() === today.toDateString();
                case 'week':
                    const weekFromNow = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
                    return eventDate >= today && eventDate <= weekFromNow;
                case 'month':
                    const monthFromNow = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
                    return eventDate >= today && eventDate <= monthFromNow;
                case 'all':
                default:
                    return true;
            }
        });
        
        console.log(`Date filtering result: ${filtered.length} events remain`);
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
        const eventCounter = document.getElementById('eventCounter');
        if (eventCounter) {
            eventCounter.textContent = `${displayed} of ${totalFiltered} events`;
        }
        
        // Mobile counters
        const mobileCounter = document.getElementById('mobileCounter');
        const mobileEventCounter = document.getElementById('mobileEventCounter');
        
        if (mobileCounter) {
            mobileCounter.textContent = totalFiltered.toString();
        }
        if (mobileEventCounter) {
            mobileEventCounter.textContent = totalFiltered.toString();
        }
        
        // Update mobile count text
        const mobileEventCount = document.getElementById('mobileEventCount');
        if (mobileEventCount) {
            if (totalFiltered === 0) {
                mobileEventCount.textContent = 'No events found - try adjusting filters';
            } else {
                mobileEventCount.textContent = `${totalFiltered} event${totalFiltered !== 1 ? 's' : ''} found - click markers for details`;
            }
        }
        
        // Show/hide load more buttons
        const hasMore = displayed < totalFiltered;
        this.toggleLoadMoreButtons(hasMore);
    }

    toggleLoadMoreButtons(show) {
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        const mobileLoadMoreContainer = document.getElementById('mobileLoadMoreContainer');
        
        if (loadMoreContainer) {
            loadMoreContainer.classList.toggle('hidden', !show);
        }
        if (mobileLoadMoreContainer) {
            mobileLoadMoreContainer.classList.toggle('hidden', !show);
        }
    }

    async filterEvents() {
        const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
        const categoryFilterValue = document.getElementById('categoryFilter').value;
        const dateFilterValue = document.getElementById('dateFilter').value;

        console.log('Filter Debug:', {
            searchQuery,
            categoryFilter: categoryFilterValue,
            dateFilter: dateFilterValue,
            totalEvents: this.events.length,
            eventCategories: [...new Set(this.events.map(e => e.category))],
            allEventTags: [...new Set(this.events.flatMap(e => e.categories || [e.category]))]
        });

        // Check if search query is a postcode for proximity search
        let searchCoords = null;
        const isPostcodeSearch = this.isPostcode(searchQuery);
        const isPlaceSearch = !isPostcodeSearch && this.isKnownPlace(searchQuery);
        
        if (isPostcodeSearch && searchQuery.length > 0) {
            console.log('Postcode detected, getting coordinates for proximity search...');
            searchCoords = await this.geocodePostcode(searchQuery);
            if (searchCoords) {
                console.log(`Postcode ${searchQuery} coordinates:`, searchCoords);
            }
        } else if (isPlaceSearch && searchQuery.length > 0) {
            console.log('Place name detected, getting coordinates for proximity search...');
            searchCoords = await this.geocodePlaceName(searchQuery);
            if (searchCoords) {
                console.log(`Place ${searchQuery} coordinates:`, searchCoords);
            }
        }

        this.filteredEvents = this.events.filter(event => {
            // Search filter
            let matchesSearch = !searchQuery;
            
            if (searchQuery && !matchesSearch) {
                // Standard text search
                matchesSearch = event.title.toLowerCase().includes(searchQuery) ||
                    event.description.toLowerCase().includes(searchQuery) ||
                    event.location.toLowerCase().includes(searchQuery) ||
                    event.organizer.toLowerCase().includes(searchQuery);
                
                // If postcode or place search and we have coordinates, include events within reasonable distance
                if ((isPostcodeSearch || isPlaceSearch) && searchCoords && !matchesSearch) {
                    const distance = this.calculateDistance(
                        searchCoords.lat, searchCoords.lng,
                        event.lat, event.lng
                    );
                    
                    // Use dynamic radius based on search type
                    const searchRadius = searchCoords.radius || 50;
                    matchesSearch = distance <= searchRadius;
                    
                    // Store distance and search info for display
                    event._searchDistance = distance;
                    event._searchRadius = searchRadius;
                    event._isPartialPostcode = searchCoords.isPartial;
                    event._isPlaceSearch = searchCoords.isPlace;
                }
            }

            // Category filter - check both primary category and all categories
            const matchesCategory = !categoryFilterValue || 
                event.category === categoryFilterValue ||
                (event.categories && event.categories.includes(categoryFilterValue));

            // Date filter
            const matchesDate = !dateFilterValue || event.date === dateFilterValue;

            return matchesSearch && matchesCategory && matchesDate;
        });

        // Apply date range filtering based on quick filters
        this.filteredEvents = this.filterEventsByDate(this.filteredEvents);

        // If it was a postcode or place search, sort by distance
        if ((isPostcodeSearch || isPlaceSearch) && searchCoords) {
            this.filteredEvents.sort((a, b) => {
                const distanceA = a._searchDistance || 0;
                const distanceB = b._searchDistance || 0;
                return distanceA - distanceB;
            });
            
            let searchType = 'postcode';
            if (isPlaceSearch) searchType = 'place name';
            else if (searchCoords.isPartial) searchType = 'partial postcode';
            
            const radius = searchCoords.radius || 50;
            console.log(`${searchType} search: Found ${this.filteredEvents.length} events within ${radius}km, sorted by distance`);
        }

        console.log(`Filtered ${this.filteredEvents.length} events from ${this.events.length} total`);

        // Reset pagination
        this.currentPage = 0;
        this.displayedEvents = [];
        
        this.displayEvents();
        this.addMarkers();
    }

    formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-AU', options);
    }

    getCategoryColorClass(category) {
        const colorMap = {
            'breakfast-club': 'bg-orange-500',
            'drop-in': 'bg-blue-500',
            'meeting': 'bg-gray-700',
            'workshop': 'bg-yellow-500',
            'social': 'bg-purple-500',
            'support': 'bg-green-500',
            'sport': 'bg-red-500',
            'other': 'bg-gray-400'
        };
        return colorMap[category] || 'bg-gray-400';
    }

    formatCategoryName(category) {
        const nameMap = {
            'breakfast-club': 'Breakfast Club',
            'drop-in': 'Drop-In Centre',
            'meeting': 'Association Meeting',
            'workshop': 'Workshop',
            'social': 'Social Event',
            'support': 'Support Group',
            'sport': 'Sport & Recreation',
            'other': 'Other'
        };
        return nameMap[category] || category;
    }

    // Distance calculation using Haversine formula
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in kilometers
    }

    toRadians(degrees) {
        return degrees * (Math.PI/180);
    }

    // Check if a string looks like a UK postcode (full or partial)
    isPostcode(searchQuery) {
        // Full UK postcode patterns: SW1A 1AA, M1 1AA, B33 8TH, etc.
        const fullPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
        
        // Partial UK postcode patterns: TS28, TS 28, SW1A, M1, etc.
        const partialPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?$/i;
        
        const cleanQuery = searchQuery.replace(/\s+/g, '').trim();
        
        return fullPostcodeRegex.test(searchQuery.replace(/\s+/g, ' ').trim()) || 
               partialPostcodeRegex.test(cleanQuery);
    }

    // Check if a search query is a known place name
    isKnownPlace(searchQuery) {
        const knownPlaces = [
            'newcastle', 'newcastle upon tyne', 'sunderland', 'middlesbrough', 'durham',
            'gateshead', 'hartlepool', 'south shields', 'north shields', 'tynemouth',
            'whitley bay', 'cramlington', 'hexham', 'consett', 'stanley', 'chester-le-street',
            'washington', 'jarrow', 'hebburn', 'seaham', 'ferryhill', 'spennymoor',
            'bishop auckland', 'peterlee', 'blyth', 'ashington'
        ];
        
        const queryLower = searchQuery.toLowerCase().trim();
        return knownPlaces.some(place => 
            place === queryLower || 
            queryLower.includes(place) ||
            place.includes(queryLower)
        );
    }

    // Geocode a place name for proximity search
    async geocodePlaceName(placeName) {
        try {
            // First try our known location coordinates
            const knownCoords = this.getKnownLocationCoordinates(placeName);
            if (knownCoords) {
                return {
                    lat: knownCoords.lat,
                    lng: knownCoords.lng,
                    radius: 20, // 20km radius for place searches
                    isPlace: true
                };
            }

            // Fallback to online geocoding
            const cleanPlace = placeName.trim() + ', Northeast England, UK';
            
            // Try Google Geocoding API if available
            if (typeof config !== 'undefined' && config?.ENABLE_GEOCODING && config?.GEOCODING_API_KEY && config.GEOCODING_API_KEY !== 'your-geocoding-api-key-here') {
                const response = await fetch(
                    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanPlace)}&key=${config.GEOCODING_API_KEY}`
                );
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.results && data.results.length > 0) {
                        const location = data.results[0].geometry.location;
                        return { 
                            lat: location.lat, 
                            lng: location.lng,
                            radius: 20,
                            isPlace: true
                        };
                    }
                }
            }

            // Fallback: Use free Nominatim API (OpenStreetMap)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanPlace)}&limit=1&countrycodes=gb`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    return { 
                        lat: parseFloat(data[0].lat), 
                        lng: parseFloat(data[0].lon),
                        radius: 20,
                        isPlace: true
                    };
                }
            }
            
            throw new Error('Place not found');
        } catch (error) {
            console.warn('Place name geocoding failed:', error);
            return null;
        }
    }

    // Geocode a postcode (full or partial) and return coordinates
    async geocodePostcode(postcode) {
        try {
            const cleanPostcode = postcode.replace(/\s+/g, ' ').trim().toUpperCase();
            
            // Determine if it's a partial postcode
            const isPartial = !/^[A-Z]{1,2}[0-9][A-Z0-9]?\s[0-9][A-Z]{2}$/.test(cleanPostcode) &&
                             !/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(cleanPostcode.replace(/\s/g, ''));
            
            let searchQuery = cleanPostcode;
            let searchRadius = 15; // Default search radius in km
            
            if (isPartial) {
                // For partial postcodes, search for the area center and use larger radius
                searchQuery = cleanPostcode + ', UK';
                searchRadius = 25; // Larger radius for partial postcodes
                console.log(`Partial postcode detected: ${cleanPostcode}, using larger search radius`);
            } else {
                searchQuery = cleanPostcode + ', UK';
                console.log(`Full postcode detected: ${cleanPostcode}`);
            }

            // Try Google Geocoding API if available
            if (typeof config !== 'undefined' && config?.ENABLE_GEOCODING && config?.GEOCODING_API_KEY && config.GEOCODING_API_KEY !== 'your-geocoding-api-key-here') {
                const response = await fetch(
                    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${config.GEOCODING_API_KEY}`
                );
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.results && data.results.length > 0) {
                        const location = data.results[0].geometry.location;
                        return { 
                            lat: location.lat, 
                            lng: location.lng,
                            radius: searchRadius,
                            isPartial: isPartial
                        };
                    }
                }
            }

            // Fallback: Use free Nominatim API (OpenStreetMap)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=gb`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    return { 
                        lat: parseFloat(data[0].lat), 
                        lng: parseFloat(data[0].lon),
                        radius: searchRadius,
                        isPartial: isPartial
                    };
                }
            }
            
            throw new Error('Postcode not found');
        } catch (error) {
            console.warn('Postcode geocoding failed:', error);
            return null;
        }
    }

    populateCategoryFilter() {
        // Get all unique categories from events
        const allCategories = new Set();
        
        this.events.forEach(event => {
            // Add primary category
            allCategories.add(event.category);
            
            // Add all secondary categories
            if (event.categories && Array.isArray(event.categories)) {
                event.categories.forEach(cat => allCategories.add(cat));
            }
        });

        // Remove 'other' if no events are actually categorized as 'other'
        const availableCategories = Array.from(allCategories).filter(cat => cat && cat !== 'other');
        
        // Add 'other' only if there are events with 'other' category
        if (allCategories.has('other')) {
            availableCategories.push('other');
        }

        // Sort categories for consistent display
        availableCategories.sort();

        // Get the select element
        const categoryFilter = document.getElementById('categoryFilter');
        const currentValue = categoryFilter.value; // Preserve current selection
        
        // Clear existing options except "All Categories"
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        
        // Add options for categories that actually have events
        availableCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            
            // Count events in this category for display
            const eventCount = this.events.filter(event => 
                event.category === category || 
                (event.categories && event.categories.includes(category))
            ).length;
            
            option.textContent = `${this.formatCategoryName(category)} (${eventCount})`;
            
            // Restore previous selection if it still exists
            if (category === currentValue) {
                option.selected = true;
            }
            
            categoryFilter.appendChild(option);
        });

        console.log('Populated category filter with:', availableCategories);
    }

    // Method to add new events (for future WordPress integration)
    addEvent(eventData) {
        const newEvent = {
            id: this.events.length + 1,
            ...eventData
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
document.addEventListener('DOMContentLoaded', () => {
    eventMap = new EventMap();
});

// Expose methods for WordPress integration
window.EventMapAPI = {
    addEvent: (eventData) => eventMap?.addEvent(eventData),
    getEvents: () => eventMap?.getEvents() || [],
    filterByCategory: (category) => {
        document.getElementById('categoryFilter').value = category;
        eventMap?.filterEvents();
    },
    searchEvents: (query) => {
        document.getElementById('searchInput').value = query;
        eventMap?.filterEvents();
    }
};
