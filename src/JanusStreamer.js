import React, { useRef, useState, useEffect } from 'react';
import $ from 'jquery';
import Janus from './utils/janus';
import { subscribeStreaming, startStream } from './utils/streaming';
import JanusStreamPlayer from './JanusStreamPlayer';
import { Video } from 'video-react';

const JanusStreamer = React.forwardRef((
    {
        janus, opaqueId, streamId, enableCustomControl, customVideoControls, overlayImage, cropperActive, setRecordedPlaybleFile, showFramesRate,playPauseButton, streamIsLive
    }, ref) => {
    const videoArea = ref;
    const [playerState, setPlayerState] = useState("Ready");
    const [streaming, setStreaming] = useState(null);
    const [list, setList] = useState(null);
    const [janusBitrate, setJanusBitrate] = useState(null);

    let mystream = null;

    useEffect(() => {
        let unmounted = false;
        if (!janus && !unmounted) {
            return;
        }

        if (!unmounted) {
            subscribeStreaming(janus, opaqueId, streamingCallback);
        }
        return () => {
            unmounted = true;
        };
    }, [janus])


    const handleErrorVideo = (e) => {
        setRecordedPlaybleFile();
    }

    const handlePlayEvent = (e) => {
        console.log("[JanusStreamer] Live Stream Playing", e);
        videoArea.current !== null && videoArea.current.video.video.play();
        streamIsLive(true);
    }
    const streamingCallback = (_streaming, eventType, data) => {
        setStreaming(_streaming);
        if (eventType === "onremotestream" && videoArea.current !== null) {
            mystream = data;

            console.log("[Attaching stream to the video element:]", videoArea);
            const videoPlayer = videoArea.current.video.video
            Janus.attachMediaStream(videoPlayer, mystream);
            videoPlayer.addEventListener('error', handleErrorVideo);
            videoPlayer.addEventListener('play', handlePlayEvent);
            if (_streaming.webrtcStuff.pc.iceConnectionState !== "completed" &&
                _streaming.webrtcStuff.pc.iceConnectionState !== "connected") {
                setPlayerState("Live");
            }
            var videoTracks = mystream.getVideoTracks();
            if (videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                setPlayerState("Error");
            }
            console.log("[Attached video stream bitrate :]", _streaming.getBitrate());
            setJanusBitrate(_streaming.getBitrate())
        } else if (eventType === "oncleanup") {
            setPlayerState("Paused");
        } else if (eventType === "error") {
            setPlayerState("Error");
        } else if (eventType === "list") {
            setList(data);
            startStream(_streaming, streamId);
        } else if(eventType == "icerestart"){
            _streaming.hangup();
            setTimeout(() => {
                subscribeStreaming(janus, opaqueId, streamingCallback);
              }, 2000);
        }

    }
    const bitrates = streaming && streaming.webrtcStuff && streaming.webrtcStuff.bitrate ? streaming.webrtcStuff.bitrate.value :  janusBitrate;
    return (
        <div>
            <JanusStreamPlayer
                ref={videoArea}
                isPublisher={false}
                status={playerState}
                customVideoControls={customVideoControls}
                enableCustomControl={enableCustomControl}
                overlayImage={overlayImage}
                bitrate={bitrates}
                cropperActive={cropperActive}
                showFramesRate={showFramesRate}
                playPauseButton={playPauseButton}
            />
        </div>
    )
});

export default JanusStreamer;