import React, { useRef, useState, useEffect } from 'react';
import Janus from './utils/janus';

const JanusComponent = ({ children, server, isTurnServerEnabled, daqIP }) => {
    const janusEl = useRef(null);
    const [janusInstance, setJanusInstance] = useState(null);

    useEffect(() => {
        handleConnection();

        return () => {
            if (janusInstance) {
                janusInstance.destroy();
            }
            setJanusInstance(null);
        };
    }, []);

    const handleConnection = () => {
        Janus.init({
            debug: "all",
            callback: function () {
                if (!Janus.isWebrtcSupported()) {
                    console.log("No WebRTC support...");
                    return;
                }

                let iceServers = [];
                let turnServerStatus = isTurnServerEnabled;

                if (turnServerStatus) {
                    console.log("Using TURN server at:", `turn:${daqIP}:3478`);
                    iceServers.push({
                        urls: `turn:${daqIP}:3478`,
                        username: "janususer",
                        credential: "januspwd"
                    });
                } else {
                    console.log("No TURN server; using stun");
                    iceServers.push({ urls: "stun:stun.l.google.com:19302" });
                }

                let connectionIP = window.location.hostname;
                console.log("Establishing Janus connection using IP:", connectionIP);

                // Check if the connection is being made on localhost
                let iceTransportPolicy = turnServerStatus ? "relay" : "all"; // Default policy
                if (connectionIP === '127.0.0.1' || connectionIP === 'localhost') {
                    console.log("Running on localhost; skipping remote connection.");
                    iceServers = []; // Clear iceServers to prevent remote connections
                    iceTransportPolicy = "none"; // Disable ICE candidate gathering
                }

                const janus = new Janus({
                    server: `http://${connectionIP}:8088/janus`,
                    iceServers: iceServers,
                    iceTransportPolicy: iceTransportPolicy,

                    success: function () {
                        console.log("Janus loaded successfully on", connectionIP);
                        setJanusInstance(janus);
                    },
                    error: function (error) {
                        console.error("Janus connection error:", error);
                        setJanusInstance(null);
                    },
                    destroyed: function () {
                        console.log("Janus connection destroyed.");
                        setJanusInstance(null);
                    }
                });
            }
        });
    };
    
    return (
        <div className="janus-container" ref={janusEl}>
            {children && React.cloneElement(children, { janus: janusInstance, createConnection: handleConnection })}
        </div>
    );
};

export default JanusComponent;
