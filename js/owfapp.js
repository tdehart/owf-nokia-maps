if (OWF.Util.isRunningInOWF()) {
    // -----------------------------------
    // Initialize
    // -----------------------------------
    OWF.ready(function() {
        var mapEl = document.getElementById('mapContainer');
        var noMapEl = document.getElementById('noMap');

        // -----------------------------------
        // Retrieve Nokia developer's key. If found, set up the OWF APIs otherwise load key input form
        // -----------------------------------
        OWF.Preferences.getUserPreference({
            namespace: 'nokiaMaps',
            name: 'nokiaKey',
            onSuccess: function(response) {
                if (Map) {
                    if (response.value) {
                        Map.setDeveloperKey(OWF.Util.parseJson(response.value));
                        $(noMapEl).css('display', 'none');
                        $(mapEl).css('display', 'block');
                        Map.initialize(mapEl);
                        setupApis();
                    } else {
                        console.log("Didn't find nokia key preference");
                        $(mapEl).css('display', 'none');
                        $(noMapEl).css('display', 'block');
                        $(noMapEl).load('views/keyForm.html');
                    }
                } else {
                    console.log("Didn't find nokia key preference");
                    $(mapEl).css('display', 'none');
                    $(noMapEl).css('display', 'block');
                    $(noMapEl).load('views/failedToLoad.html');
                }
            }
        });

        //Set up all of the OWF APIs once the Nokia API key is found

        function setupApis() {
            // -----------------------------------
            // Add save behaviour if widget is in OWF
            // -----------------------------------
            Map.save = function() {
                OWF.Preferences.setUserPreference({
                    namespace: OWF.getInstanceId(),
                    name: 'widgetstate',
                    value: OWF.Util.toString(this.state),
                    onSuccess: function() {},
                    onFailure: function() {}
                });
            };

            // -----------------------------------
            // Check for launch data
            // -----------------------------------
            var launchData = OWF.Launcher.getLaunchData();
            if (launchData && launchData.address) {
                Map.placeMarker(launchData);
            }

            // -----------------------------------
            // Retrieve saved map state
            // -----------------------------------
            OWF.Preferences.getUserPreference({
                namespace: OWF.getInstanceId(),
                name: 'widgetstate',
                onSuccess: function(response) {
                    if (response.value) {
                        Map.setState(OWF.Util.parseJson(response.value));
                    }
                }
            });

            // -----------------------------------
            // Subscribe to channel
            // -----------------------------------
            OWF.Eventing.subscribe('org.owfgoss.owf.examples.NokiaMapsExample.plotAddress', function(sender, msg, channel) {
                Map.placeMarker(msg);
            });

            // -----------------------------------
            // Setup receive intents
            // -----------------------------------
            // Registering for plot intent, and place marker when intent is received.
            OWF.Intents.receive({
                action: 'plot',
                dataType: 'application/vnd.owf.sample.address'
            }, function(sender, intent, msg) {
                Map.placeMarker(msg);
            });


            // Registering for navigate intent, and getting directions when intent is received.
            OWF.Intents.receive({
                action: 'navigate',
                dataType: 'application/vnd.owf.sample.addresses'
            }, function(sender, intent, msg) {
                Map.getDirections(msg[0], msg[1]);
            });

            OWF.Intents.receive({
                action: 'plotQuakes',
                dataType: 'application/vnd.owf.sample.quakes'
            }, function(sender, intent, msg) {
                Map.plotEarthquakes(msg);
            });

            // Inserting button that allows the user remove the API Key preference
            OWF.Chrome.insertHeaderButtons({
                pos: 0,
                items: [{
                    xtype: 'button',
                    icon: './themes/common/images/logout.png',
                    itemId: 'delete_key',
                    tooltip: {
                        text: 'Delete Nokia API key preference'
                    },
                    handler: function(sender, data) {
                        var choice = confirm("Clear Nokia API key preference?");
                        if (choice) {
                            OWF.Preferences.deleteUserPreference({
                                namespace: 'nokiaMaps',
                                name: 'nokiaKey',
                                onSuccess: function(response) {
                                    OWF.Chrome.removeHeaderButtons({
                                        items: [{
                                            itemId: 'delete_key'
                                        }]
                                    });
                                    location.reload();
                                }
                            });
                        }
                    }
                }]
            });
        }

        // -----------------------------------
        // Clean up when widget closes
        // -----------------------------------
        var widgetState = Ozone.state.WidgetState.getInstance({
            onStateEventReceived: function(sender, msg) {
                var event = msg.eventName;
                if (event === 'beforeclose') {
                    widgetState.removeStateEventOverrides({
                        event: [event],
                        callback: function() {
                            OWF.Preferences.deleteUserPreference({
                                namespace: OWF.getInstanceId(),
                                name: 'widgetstate',
                                onSuccess: function(response) {
                                    widgetState.closeWidget();
                                }
                            });
                        }
                    });
                }
            }
        });

        // override beforeclose event so that we can clean up
        // widget state data
        widgetState.addStateEventOverrides({
            events: ['beforeclose']
        });

        OWF.notifyWidgetReady();
    });
}