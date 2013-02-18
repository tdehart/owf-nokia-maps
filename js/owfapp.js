if(OWF.Util.isRunningInOWF()) {

    // -----------------------------------
    // Add behaviour if widget is in OWF
    // -----------------------------------
    Map.save = function() {
        OWF.Preferences.setUserPreference({
            namespace: OWF.getInstanceId(),
            name: 'widgetstate',
            value: OWF.Util.toString(this.state),
            onSuccess: function() { },
            onFailure: function() { }
        });
    };

    // -----------------------------------
    // Initialize
    // -----------------------------------
    OWF.ready(function() {
        // -----------------------------------
        // Check for launch data
        // -----------------------------------
        var launchData = OWF.Launcher.getLaunchData();
        if(launchData && launchData.address) {
            Map.placeMarker(launchData);
        }

        // -----------------------------------
        // Retrive saved state
        // -----------------------------------
        OWF.Preferences.getUserPreference({
            namespace: OWF.getInstanceId(),
            name: 'widgetstate',
            onSuccess: function(response) {
                if(response.value) {
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


        // -----------------------------------
        // Clean up when widget closes
        // -----------------------------------
        var widgetState = Ozone.state.WidgetState.getInstance({
            onStateEventReceived: function(sender, msg) {
                var event = msg.eventName;
                if(event === 'beforeclose') {
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