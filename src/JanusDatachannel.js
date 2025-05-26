import React, { useRef, useState, useEffect } from 'react';
import $ from 'jquery';
import Janus from './utils/janus';
import { subscribeDatachannel} from './utils/datachannel';
let dataChannelData = '';
let timer = '';
const JanusDatachannel = React.forwardRef((
    {
        janus, opaqueId, streamId, handleDataChannelData
    }, ref) => {

    useEffect(() => {
        let unmounted = false;
        if (!janus && !unmounted) {
            return;
        }

        if (!unmounted) {
            subscribeDatachannel(janus, opaqueId, datachannelCallback);
        }
        return () => {
            unmounted = true;
        };
    }, [janus])
    /*const datachannelCallback = (_datachannel, eventType, data) => {
        //console.log("[React Janus component][data we received from dataChannel]", _datachannel, eventType, data);
        clearTimeout(timer);
        if(data && eventType == "ondata" && data != "datachannel") {
            dataChannelData = dataChannelData.concat(data);
        }
        console.log("dataChannelData",dataChannelData );
        timer = setTimeout(()=> {
            handleDataChannelData(dataChannelData);
        },8000);
    }*/
    const datachannelCallback = (_datachannel, eventType, data) => {
        if(data && eventType == "ondata" && data != "datachannel") {
            let parsedObject = JSON.parse(data);
            let histogramData = parsedObject.histogram;
            for (var i=0, t=155; i<t; i++) {
                histogramData.push(Math.floor(Math.random() * (4 + t)) * 0)
            }
            handleDataChannelData(histogramData);
        }
    }
    return (
        <div>
        </div>
    )
});

export default JanusDatachannel;