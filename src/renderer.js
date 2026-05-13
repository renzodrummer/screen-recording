import "./index.css";
import { ipcRenderer } from "electron";

let mediaRecorder;
const videoElement = document.querySelector("video");

const startBtn = document.getElementById("startBtn");
startBtn.onclick = (e) => {
    startRecording();
};

const stopBtn = document.getElementById("stopBtn");
stopBtn.onclick = (e) => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        startBtn.innerText = "Start";
    } else {
        console.log("Nothing to stop! Recording hasn't started.");
    }
};

const videoSelectBtn = document.getElementById("videoSelectBtn");
videoSelectBtn.onclick = getVideoSources;

const selectMenu = document.getElementById("selectMenu");

async function getVideoSources() {
    const inputSources = await ipcRenderer.invoke("getSources");

    selectMenu.innerHTML = "";

    inputSources.forEach((source) => {
        const element = document.createElement("option");
        element.value = source.id;
        element.innerHTML = source.name;
        selectMenu.appendChild(element);
    });
}

async function startRecording() {
    if (selectMenu.options.length === 0 || selectMenu.selectedIndex === -1) {
        alert("Please get video sources and select a screen to record first!");
        return;
    }

    const screenId = selectMenu.options[selectMenu.selectedIndex].value;

    const IS_MACOS =
        (await ipcRenderer.invoke("getOperatingSystem")) === "darwin";
    const audio = !IS_MACOS
        ? {
              mandatory: {
                  chromeMediaSource: "desktop",
              },
          }
        : false;

    const constraints = {
        audio,
        video: {
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: screenId,
            },
        },
    };

    await ipcRenderer.invoke("startRecording");

    startBtn.innerText = "Recording";

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    await videoElement.play();

    mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=h264",
    });

    mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
            const buffer = await e.data.arrayBuffer();
            ipcRenderer.send("saveChunk", buffer);
        }
    };

    mediaRecorder.onstop = async () => {
        videoElement.srcObject = null;

        const saved = await ipcRenderer.invoke("stopRecordingAndSave");

        if (saved) {
            console.log("Video saved successfully!");
        } else {
            console.log("Recording discarded by user.");
        }
    };

    mediaRecorder.start(1000);
}
