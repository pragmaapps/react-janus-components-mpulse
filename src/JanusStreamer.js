import React, { useRef, useState, useEffect } from 'react';
import $ from 'jquery';
import Janus from './utils/janus';
import { subscribeStreaming, startStream, stopStream } from './utils/streaming';
import JanusStreamPlayer from './JanusStreamPlayer';
import { Video } from 'video-react';

const JanusStreamer = React.forwardRef((
    {
        janus, opaqueId, streamId, enableCustomControl, customVideoControls, overlayImage, cropperActive, setRecordedPlaybleFile, showFramesRate, playPauseButton, streamIsLive, isStreamStart, updateStreamLoading
    }, ref) => {
    const videoArea = ref;
    const [playerState, setPlayerState] = useState("Ready");
    const [streaming, setStreaming] = useState(null);
    const [list, setList] = useState(null);
    const [janusBitrate, setJanusBitrate] = useState(null);
    const [unmounted, setUnmounted] = useState(false);
    const [janusReload, updateJanusReload] = useState(false)

    let mystream = null;

    useEffect(() => {
        if (!janus && !unmounted) {
            return;
        }
        if(!janus && unmounted) {
            updateJanusReload(true)
        }
        if (!unmounted && !isStreamStart){
            subscribeStreaming(janus, opaqueId, streamingCallback);
        }
        if (isStreamStart || (janus && janusReload)) {
            if (streaming !== null) {
                if (videoArea.current !== null){
                    videoArea.current.video.video.removeEventListener('play', handleStopEvent)
                    videoArea.current.video.video.srcObject = null;
                } 
                stopStream(streaming, streamId);
            }
            janusReload ? streamIsLive(false) : updateStreamLoading(true);
            updateJanusReload(false);
            subscribeStreaming(janus, opaqueId, streamingCallback);
        }
        setUnmounted(true);
    }, [janus, isStreamStart])


    const handleErrorVideo = (e) => {
        setRecordedPlaybleFile();
    }

    const handlePlayEvent = (e) => {
        console.log("[JanusStreamer] Live Stream Playing", e);
        videoArea.current !== null && videoArea.current.video.video.play();
        updateStreamLoading(false);
        streamIsLive(true);
    }
    const handleStopEvent = (e) => {
        console.log("[JanusStreamer] Stop Stream", e);
        streamIsLive(false);
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