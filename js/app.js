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
        new nokia.maps.map.component.Overview(),
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
    resultSet: null,
    infoBubbles: null,
    TOUCH: null,
    CLICK: null,

    /**
     * Initialize a Nokia Map on the given DOM element.
     * @param Object that corresponds to a DIV in the HTML DOM.
     * @constructor
     */
    initialize: function(mapContainer) {
        nokia.Settings.set("appId", KeyStore.appId);
        nokia.Settings.set("authenticationToken", KeyStore.token);
        this.el = mapContainer;
        this.infoBubbles = new nokia.maps.map.component.InfoBubbles();
        this.defaults.components.push(this.infoBubbles);
        this.map = new nokia.maps.map.Display(mapContainer, this.defaults);
        this.searchManager = nokia.places.search.manager;
        this.routerManager = new nokia.maps.routing.Manager();
        this.routerManager.addObserver("state", this.onRouteCalculated);
        this.TOUCH = nokia.maps.dom.Page.browser.touch,
        this.CLICK = this.TOUCH ? "tap" : "click";        

        // Testing map capabilities...

        var searchTerm = {
            "name" : "John Doe",
            "phone" : "555-555-5555",
            "address" : "columbia md"
        };

        var searchTerm2 = {
            "name" : "Bob Smith",
            "phone" : "800-255-1952",
            "address" : "washington dc"
        };

        var searchTerm3 = {
            "name" : "Mary Johnson",
            "phone" : "566-255-1952",
            "address" : "philadelphia pa"
        };

        this.placeMarker(searchTerm3);

        this.getDirections(searchTerm.address, searchTerm2.address);
    },

    /**
     * Geocode a given free form address.
     * @param {String} address Free form address or place name.
     * @returns {jQuery.Deferred} Promise with result data.
     */
    codeAddress: function(address) {
        var deferred = jQuery.Deferred();

        this.searchManager.geoCode({
            searchTerm: address, 
            onComplete: function(response, status) {
                if (status == "OK") {
                    deferred.resolve(response);
                }
                else {  
                    console.log("Geocode was not successful for the following reason: " + status);
                }
            }
        });

        return deferred.promise();  
    },

    /**
     * Place a marker on the map.
     * @public
     * @param {Object} obj Object that has an address property to indicate
     * where the marker should be placed.
     */
    placeMarker: function(obj) {
        var me = this;

        // Grab address from obj
        var address = obj.address;
        
        // Remove previous resultSet
        if (this.resultSet) this.map.objects.remove(this.resultSet);
        // Set widget's resultSet instance variable
        this.codeAddress(address).then(function(response) {
            // The function findPlaces() and reverseGeoCode() return results in slightly different formats
            var locations = response.results ? response.results.items : [response.location];

            me.resultSet = new nokia.maps.map.Container();
            for (i = 0, len = locations.length; i < len; i++) {
                var marker = new nokia.maps.map.StandardMarker(locations[i].position, {
                    text: i+1
                });

                // Attach InfoBubble to marker
                me.addInfoBubble(marker, obj);
                // Add marker to resultSet
                me.resultSet.objects.add(marker);
            }

            // Place the marker and zoom to it
            me.map.objects.add(me.resultSet);
            me.map.zoomTo(me.resultSet.getBoundingBox(), false);
            me.map.set("zoomLevel", 10);
                
        });
    },

    addInfoBubble: function(marker, obj) {
        var me = this;
        marker.addListener(
            me.CLICK,
            function (evt) {
                // Set the tail of the bubble to the coordinate of the marker
                var label = "<h2>" + obj.name + "</h2>" + "<p>"
                + obj.address + "<br />" + obj.phone + "</p>"
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
            options: "avoidTollroad",
            trafficMode: "default"
        }];
        var waypoints = new nokia.maps.routing.WaypointParameterList();
        var addresses = [start, end];
        var requests = addresses.length;

        // Loop through the addresses and add each one to waypoints list
        for (var i = 0; i < addresses.length; i++) {
            this.searchManager.geoCode({
                searchTerm: addresses[i],
                onComplete: function (response, requestStatus) {
                    if (requestStatus == "OK") {
                        waypoints.addCoordinate(new nokia.maps.geo.Coordinate(response.location.position.latitude, response.location.position.longitude));
                    }
                    requests--;
                    if (requests == 0) {
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
        if (value == "finished") {
            var routes = observedRouter.getRoutes();

            //create the default map representation of a route
            var mapRoute = new nokia.maps.routing.component.RouteResultSet(routes[0]).container;
            Map.map.objects.add(mapRoute);

            //Zoom to the bounding box of the route
            Map.map.zoomTo(mapRoute.getBoundingBox(), false, "default");
        } else if (value == "failed") {
            console.log("The routing request failed.");
        }
    }
};

$(document).ready(function() {

    // Initialize map
    Map.initialize( document.getElementById('mapContainer') );
});
