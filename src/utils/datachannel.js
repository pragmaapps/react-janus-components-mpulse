import Janus from './janus';
export function subscribeDatachannel(janus, opaqueId,logToBackend, callback) {
    let datachannel = null;
    let selectedDataChannel = 15;
    janus.attach(
        {
            plugin: "janus.plugin.streaming",
            opaqueId: opaqueId,
            success: function(pluginHandle) {
                datachannel = pluginHandle;
                console.log("Data channel Plugin attached! (" + datachannel.getPlugin() + ", id=" + datachannel.getId() + ")");
                var body = { "request": "watch", id: parseInt(selectedDataChannel)};
                datachannel.send({"message": body});
            },
            error: function(error) {
                Janus.error("  -- Error attaching plugin...", error);
                callback(datachannel, "error", error);
            },      
            onmessage: function(msg, jsep) {
                Janus.debug(" ::: Got a message on data channel :::");
                Janus.debug(msg);
                if(jsep !== undefined && jsep !== null) {
                    Janus.debug("Handling data channel SDP as well...");
                    Janus.debug(jsep);
                    // Offer from the plugin, let's answer
                    datachannel.createAnswer(
                        {
                            jsep: jsep,
                            media: { audio: false, video:false, data:true }, // We want data only
                            success: function(jsep) {
                                Janus.debug("Got SDP!");
                                Janus.debug(jsep);
                                var body = { "request": "start" };
                                datachannel.send({"message": body, "jsep": jsep});
                            },                          
                            error: function(error) {
                                Janus.error("WebRTC error:", error);
                            }
                        });
                }
            },
            ondataopen: function(datachannel) {
                console.log("The DataChannel is available!");
                callback(datachannel, "ondataopen", datachannel);
            },
            ondata: function(datachannel) {
                const timestamp = Date.now(); // Unix Epoch timestamp in milliseconds
                console.log("[DataChannel Utils] We got data from the DataChannel!", datachannel);
                logToBackend(`[${timestamp}]:  We got data from the DataChannel! ${datachannel}`); // send to backend
                //callback(datachannel, "ondata", datachannel);
            },
            oncleanup: function() {
                // The subscriber stream is data only, we don't expect anything here    
            }
        });
    return datachannel;
}