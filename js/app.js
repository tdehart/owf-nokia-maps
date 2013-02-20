/**
 * Defines methods and data to initialize a Nokia Map in the HTML DOM.
 *
 * NOTE: Certain functions should match the same interface as those defined
 * by Nish in the Google Maps example widget for OWF.
 *
 * @author T. DeHart
 */
var Map = {
    defaults: {
        center: [39.209, -76.867],
        zoomLevel: 10,
        components: [
        // ZoomBar provides a UI to zoom the map in & out
        new nokia.maps.map.component.ZoomBar(),
        // We add the behavior component to allow panning / zooming of the map
        new nokia.maps.map.component.Behavior(),
        // Creates UI to easily switch between street map satellite and terrain mapview modes
        new nokia.maps.map.component.Overview()
        // Allows us to create InfoBubbles attached to markers
        ]
    },

    /**
     * HTML DOM element that the map container is bound to.
     */
    el: null,

    /**
     * Actual Nokia map instance.
     * @type nokia.maps.map.Display
     */
    map: null,
    searchManager: null,
    routerManger: null,
    results: null,
    state: {
        route: null,
        marker: null,
        center: null,
        zoomLevel: null
    },
    infoBubbles: null,
    TOUCH: null,
    CLICK: null,


    /**
     * Initialize a Nokia Map on the given DOM element.
     * @param Object that corresponds to a DIV in the HTML DOM.
     * @constructor
     */
    initialize: function(mapContainer) {
        var me = this;
        nokia.Settings.set("appId", KeyStore.appId);
        nokia.Settings.set("authenticationToken", KeyStore.token);
        this.el = mapContainer;
        this.infoBubbles = new nokia.maps.map.component.InfoBubbles();
        this.defaults.components.push(this.infoBubbles);
        this.map = new nokia.maps.map.Display(mapContainer, this.defaults);
        this.results = [];
        this.searchManager = nokia.places.search.manager;
        this.routerManager = new nokia.maps.routing.Manager();
        this.routerManager.addObserver("state", this.onRouteCalculated);
        this.TOUCH = nokia.maps.dom.Page.browser.touch, this.CLICK = this.TOUCH ? "tap" : "click";

        //Triggered when the map's view changes
        this.map.addListener("mapviewchangeend", function(evt) {
            me.state.center = evt.display.center;
            me.state.center.altitude = 0;
            me.state.zoomLevel = me.map.zoomLevel;

            me.save();
        });
    },

    setState: function(state) {
        this.clear();
        if(state.center) {
            this.map.setCenter(state.center);
            this.map.set("zoomLevel", state.zoomLevel);
        }

        if(state.marker) this.placeMarker(state.marker);
        if(state.route) this.getDirections(state.route[0], state.route[1]);
    },

    processResults: function(data, requestStatus, requestId, contact) {
        var i, len, locations, marker;
        var me = this;
        if(requestStatus == "OK") {
            // The function findPlaces() and reverseGeoCode() return results in slightly different formats
            locations = data.results ? data.results.items : [data.location];
            me.resultSet = new nokia.maps.map.Container();
            if(locations.length > 0) {
                for(i = 0, len = locations.length; i < len; i++) {
                    marker = new nokia.maps.map.StandardMarker(locations[i].position, {
                        text: i+1
                    });
                    me.addInfoBubble(marker, contact);
                    me.resultSet.objects.add(marker);
                    me.state.marker = contact;
                }
                // Next we add the marker(s) to the map's object collection so they will be rendered onto the map
                me.map.objects.add(me.resultSet);
                me.results.push(me.resultSet);

                // We zoom the map to a view that encapsulates all the markers into map's viewport
                me.map.zoomTo(me.resultSet.getBoundingBox(), false);
                me.map.set('zoomLevel', 10);

            } else {
                console.log("Location not found");
            }
        } else {
            console.log("Search request failed");
        }
    },

    placeMarker: function(obj) {
        var me = this;
        var contact = obj;
        var address = obj.address;
        me.clear();
        this.searchManager.geoCode({
            searchTerm: address,
            onComplete: function(data, requestStatus, requestId, obj) {
                me.processResults(data, requestStatus, requestId, contact);
            }
        });
    },

    addInfoBubble: function(marker, obj) {
        var me = this;
        marker.addListener(
        me.CLICK, function(evt) {
            // Set the tail of the bubble to the coordinate of the marker
            var label = "<h2>" + obj.name + "</h2>" + "<p>" + obj.address + "<br />" + obj.phoneNumber + "</p>";
            me.infoBubbles.openBubble(label, marker.coordinate);
        });
    },

    /**
     * Get directions from one location to another. The results will be
     * drawn as a route on the map.
     * @public
     * @param {String} start Free form address or place name where route
     * will start.
     * @param {String} end Free form address or place name where route will
     * end.
     */
    getDirections: function(start, end) {
        var me = this;
        var mode = [{
            type: "shortest",
            transportModes: ["car"],
            options: "",
            trafficMode: "default"
        }];
        var waypoints = new nokia.maps.routing.WaypointParameterList();
        var addresses = [start, end];
        var requests = addresses.length;

        for(var i = 0; i < addresses.length; i++) {
            this.searchManager.geoCode({
                searchTerm: addresses[i],
                onComplete: function(response, requestStatus) {
                    if(requestStatus == "OK") {
                        var coordinate = new nokia.maps.geo.Coordinate(response.location.position.latitude, response.location.position.longitude);
                        waypoints.addCoordinate(coordinate);
                    } else {
                        console.log("Geocode was not successful for the following reason: " + requestStatus);
                    }
                    requests--;
                    if(requests === 0) {
                        //Calculate the route after we've gone through all requests, this will trigger a state listener
                        me.clear();
                        me.state.route = addresses;
                        me.routerManager.calculateRoute(waypoints, mode.slice(0));
                    }
                }
            });
        }
    },

    /**
     * Draws a completed route segment on the map. Must only be called when
     * the state changes on a routing manager.
     * @private
     * @param {nokia.maps.routing.Manager} observedRouter The router on
     * which the state has changed.
     * @param {String} key The name of the property that was modified.
     * @param {Variant} value The new value that the property is set to.
     * @see nokia.maps.util.OObject#addObserver
     */
    onRouteCalculated: function(observedRouter, key, value) {
        var me = this.Map;
        if(value == "finished") {
            var routes = observedRouter.getRoutes();

            //if(me.mapRoute) me.map.objects.remove(me.mapRoute);

            //create the default map representation of a route
            me.mapRoute = new nokia.maps.routing.component.RouteResultSet(routes[0]).container;
            me.map.objects.add(me.mapRoute);

            //Zoom to the bounding box of the route
            me.map.zoomTo(me.mapRoute.getBoundingBox(), false, "default");

        } else if(value == "failed") {
            console.log("The routing request failed.");
        }
    },

    clear: function() {
        this.clearMarkers();
        this.clearDirections();
    },

    clearMarkers: function() {
        for(var i = 0; i < this.results.length; i++) {
            this.map.objects.remove(this.results[i]);
        }

        this.state.marker = null;
        return this;
    },

    clearDirections: function() {
        if(this.mapRoute) {
            this.map.objects.remove(this.mapRoute);
            this.state.route = null;
        }
        return this;
    },

    save: function() { }
};

$(document).ready(function() {
    // Initialize map
    Map.initialize(document.getElementById('mapContainer'));
});