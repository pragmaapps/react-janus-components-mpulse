import React, { useEffect, useRef, useState, useCallback } from 'react';
import Janus from './utils/janus';
import { Player } from 'video-react';

const JanusDataChannel = React.forwardRef(({
  server,
  room,
  onMessage,
  onStatusChange,
  children,
  retryAttempts = 3,
  retryDelay = 2000,
  enableVideo = true,
  videoStatus = 'Ready'
}, ref) => {
  const [status, setStatus] = useState('init');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const janusRef = useRef(null);
  const sfHandleRef = useRef(null);
  const remoteFeedRef = useRef(null);
  const privateIdRef = useRef(null);
  const messageCounterRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  const isDestroyedRef = useRef(false);

  const attemptConnection = useCallback(() => {
    if (isDestroyedRef.current) return;

    const janusServer = server || (typeof window !== 'undefined' && window.JANUS_SERVER) || 'ws://10.10.1.115:8188/janus';
    const videoRoom = room || (typeof window !== 'undefined' && window.VIDEO_ROOM_ID) || 9123;

    console.log("JanusDataChannel - server:", janusServer, "room:", videoRoom, "attempt:", retryCount + 1);

    if (retryCount > 0) {
      setIsRetrying(true);
      setStatus('retrying');
      onStatusChange && onStatusChange('retrying');
    }

    Janus.init({
      debug: 'all',
      callback: () => {
        const janus = new Janus({
          server: janusServer,
          success: () => {
            janusRef.current = janus;
            setStatus('connected');
            onStatusChange && onStatusChange('connected');

            janus.attach({
              plugin: 'janus.plugin.videoroom',
              success: (pluginHandle) => {
                sfHandleRef.current = pluginHandle;
                setStatus('attached');
                onStatusChange && onStatusChange('attached');

                const join = {
                  request: 'join',
                  room: videoRoom,
                  ptype: 'publisher',
                  display: 'react-datachannel'
                };
                pluginHandle.send({ message: join });
              },
              error: (err) => {
                console.error('attach error', err);
                setStatus('attach-error');
                onStatusChange && onStatusChange('attach-error');
              },
              onmessage: (msg, jsep) => {
                const event = msg['videoroom'];
                if (event === 'joined') {
                  privateIdRef.current = msg['private_id'];
                  const publishers = msg['publishers'] || [];
                  if (publishers.length > 0) {
                    subscribeToFeed(publishers[0].id);
                  } else {
                    setStatus('waiting-for-publisher');
                    onStatusChange && onStatusChange('waiting-for-publisher');
                  }
                } else if (event === 'event' && msg['publishers']) {
                  const p = msg['publishers'][0];
                  subscribeToFeed(p.id);
                }
              }
            });
          },
          error: (err) => {
            console.error('Janus error', err);
            setError(err);
            setStatus('janus-error');
            onStatusChange && onStatusChange('janus-error');

            // Attempt retry if we haven't exceeded max attempts
            if (retryCount < retryAttempts) {
              console.log(`Connection failed, retrying in ${retryDelay}ms... (${retryCount + 1}/${retryAttempts})`);
              setRetryCount(prev => prev + 1);

              retryTimeoutRef.current = setTimeout(() => {
                attemptConnection();
              }, retryDelay);
            } else {
              console.error('Max retry attempts reached');
              setStatus('max-retries-exceeded');
              onStatusChange && onStatusChange('max-retries-exceeded');
            }
          },
          destroyed: () => {
            if (!isDestroyedRef.current) {
              setStatus('janus-destroyed');
              onStatusChange && onStatusChange('janus-destroyed');
            }
          }
        });

        function subscribeToFeed(feedId) {
          janusRef.current.attach({
            plugin: 'janus.plugin.videoroom',
            success: (remoteFeed) => {
              remoteFeedRef.current = remoteFeed;
              const subscribe = {
                request: 'join',
                room: videoRoom,
                ptype: 'subscriber',
                feed: feedId,
                private_id: privateIdRef.current
              };
              remoteFeed.send({ message: subscribe });
            },
            error: (err) => console.error('remote attach error', err),
            onmessage: (msg, jsep) => {
              if (msg['videoroom'] === 'attached') {
                setStatus('subscribed-attached');
                onStatusChange && onStatusChange('subscribed-attached');
              }
              if (jsep) {
                remoteFeedRef.current.createAnswer({
                  jsep,
                  media: { audioSend: false, videoSend: false, data: true },
                  success: (answerJsep) => {
                    const body = { request: 'start', room: videoRoom };
                    remoteFeedRef.current.send({ message: body, jsep: answerJsep });
                  },
                  error: (err) => console.error('createAnswer error', err)
                });
              }
            },
            onremotestream: (stream) => {
              try {
                if (ref && ref.current && ref.current.video && ref.current.video.video) {
                  Janus.attachMediaStream(ref.current.video.video, stream);
                  ref.current.video.video.play().catch(() => {});
                  console.log('[JanusDataChannel] Video stream attached successfully');
                }
              } catch (e) {
                console.error('attach stream error', e);
              }
            },
            onremotetrack: (track, mid, on) => {
              if (on && track.kind === 'video' && ref && ref.current && ref.current.video && ref.current.video.video) {
                const stream = new MediaStream([track]);
                Janus.attachMediaStream(ref.current.video.video, stream);
                console.log('[JanusDataChannel] Video track attached successfully');
              }
            },
            ondata: (data) => {
              try {
                // Normalize incoming data to a string so we can parse the TS field
                let msgStr = '';
                if (data instanceof ArrayBuffer) {
                  const decoder = new TextDecoder('utf-8');
                  msgStr = decoder.decode(data);
                } else if (typeof data === 'string') {
                  msgStr = data;
                } else {
                  // Unknown type; best-effort stringify
                  msgStr = JSON.stringify(data);
                }

                // Try JSON first, then fallback to regex like: "TS: 1758078644004, frame counter ..."
                let receivedTs = null;
                try {
                  const maybeJson = JSON.parse(msgStr);
                  if (maybeJson && (typeof maybeJson.TS === 'number' || typeof maybeJson.ts === 'number')) {
                    receivedTs = (maybeJson.TS != null ? maybeJson.TS : maybeJson.ts);
                  } else if (maybeJson && (typeof maybeJson.TS === 'string' || typeof maybeJson.ts === 'string')) {
                    const tsValue = (maybeJson.TS != null ? maybeJson.TS : maybeJson.ts);
                    const n = Number(tsValue);
                    if (!Number.isNaN(n)) receivedTs = n;
                  }
                } catch (_) {
                  // not JSON, ignore
                }
                if (receivedTs == null) {
                  const m = msgStr.match(/TS\s*[:=]\s*(\d{10,})/i);
                  if (m) {
                    receivedTs = Number(m[1]);
                  }
                }

                // If we still couldn't parse TS, keep the original message for debugging
                let displayMessage = '';
                if (receivedTs == null || !Number.isFinite(receivedTs)) {
                  displayMessage = `Could not parse TS from message: ${msgStr}`;
                } else {
                  // Normalize epoch to milliseconds if it's likely in seconds (e.g., 10-digit)
                  if (receivedTs < 1e12) {
                    receivedTs = receivedTs * 1000;
                  }
                  // Build formatted output
                  const formatClock = (epochMs) => {
                    const d = new Date(epochMs);
                    const pad = (n, len = 2) => String(n).padStart(len, '0');
                    const hh = pad(d.getHours());
                    const mm = pad(d.getMinutes());
                    const ss = pad(d.getSeconds());
                    const ms = pad(d.getMilliseconds(), 3);
                    return `${hh}:${mm}:${ss}:${ms}`;
                  };

                  const browserTs = Date.now();
                  const diffMs = receivedTs - browserTs;
                  const dataChannelClock = formatClock(receivedTs);
                  const browserClock = formatClock(browserTs);

                  // Final display line as requested
                  displayMessage = `DataChannelClock: ${dataChannelClock}, BrowserClock: ${browserClock},CurrentTs: ${browserTs},RecievedTs: ${receivedTs}, Diff:${diffMs}ms`;
                }

                messageCounterRef.current += 1;
                const newMessage = {
                  id: messageCounterRef.current,
                  timestamp: new Date().toLocaleTimeString(),
                  content: displayMessage,
                };

                const updatedMessages = [...messages, newMessage];
                setMessages(updatedMessages);

                // Call the onMessage callback if provided
                if (onMessage) {
                  onMessage(newMessage, updatedMessages);
                }
              } catch (e) {
                console.error('Error parsing data', e);
              }
            },
            ondataopen: () => {
              console.log('Data channel open for feed', feedId);
              setStatus('data-channel-open');
              onStatusChange && onStatusChange('data-channel-open');
            },
          });
        }
      }
    });

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (janusRef.current) {
        janusRef.current.destroy();
      }
      isDestroyedRef.current = true;
    };
  }, [server, room, onMessage, onStatusChange, retryCount, retryAttempts, retryDelay]);

  // Initial connection attempt
  useEffect(() => {
    attemptConnection();
  }, []);

  // Manual retry function
  const retryConnection = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    setRetryCount(0);
    setError(null);
    setIsRetrying(false);
    attemptConnection();
  }, [attemptConnection]);

  return (
    <div className="janus-data-channel">
      {/* Error Display */}
      {error && (
        <div style={{
          marginBottom: '15px',
          padding: '10px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '5px',
          color: '#721c24'
        }}>
          <strong>Connection Error:</strong> {error}
          {status === 'max-retries-exceeded' && (
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={retryConnection}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Display */}
      {/* <div style={{
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: status === 'connected' ? '#d4edda' : '#fff3cd',
        border: `1px solid ${status === 'connected' ? '#c3e6cb' : '#ffeaa7'}`,
        borderRadius: '5px',
        color: status === 'connected' ? '#155724' : '#856404'
      }}>
        <strong>Status:</strong> {status}
        {isRetrying && <span> (Retrying... {retryCount}/{retryAttempts})</span>}
      </div> */}

      {children && React.cloneElement(children, {
        status,
        messages,
        onClearMessages: () => setMessages([]),
        onRetryConnection: retryConnection,
        error
      })}

      {/* Video Player Section */}
      {enableVideo && (
        <div className="janus-video-container">
          {/* <div className="janus-video-status">
            {videoStatus === "Ready" && (
              <span style={{color:"grey"}}>Ready</span>
            )}
            {videoStatus === "Live" && (
              <span style={{color:"green"}}>Live</span>
            )}
            {videoStatus === "Error" && (
              <span style={{color:"red"}}>Error</span>
            )}
          </div> */}
          <Player playsInline autoPlay muted ref={ref}>
            <div className="video-placeholder">
              <span>Video Stream</span>
            </div>
          </Player>
        </div>
      )}
    </div>
  );
});

export default JanusDataChannel;
