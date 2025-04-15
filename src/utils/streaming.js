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

	janus.attach({
		plugin: "janus.plugin.streaming",
		opaqueId: opaqueId,
		success: function(pluginHandle) {
			streaming = pluginHandle;
			Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");

			var body = { "request": "list" };
			Janus.debug("Sending message (" + JSON.stringify(body) + ")");
			streaming.send({
				"message": body,
				success: function(result) {
					if(result["list"] !== undefined && result["list"] !== null) {
						var list = result["list"];
						Janus.log("Got a list of available streams");
						Janus.log(list);
						for(var mp in list) {
							Janus.log("  >> [" + list[mp]["id"] + "] " + list[mp]["description"] + " (" + list[mp]["type"] + ")");
						}
						callback(streaming, "list", list);
					}
				}
			});
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
					var substream = result["substream"];
					var temporal = result["temporal"];
					if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
						callback(streaming, "simulcastStarted");
					}
					var spatial = result["spatial_layer"];
					temporal = result["temporal_layer"];
					if((spatial !== null && spatial !== undefined) || (temporal !== null && temporal !== undefined)) {
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
				streaming.createAnswer({
					jsep: jsep,
					media: { audioSend: false, videoSend: false, replaceVideo: true },
					simulcast: false,
					simulcast2: false,
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
		iceState: function () {
			let state = streaming.webrtcStuff.pc.iceConnectionState;
			console.log("ICE connection state changed to", state);
			if (state === "disconnected" || state === "failed") {
				console.warn("ICE disconnected or failed — triggering ICE restart...");
				triggerIceRestart();
			}
		},
		webrtcState: function (isConnected) {
			console.log("WebRTC state changed:", isConnected);
			if (isConnected) {
				startIceMonitor();
			} else {
				stopIceMonitor();
			}
		}
	});

	// ✅ ICE Restart Logic
	function triggerIceRestart() {
		if (!streaming) {
			console.warn("Streaming plugin not ready for ICE restart.");
			return;
		}
		streaming.send({
			"message": {
				request: "watch", id: 1, refresh: true
			}
		});
	}

	// ✅ ICE Polling Monitor
	let iceMonitorInterval;

	function startIceMonitor() {
		if (iceMonitorInterval) return;
		iceMonitorInterval = setInterval(() => {
			if (!streaming || !streaming.webrtcStuff || !streaming.webrtcStuff.pc) return;
			let state = streaming.webrtcStuff.pc.iceConnectionState;
			console.log("Polling ICE connection state:", state);
			if (state === "disconnected" || state === "failed") {
				console.warn("Detected ICE failure via polling, triggering restart...");
				triggerIceRestart();
			}
		}, 5000);
	}

	function stopIceMonitor() {
		clearInterval(iceMonitorInterval);
		iceMonitorInterval = null;
	}

	return streaming;
}
