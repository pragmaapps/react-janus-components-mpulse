import React, { useRef, useState, useEffect } from 'react';
import Janus from './utils/janus';

const JanusComponent = ({ children, server, isTurnServerEnabled, daqIP }) => {
    const janusEl = useRef(null);
    const [janusInstance, setJanusInstance] = useState(null);

    useEffect(() => {
        // let unmounted = false;
        handleConnection();


        return () => {
            // unmounted = true;
            setJanusInstance(null);
        };
    }, [])

    /*const handleConnection = () =>{
        Janus.init({
            debug: "all", callback: function () {
                if (!Janus.isWebrtcSupported()) {
                    console.log("No WebRTC support... ");
                    return;
                }

                let turnServer = {};
                let turnServerStatus = isTurnServerEnabled;
                if (turnServerStatus) {
                    console.log("inside session turn server");
                    console.log("turn:" + daqIP + ":3478", 'url');
                    turnServer.iceServers = [{ url: "turn:" + daqIP + ":3478", username: "janususer", credential: "januspwd" }];
                    turnServer.iceTransportPolicy = 'relay';
                }

                const janus = new Janus({
                    ...{
                        server: server,

                        // No "iceServers" is provided, meaning janus.js will use a default STUN server
                        // Here are some examples of how an iceServers field may look like to support TURN
                        // 		iceServers: [{urls: "turn:yourturnserver.com:3478", username: "janususer", credential: "januspwd"}],
                        // 		iceServers: [{urls: "turn:yourturnserver.com:443?transport=tcp", username: "janususer", credential: "januspwd"}],
                        // 		iceServers: [{urls: "turns:yourturnserver.com:443?transport=tcp", username: "janususer", credential: "januspwd"}],
                        // Should the Janus API require authentication, you can specify either the API secret or user token here too
                        //		token: "mytoken",
                        //	or
                        //		apisecret: "serversecret",
                        success: function () {
                            // Attach to echo test plugin
                            console.log("Janus loaded");
                            // if (!unmounted) {
                                setJanusInstance(janus);
                            // }
                        },
                        error: function (error) {
                            Janus.error(error);
                            setJanusInstance(null);
                        },
                        destroyed: function () {
                            setJanusInstance(null);
                        }
                    }, ...turnServer
                });
            }
        });
    }*/
    const handleConnection = () => {
        Janus.init({
            debug: "all",
            callback: function () {
                if (!Janus.isWebrtcSupported()) {
                    console.log("No WebRTC support... ");
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
                    console.log("No TURN server; using default STUN");
                    iceServers.push({ urls: "stun:stun.l.google.com:19302" });
                }

                // Determine whether to bind to localhost or an external IP
                let connectionIP = window.location.hostname;
                console.log("Establishing Janus connection using IP:", connectionIP);

                const janus = new Janus({
                    server: `http://${connectionIP}:8088/janus`, // Ensure correct Janus server URL
                    iceServers: iceServers, // Dynamic ICE configuration
                    iceTransportPolicy: turnServerStatus ? "relay" : "all", // Use relay only if TURN is enabled

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

                // **Filter ICE Candidates** to avoid failures when Ethernet is removed
                janus.onicecandidate = (event) => {
                    if (event.candidate) {
                        let candidate = event.candidate.candidate;
                        if (candidate.includes(connectionIP) || candidate.includes("127.0.0.1") || candidate.includes("localhost")) {
                            console.log("Accepting ICE candidate:", candidate);
                            return event.candidate;
                        } else {
                            console.log("Ignoring external ICE candidate:", candidate);
                            return null;
                        }
                    }
                };
            }
        });
    };        


    return (
        <div className="janus-container" ref={janusEl}>
            {children && (
                React.cloneElement(children, { janus: janusInstance, createConnection: handleConnection })
            )}
        </div>
    );
}

export default JanusComponent;