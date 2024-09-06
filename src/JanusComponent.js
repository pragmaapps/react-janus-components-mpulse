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

    const handleConnection = () =>{
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
    }


    return (
        <div className="janus-container" ref={janusEl}>
            {children && (
                React.cloneElement(children, { janus: janusInstance, createConnection: handleConnection })
            )}
        </div>
    );
}

export default JanusComponent;