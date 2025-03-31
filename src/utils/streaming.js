import Janus from './janus';

export function startStream(streaming, selectedStream) {
    Janus.log("Selected video id #" + selectedStream);
    if (!selectedStream) return;
    let body = { "request": "watch", id: parseInt(selectedStream) };
    streaming.send({ "message": body });
}

export function subscribeStreaming(janus, opaqueId, callback) {
    let streaming = null;

    janus.attach({
        plugin: "janus.plugin.streaming",
        opaqueId: opaqueId,
        success: function (pluginHandle) {
            streaming = pluginHandle;
            Janus.log("Plugin attached! (" + streaming.getPlugin() + ", id=" + streaming.getId() + ")");
            
            let body = { "request": "list" };
            Janus.debug("Sending message (" + JSON.stringify(body) + ")");
            streaming.send({ "message": body, success: function (result) {
                if (result.list) {
                    Janus.log("Got a list of available streams", result.list);
                    callback(streaming, "list", result.list);
                }
            }});
        },
        error: function (error) {
            Janus.error("Error attaching plugin:", error);
            callback(streaming, "error", error);
        },
        onmessage: function (msg, jsep) {
            Janus.debug("Got a message:", msg);
            let result = msg.result;
            
            if (result) {
                if (result.status) {
                    if (result.status === 'starting') callback(streaming, "starting");
                    else if (result.status === 'started') callback(streaming, "started");
                    else if (result.status === 'stopped') reconnectStream(streaming);
                }
            } else if (msg.error) {
                reconnectStream(streaming);
                return;
            }
            
            if (jsep) {
                Janus.debug("Handling SDP", jsep);
                streaming.createAnswer({
                    jsep: jsep,
                    media: { audioSend: false, videoSend: false },
                    success: function (jsep) {
                        Janus.debug("Got SDP!", jsep);
                        let body = { "request": "start" };
                        streaming.send({ "message": body, "jsep": jsep });
                    },
                    error: function (error) {
                        Janus.error("WebRTC error:", error);
                    }
                });
            }
        },
        onremotestream: function (stream) {
            callback(streaming, "onremotestream", stream);
        },
        oncleanup: function () {
            callback(streaming, "oncleanup");
        },
        onlocalstream: function (stream) {
            // The subscriber stream is recvonly, nothing is expected here
        },
		iceState: function () {
            let state = streaming.webrtcStuff.pc.iceConnectionState;
            Janus.log("ICE connection state changed to from icestate method", state);
            if (state === "disconnected" || state === "failed") {
                Janus.warn("ICE connection lost, attempting to reconnect...");
                reconnectStream(streaming);
            }
        },
    });
    return streaming;
}

function reconnectStream(streaming) {
    Janus.log("Reconnecting stream...");
    streaming.createOffer({
		media:{audioRecv:false, videoRecv:true, audioSend:false, videoSend: false},
		iceRestart:true,
		success:function(jsep) {
			streaming.send({"message": {request: "watch", id: 1}, "jsep": jsep});
		}
	});
}
