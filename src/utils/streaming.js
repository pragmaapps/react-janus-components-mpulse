import Janus from './janus';

export function startStream(streaming, selectedStream) {
	Janus.log("Selected video id #" + selectedStream);
	if(selectedStream === undefined || selectedStream === null) {
		return;
	}
	var body = { "request": "watch", id: parseInt(selectedStream) };
	streaming.send({"message": body});
	// No remote video yet
}

export function subscribeStreaming(janus, opaqueId, callback) {
    let streaming = null;

    janus.attach(
		{
			plugin: "janus.plugin.streaming",
			opaqueId: opaqueId,
			success: function(pluginHandle) {
				streaming = pluginHandle;
				Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");
				// Setup streaming session
				// $('#update-streams').click(updateStreamsList);

				var body = { "request": "list" };
				Janus.debug("Sending message (" + JSON.stringify(body) + ")");
				streaming.send({"message": body, success: function(result) {
					if(result["list"] !== undefined && result["list"] !== null) {
						var list = result["list"];
						Janus.log("Got a list of available streams");
						Janus.log(list);
						for(var mp in list) {
							Janus.log("  >> [" + list[mp]["id"] + "] " + list[mp]["description"] + " (" + list[mp]["type"] + ")");
						}
						callback(streaming, "list", list);
					}
				}});
			},
			error: function(error) {
                Janus.error("  -- Error attaching plugin...", error);
                callback(streaming, "error", error);
			},		
			onmessage: function(msg, jsep) {
				Janus.debug(" ::: Got a message :::");
				Janus.debug(msg);
				var result = msg["result"];
				if(result !== null && result !== undefined) {
					if(result["status"] !== undefined && result["status"] !== null) {
						var status = result["status"];
						if(status === 'starting')
							callback(streaming, "starting");
						else if(status === 'started')
							callback(streaming, "started");
						else if(status === 'stopped') {
							var body = { "request": "stop" };
							streaming.send({"message": body});
							streaming.hangup();							
						}
					} else if(msg["streaming"] === "event") {
						// Is simulcast in place?
						var substream = result["substream"];
						var temporal = result["temporal"];
						if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
							// We just received notice that there's been a switch, update the buttons
							callback(streaming, "simulcastStarted");
						}
						// Is VP9/SVC in place?
						var spatial = result["spatial_layer"];
						temporal = result["temporal_layer"];
						if((spatial !== null && spatial !== undefined) || (temporal !== null && temporal !== undefined)) {
							// We just received notice that there's been a switch, update the buttons
							callback(streaming, "svcStarted");
						}
					}
				} else if(msg["error"] !== undefined && msg["error"] !== null) {
					var body = { "request": "stop" };
					streaming.send({"message": body});
					streaming.hangup();							
					return;
				}
				if(jsep !== undefined && jsep !== null) {
					Janus.debug("Handling SDP as well...");
					Janus.debug(jsep);
					// Offer from the plugin, let's answer
					streaming.createAnswer(
						{
							jsep: jsep,
							media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
							success: function(jsep) {
								Janus.debug("Got SDP!");
								Janus.debug(jsep);
								var body = { "request": "start" };
								streaming.send({"message": body, "jsep": jsep});
							},
							error: function(error) {
								Janus.error("WebRTC error:", error);
							}
						});
				}
			},
			onremotestream: function(stream) {
                callback(streaming, "onremotestream", stream);
			},
			oncleanup: function() {
				callback(streaming, "oncleanup");				
			},
			onlocalstream: function(stream) {
				// The subscriber stream is recvonly, we don't expect anything here
			},
        });
    return streaming;
}