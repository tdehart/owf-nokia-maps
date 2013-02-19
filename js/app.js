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
    routeSet: null,
    resultSet: null,
    state: {
        addresses: null,
        markers: null,
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
        this.routeSet = [];
        this.state.addresses = [];
        this.state.markers = [];
        this.state.center = {};
        this.infoBubbles = new nokia.maps.map.component.InfoBubbles();
        this.defaults.components.push(this.infoBubbles);
        this.map = new nokia.maps.map.Display(mapContainer, this.defaults);
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

    setState: function (state) {
        console.log("in set state");
        this.clear();
        if (state.center) {
            this.map.setCenter(state.center);
            this.map.set("zoomLevel", state.zoomLevel);
        }

        // if(state.addresses && state.addresses.length > 0) {
        //     Map.getDirections(state.addresses[0], state.addresses[1]);
        // }
        // else if(state.markers) {
        //     for (var i = 0, len = state.markers.length; i < len; i++) {
        //         Map.placeMarker(state.markers[i]);
        //     }
        // }
    },

    processResults: function(data, requestStatus, requestId) {
        var i, len, locations, marker;
        var me = this.Map;
        if (requestStatus == "OK") {
            // The function findPlaces() and reverseGeoCode() return results in slightly different formats
            locations = data.results ? data.results.items : [data.location];
            if (me.resultSet) me.map.objects.remove(me.resultSet);
            me.resultSet = new nokia.maps.map.Container();
            if (locations.length > 0) {
                for (i = 0, len = locations.length; i < len; i++) {
                    marker = new nokia.maps.map.StandardMarker(locations[i].position, { text: i+1 });
                    me.resultSet.objects.add(marker);
                }
                // Next we add the marker(s) to the map's object collection so they will be rendered onto the map
                me.map.objects.add(me.resultSet);
                
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
        var address = obj.address;
        this.searchManager.geoCode({
            searchTerm: address,
            onComplete: this.processResults
        });
    },

    addInfoBubble: function(marker, obj) {
        var me = this;
        marker.addListener(
        me.CLICK, function(evt) {
            // Set the tail of the bubble to the coordinate of the marker
            var label = "<h2>" + obj.name + "</h2>" + "<p>" + obj.address + "<br />" + obj.phone + "</p>";
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
        me.clear();
        var mode = [{
            type: "shortest",
            transportModes: ["car"],
            options: "avoidTollroad",
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
        if(value == "finished") {
            var routes = observedRouter.getRoutes();

            //create the default map representation of a route
            var mapRoute = new nokia.maps.routing.component.RouteResultSet(routes[0]).container;
            
            this.Map.map.objects.add(mapRoute);
            Map.routeSet.push(mapRoute);

            //Zoom to the bounding box of the route
            Map.map.zoomTo(mapRoute.getBoundingBox(), false, "default");

        } else if(value == "failed") {
            console.log("The routing request failed.");
        }
    },

    clear: function() {
        this.clearMarkers();
        this.clearDirections();
    },

    clearMarkers: function() {
        if(this.resultSet) {
            console.log("attempting to clear", this.resultSet.objects);
            this.map.objects.remove(this.resultSet);
        }
        return this;
    },

    clearDirections: function() {
        for(var i = 0; i < this.routeSet.length; i++) {
            this.map.objects.remove(this.routeSet[i]);
        }
        return this;
    },

    save: function() {}
};

$(document).ready(function() {
    // Initialize map
    Map.initialize(document.getElementById('mapContainer'));
});